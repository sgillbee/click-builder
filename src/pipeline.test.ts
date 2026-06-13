import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { computeLeaderAwareDeltaMs, runPipeline } from "./pipeline.js";
import type { AstJson, TimelineJson } from "./contracts.js";

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

describe("runPipeline", () => {
  let workDir: string;

  afterEach(() => {
    if (workDir && fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("creates a final video from YAML config and source video inputs", async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-pipeline-"));
    const configPath = path.join(workDir, "song.yaml");
    const inputVideoPath = path.join(workDir, "input.mp4");
    const outputVideoPath = path.join(workDir, "output.mp4");

    fs.writeFileSync(
      configPath,
      `
name: "Great Are You Lord"
tempo: 72
time_signature: 6/8
video_downbeat_offset_ms: 4230.5
structure:
  - section: "Count-in"
    measures: 1
  - section: "Verse 1"
    measures: 2
`
    );
    generateTestVideo(inputVideoPath);

    const finalPath = await runPipeline(configPath, inputVideoPath, outputVideoPath);

    expect(finalPath).toBe(outputVideoPath);
    expect(fs.existsSync(finalPath)).toBe(true);
  });

  it("threads the allow-reencode flag into mux input", async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-pipeline-"));
    const configPath = path.join(workDir, "song.yaml");
    const inputVideoPath = path.join(workDir, "input.mp4");
    const outputVideoPath = path.join(workDir, "output.mp4");
    const muxCalls: Array<Record<string, unknown>> = [];

    fs.writeFileSync(
      configPath,
      `
name: "Great Are You Lord"
tempo: 72
time_signature: 6/8
video_downbeat_offset_ms: 4230.5
structure:
  - section: "Count-in"
    measures: 1
  - section: "Verse 1"
    measures: 2
`
    );
    generateTestVideo(inputVideoPath);

    await runPipeline(
      configPath,
      inputVideoPath,
      outputVideoPath,
      {
        mux: async (input) => {
          muxCalls.push(input as unknown as Record<string, unknown>);
          return outputVideoPath;
        },
      },
      { allowReencodePositiveDelay: true }
    );

    expect(muxCalls).toHaveLength(1);
    expect(muxCalls[0]?.allow_reencode_positive_delay).toBe(true);
  });

  it("falls back to YAML video paths when CLI paths are omitted", async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-pipeline-"));
    const configPath = path.join(workDir, "song.yaml");
    const outputVideoPath = path.join(workDir, "output.mp4");
    const muxCalls: Array<Record<string, unknown>> = [];

    fs.writeFileSync(configPath, "name: 'stub'\ntempo: 72\ntime_signature: 4/4\nvideo_downbeat_offset_ms: 0\nstructure:\n  - section: Intro\n    measures: 1\n");

    const finalPath = await runPipeline(
      configPath,
      undefined,
      undefined,
      {
        parse: () => ({
          project_name: "YAML Paths",
          video_downbeat_offset_ms: 0,
          input_video_path: path.join(workDir, "input-from-yaml.mp4"),
          output_video_path: outputVideoPath,
          timeline_commands: [
            {
              type: "section",
              name: "Click",
              measures: 1,
              bpm: 72,
              meter: [4, 4],
              section_designator: "click",
            },
          ],
        }),
        timeline: () => ({
          video_downbeat_offset_ms: 0,
          total_duration_ms: 1000,
          events: [{ timestamp_ms: 0, stem: "click", asset: "click.downbeat" }],
        }),
        render: async () => path.join(workDir, "rendered.wav"),
        mux: async (input) => {
          muxCalls.push(input as unknown as Record<string, unknown>);
          return outputVideoPath;
        },
      }
    );

    expect(finalPath).toBe(outputVideoPath);
    expect(muxCalls[0]?.original_video_path).toBe(path.join(workDir, "input-from-yaml.mp4"));
    expect(muxCalls[0]?.output_video_path).toBe(outputVideoPath);
  });

  it("prefers CLI video paths over YAML paths", async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-pipeline-"));
    const configPath = path.join(workDir, "song.yaml");
    const cliInputVideoPath = path.join(workDir, "input-from-cli.mp4");
    const cliOutputVideoPath = path.join(workDir, "output-from-cli.mp4");
    const muxCalls: Array<Record<string, unknown>> = [];

    fs.writeFileSync(configPath, "name: 'stub'\ntempo: 72\ntime_signature: 4/4\nvideo_downbeat_offset_ms: 0\nstructure:\n  - section: Intro\n    measures: 1\n");

    await runPipeline(
      configPath,
      cliInputVideoPath,
      cliOutputVideoPath,
      {
        parse: () => ({
          project_name: "CLI Paths",
          video_downbeat_offset_ms: 0,
          input_video_path: path.join(workDir, "input-from-yaml.mp4"),
          output_video_path: path.join(workDir, "output-from-yaml.mp4"),
          timeline_commands: [
            {
              type: "section",
              name: "Click",
              measures: 1,
              bpm: 72,
              meter: [4, 4],
              section_designator: "click",
            },
          ],
        }),
        timeline: () => ({
          video_downbeat_offset_ms: 0,
          total_duration_ms: 1000,
          events: [{ timestamp_ms: 0, stem: "click", asset: "click.downbeat" }],
        }),
        render: async () => path.join(workDir, "rendered.wav"),
        mux: async (input) => {
          muxCalls.push(input as unknown as Record<string, unknown>);
          return cliOutputVideoPath;
        },
      }
    );

    expect(muxCalls[0]?.original_video_path).toBe(cliInputVideoPath);
    expect(muxCalls[0]?.output_video_path).toBe(cliOutputVideoPath);
  });

  it("throws when timeline has no click events", () => {
    const ast: AstJson = {
      project_name: "No Clicks",
      video_downbeat_offset_ms: 0,
      timeline_commands: [
        {
          type: "section",
          name: "Verse",
          measures: 1,
          bpm: 72,
          meter: [4, 4],
        },
      ],
    };
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.section:verse" }],
    };

    expect(() => computeLeaderAwareDeltaMs(ast, timeline)).toThrow("timeline has no click events");
  });

  it("computes leader-aware delta for D > 0", () => {
    const ast: AstJson = {
      project_name: "Leader Positive",
      video_downbeat_offset_ms: 400,
      timeline_commands: [
        {
          type: "section",
          name: "Click",
          measures: 2,
          bpm: 80,
          meter: [4, 4],
          section_designator: "click",
        },
        {
          type: "section",
          name: "Intro",
          measures: 1,
          bpm: 80,
          meter: [4, 4],
        },
      ],
    };
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 400,
      total_duration_ms: 9000,
      events: [{ timestamp_ms: 0, stem: "click", asset: "click.downbeat" }],
    };

    const result = computeLeaderAwareDeltaMs(ast, timeline);
    expect(result.first_click_timestamp_ms).toBeCloseTo(-6000, 6);
    expect(result.effective_signed_delta_ms).toBeCloseTo(5600, 6);
  });

  it("computes leader-aware delta for D = 0", () => {
    const ast: AstJson = {
      project_name: "Leader Zero",
      video_downbeat_offset_ms: 6000,
      timeline_commands: [
        {
          type: "section",
          name: "Click",
          measures: 2,
          bpm: 80,
          meter: [4, 4],
          section_designator: "click",
        },
      ],
    };
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 6000,
      total_duration_ms: 6000,
      events: [{ timestamp_ms: 0, stem: "click", asset: "click.downbeat" }],
    };

    const result = computeLeaderAwareDeltaMs(ast, timeline);
    expect(result.effective_signed_delta_ms).toBeCloseTo(0, 6);
  });

  it("computes leader-aware delta for D < 0", () => {
    const ast: AstJson = {
      project_name: "Leader Negative",
      video_downbeat_offset_ms: 8000,
      timeline_commands: [
        {
          type: "section",
          name: "Click",
          measures: 2,
          bpm: 80,
          meter: [4, 4],
          section_designator: "click",
        },
      ],
    };
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 8000,
      total_duration_ms: 6000,
      events: [{ timestamp_ms: 0, stem: "click", asset: "click.downbeat" }],
    };

    const result = computeLeaderAwareDeltaMs(ast, timeline);
    expect(result.effective_signed_delta_ms).toBeCloseTo(-2000, 6);
  });
});
