import { Before, After, Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { parseConfigToAst } from "../../../src/parser/parser.js";
import { runPipeline } from "../../../src/pipeline.js";
import type { AstJson } from "../../../src/contracts.js";

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
  ast?: AstJson;
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
  generateTestVideo(state.inputVideoPath as string);
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

When("the config parser reads the configuration", () => {
  state.ast = parseConfigToAst(state.yamlContent as string);
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

When("I run the click builder pipeline", async () => {
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
