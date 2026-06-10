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
