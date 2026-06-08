import { Before, After, Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { spawnSync } from "child_process";
import { parseConfigToAst } from "../../../src/parser/parser.js";
import { generateTimeline } from "../../../src/timeline/generator.js";
import { renderAudio } from "../../../src/audio/renderer.js";
import { runPipeline } from "../../../src/pipeline.js";
import type { AstJson, TimelineJson } from "../../../src/contracts.js";

function generateTestVideo(videoPath: string): void {
  const result = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=320x240:d=2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    videoPath,
  ]);

  if (result.status !== 0) {
    throw new Error(`Failed to generate test video: ${result.stderr.toString()}`);
  }
}

interface WorldState {
  workDir: string;
  configPath: string;
  inputVideoPath: string;
  outputVideoPath: string;
  yamlContent: string;
  fixtureConfigPath?: string;
  referenceWavPath?: string;
  renderedWavPath?: string;
  renderedWavHash?: string;
  referenceWavHash?: string;
  ast?: AstJson;
  timeline?: TimelineJson;
  finalVideoPath?: string;
}

const state: Partial<WorldState> = {};

Before(() => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-bdd-"));
  state.workDir = workDir;
  state.configPath = path.join(workDir, "song.yaml");
  state.inputVideoPath = path.join(workDir, "input.mp4");
  state.outputVideoPath = path.join(workDir, "output.mp4");
  state.yamlContent = `
name: "Great Are You Lord"
tempo: 72
time_signature: 6/8
video_downbeat_offset: 4230.5
structure:
  - section: "Count-in"
    measures: 1
  - section: "Verse 1"
    measures: 2
    time_signature: 4/4
`;
  fs.writeFileSync(state.configPath, state.yamlContent);
  fs.writeFileSync(state.inputVideoPath, "placeholder-video-for-mock-scenarios");
});

After(() => {
  if (state.workDir && fs.existsSync(state.workDir)) {
    fs.rmSync(state.workDir, { recursive: true, force: true });
  }
  Object.keys(state).forEach((key) => delete state[key as keyof WorldState]);
});

Given("a YAML config with a count-in, a base tempo, and a meter shift", () => {
  expect(state.yamlContent).toContain("time_signature: 6/8");
  expect(state.yamlContent).toContain("time_signature: 4/4");
});

Given("the following YAML config", (docString: string) => {
  state.yamlContent = docString;
  fs.writeFileSync(state.configPath as string, state.yamlContent);
});

When("the config parser reads the configuration", () => {
  state.ast = parseConfigToAst(state.yamlContent as string);
});

When("the simple click timeline is generated", () => {
  state.ast = parseConfigToAst(state.yamlContent as string);
  state.timeline = generateTimeline(state.ast);
});

Then("the parser returns an AST with floating point downbeat offsets and section commands", () => {
  expect(state.ast).toBeDefined();
  expect(state.ast?.video_downbeat_offset_ms).toBe(4230.5);
  expect(state.ast?.timeline_commands).toHaveLength(2);
  expect(state.ast?.timeline_commands[1]).toMatchObject({
    type: "section",
    name: "Verse 1",
    meter: [4, 4],
  });
});

Given("a valid YAML config and an input video file", () => {
  expect(fs.existsSync(state.configPath as string)).toBe(true);
  expect(fs.existsSync(state.inputVideoPath as string)).toBe(true);
});

When("I run the click builder pipeline with mocked media edges", async () => {
  const mockAudioPath = path.join(state.workDir as string, "rendered.wav");

  state.ast = parseConfigToAst(fs.readFileSync(state.configPath as string, "utf-8"));
  state.finalVideoPath = await runPipeline(
    state.configPath as string,
    state.inputVideoPath as string,
    state.outputVideoPath as string,
    {
      async render() {
        fs.writeFileSync(mockAudioPath, "mock-audio");
        return mockAudioPath;
      },
      async mux(input) {
        fs.writeFileSync(input.output_video_path, "mock-video-output");
        return input.output_video_path;
      },
    }
  );
});

When("I run the click builder pipeline end to end with ffmpeg", async () => {
  generateTestVideo(state.inputVideoPath as string);
  state.ast = parseConfigToAst(fs.readFileSync(state.configPath as string, "utf-8"));
  state.finalVideoPath = await runPipeline(
    state.configPath as string,
    state.inputVideoPath as string,
    state.outputVideoPath as string
  );
});

Then("the pipeline produces a final muxed video file", () => {
  expect(state.finalVideoPath).toBe(state.outputVideoPath);
  expect(fs.existsSync(state.finalVideoPath as string)).toBe(true);
});

Then("each stage hands off structured data to the next stage", () => {
  expect(state.ast?.timeline_commands[0]?.bpm).toBe(72);
});

Then("the click timeline spans six measures total", () => {
  const clickEvents = (state.timeline?.events ?? []).filter((event: TimelineJson["events"][number]) => event.stem === "click");
  expect(clickEvents).toHaveLength(24);
});

Then("the timeline duration is 18000 milliseconds", () => {
  expect(state.timeline?.total_duration_ms).toBe(18000);
});

Then("measure two contains intro and 2-3-4 cue overlays on top of click", () => {
  const cues = (state.timeline?.events ?? []).filter((event) => event.stem === "cue");
  const cueAt = (asset: string, ts: number) => cues.some((event) => event.asset === asset && Math.abs(event.timestamp_ms - ts) < 0.000001);

  // 80 BPM in 4/4 => beat = 750ms, measure = 3000ms.
  expect(cueAt("cue.section:intro", 3000)).toBe(true);
  expect(cueAt("cue.count:2", 3750)).toBe(true);
  expect(cueAt("cue.count:3", 4500)).toBe(true);
  expect(cueAt("cue.count:4", 5250)).toBe(true);
});

Then("measures one and three through six are click-only", () => {
  const cues = (state.timeline?.events ?? []).filter((event) => event.stem === "cue");

  // All cue overlays should live in measure 2 only.
  expect(cues).toHaveLength(4);
  expect(cues.every((event) => event.timestamp_ms >= 3000 && event.timestamp_ms < 6000)).toBe(true);

  const clickEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "click");
  expect(clickEvents).toHaveLength(24);
});

Given("the simple intro click fixture config and reference wav", () => {
  const repoRoot = process.cwd();
  state.fixtureConfigPath = path.join(repoRoot, "tests", "fixtures", "golden", "simple-intro-click.yaml");
  state.referenceWavPath = path.join(repoRoot, "tests", "fixtures", "golden", "simple-intro-click.wav");

  expect(fs.existsSync(state.fixtureConfigPath)).toBe(true);
  expect(fs.existsSync(state.referenceWavPath)).toBe(true);
});

Given("the simple intro click with cues fixture config and reference wav", () => {
  const repoRoot = process.cwd();
  state.fixtureConfigPath = path.join(repoRoot, "tests", "fixtures", "golden", "simple-intro-click-with-cues.yaml");
  state.referenceWavPath = path.join(repoRoot, "tests", "fixtures", "golden", "simple-intro-click-with-cues.wav");

  expect(fs.existsSync(state.fixtureConfigPath)).toBe(true);
  expect(fs.existsSync(state.referenceWavPath)).toBe(true);
});

Given("the simple intro click with cues midbeat fixture config and reference wav", () => {
  const repoRoot = process.cwd();
  state.fixtureConfigPath = path.join(repoRoot, "tests", "fixtures", "golden", "simple-intro-click-with-cues-midbeat.yaml");
  state.referenceWavPath = path.join(repoRoot, "tests", "fixtures", "golden", "simple-intro-click-with-cues-midbeat.wav");

  expect(fs.existsSync(state.fixtureConfigPath)).toBe(true);
  expect(fs.existsSync(state.referenceWavPath)).toBe(true);
});

When("I render the simple intro click wav from the fixture config", async () => {
  const yamlContent = fs.readFileSync(state.fixtureConfigPath as string, "utf-8");
  state.ast = parseConfigToAst(yamlContent);
  state.timeline = generateTimeline(state.ast);
  state.renderedWavPath = await renderAudio(state.timeline);

  const renderedBytes = fs.readFileSync(state.renderedWavPath);
  const referenceBytes = fs.readFileSync(state.referenceWavPath as string);

  state.renderedWavHash = crypto.createHash("sha256").update(renderedBytes).digest("hex");
  state.referenceWavHash = crypto.createHash("sha256").update(referenceBytes).digest("hex");
});

Then("the rendered wav matches the approved reference wav", () => {
  expect(state.renderedWavHash).toBeDefined();
  expect(state.referenceWavHash).toBeDefined();
  expect(state.renderedWavHash).toBe(state.referenceWavHash);
});
