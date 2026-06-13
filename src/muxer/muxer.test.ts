import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import {
  buildMuxArgs,
  buildVideoAnchoredMuxArgs,
  determineMuxStrategy,
  findTimestampDiscontinuity,
  isLosslessPrependCompatible,
  muxVideo,
  resolvePositiveDelayOutcome,
  resolveVideoAnchoredDurationPlan,
} from "./muxer.js";
import type { MuxerInput } from "./contracts.js";

function generateTestAudio(audioPath: string, durationSeconds = 1): void {
  const result = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=1000:duration=${durationSeconds}`,
    "-c:a",
    "pcm_s16le",
    audioPath,
  ]);

  if (result.status !== 0) {
    throw new Error(`Failed to generate test audio: ${result.stderr.toString()}`);
  }
}

function generateTestVideo(videoPath: string, durationSeconds = 2): void {
  const result = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=320x240:d=${durationSeconds}`,
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

function readMediaDurationSec(filePath: string): number {
  const result = spawnSync("ffprobe", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf-8" });

  if (result.status !== 0) {
    throw new Error(`Failed to probe media duration: ${result.stderr}`);
  }

  return Number(result.stdout.trim());
}

describe("muxVideo", () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    for (const filePath of createdPaths.splice(0)) {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
      }
    }
  });

  it("pads short audio so output keeps the full video duration without warning", async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-muxer-"));
    const audioPath = path.join(workDir, "audio.wav");
    const videoPath = path.join(workDir, "input.mp4");
    const outputPath = path.join(workDir, "output.mp4");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    generateTestAudio(audioPath);
    generateTestVideo(videoPath);

    const input: MuxerInput = {
      video_downbeat_offset_ms: 0,
      generated_audio_path: audioPath,
      original_video_path: videoPath,
      output_video_path: outputPath,
    };

    const finalPath = await muxVideo(input);
    createdPaths.push(workDir);
    const logLines = errorSpy.mock.calls.map((call) => call.join(" "));
    errorSpy.mockRestore();

    expect(finalPath).toBe(outputPath);
    expect(fs.existsSync(finalPath)).toBe(true);
    expect(readMediaDurationSec(finalPath)).toBeCloseTo(2, 1);
    expect(logLines.some((line) => line.includes("warning: generated audio exceeds video duration"))).toBe(false);
  });

  it("trims long audio to the video end and emits a warning", async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-muxer-"));
    const audioPath = path.join(workDir, "audio.wav");
    const videoPath = path.join(workDir, "input.mp4");
    const outputPath = path.join(workDir, "output.mp4");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    generateTestAudio(audioPath, 4);
    generateTestVideo(videoPath, 2);

    await muxVideo({
      video_downbeat_offset_ms: 0,
      generated_audio_path: audioPath,
      original_video_path: videoPath,
      output_video_path: outputPath,
    });
    createdPaths.push(workDir);
    const logLines = errorSpy.mock.calls.map((call) => call.join(" "));
    errorSpy.mockRestore();

    expect(readMediaDurationSec(outputPath)).toBeCloseTo(2, 1);
    expect(logLines.some((line) => line.includes("warning: generated audio exceeds video duration"))).toBe(true);
  });

  it("selects visible black leader splice strategy for positive delta", () => {
    const input: MuxerInput = {
      video_downbeat_offset_ms: 4230.5,
      generated_audio_path: "audio.wav",
      original_video_path: "input.mp4",
      output_video_path: "output.mp4",
    };

    const strategy = determineMuxStrategy(input);
    expect(strategy.mode).toBe("visible-black-leader-splice");
    expect(strategy.effectiveSignedDeltaMs).toBe(4230.5);
  });

  it("builds ffmpeg args that delay audio when offset is negative", () => {
    const input: MuxerInput = {
      video_downbeat_offset_ms: -1500,
      generated_audio_path: "audio.wav",
      original_video_path: "input.mp4",
      output_video_path: "output.mp4",
    };

    const args = buildMuxArgs(input);
    expect(args).toContain("-itsoffset");
    expect(args[args.indexOf("-itsoffset") + 1]).toBe("1.500000");

    // For negative offsets, video is first input and offset is applied to audio input.
    expect(args.indexOf("input.mp4")).toBeLessThan(args.indexOf("-itsoffset"));
    expect(args.indexOf("-itsoffset")).toBeLessThan(args.indexOf("audio.wav"));
    expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
    expect(args[args.indexOf("-c:a") + 1]).toBe("aac");
  });

  it("prefers effective signed delta when provided", () => {
    const input: MuxerInput = {
      video_downbeat_offset_ms: 400,
      first_click_timestamp_ms: -6000,
      effective_signed_delta_ms: 5600,
      generated_audio_path: "audio.wav",
      original_video_path: "input.mp4",
      output_video_path: "output.mp4",
    };

    const strategy = determineMuxStrategy(input);
    expect(strategy.mode).toBe("visible-black-leader-splice");
    expect(strategy.effectiveSignedDeltaMs).toBe(5600);
  });

  it("accepts lossless prepend only when source and leader probes match", () => {
    const compatibility = isLosslessPrependCompatible(
      {
        codecName: "h264",
        width: 1920,
        height: 1080,
        frameRate: "30/1",
        pixelFormat: "yuv420p",
        profile: "Main",
        level: 41,
        hasBFrames: 0,
        timeBase: "1/30000",
      },
      {
        codecName: "h264",
        width: 1920,
        height: 1080,
        frameRate: "30/1",
        pixelFormat: "yuv420p",
        profile: "Main",
        level: 41,
        hasBFrames: 0,
        timeBase: "1/30000",
      },
    );

    expect(compatibility.ok).toBe(true);
  });

  it("rejects lossless prepend when splice probes diverge", () => {
    const compatibility = isLosslessPrependCompatible(
      {
        codecName: "h264",
        width: 1920,
        height: 1080,
        frameRate: "30/1",
        pixelFormat: "yuv420p",
        profile: "Main",
        level: 41,
        hasBFrames: 0,
        timeBase: "1/30000",
      },
      {
        codecName: "h264",
        width: 1920,
        height: 1080,
        frameRate: "30/1",
        pixelFormat: "yuv420p",
        profile: "High",
        level: 41,
        hasBFrames: 2,
        timeBase: "1/15360",
      },
    );

    expect(compatibility.ok).toBe(false);
    expect(compatibility.reason).toContain("profile mismatch");
  });

  it("detects large timestamp gaps at the splice boundary", () => {
    const gap = findTimestampDiscontinuity([3.0, 3.033333, 3.066667, 6.054688, 6.087021], 0.25);
    expect(gap).toBeCloseTo(2.988021, 6);
  });

  it("fails unsafe positive-delay prepends by default and allows explicit fallback", () => {
    expect(
      resolvePositiveDelayOutcome({
        compatibilityOk: true,
        continuityOk: false,
        allowReencodePositiveDelay: false,
      }),
    ).toBe("fail");

    expect(
      resolvePositiveDelayOutcome({
        compatibilityOk: true,
        continuityOk: false,
        allowReencodePositiveDelay: true,
      }),
    ).toBe("reencode");
  });

  it("plans silent tail padding without warning when audio is shorter than video", () => {
    const plan = resolveVideoAnchoredDurationPlan(5, 3);
    expect(plan.warningRequired).toBe(false);
    expect(plan.truncatedAudioSec).toBe(0);
  });

  it("plans a warning when audio exceeds the video duration", () => {
    const plan = resolveVideoAnchoredDurationPlan(5, 6.25);
    expect(plan.warningRequired).toBe(true);
    expect(plan.truncatedAudioSec).toBeCloseTo(1.25, 6);
  });

  it("builds video-anchored mux args with audio padding and a fixed duration cap", () => {
    const args = buildVideoAnchoredMuxArgs({
      videoPath: "input.mp4",
      audioPath: "audio.wav",
      outputPath: "output.mp4",
      audioCodec: "aac",
      videoDurationSec: 8.5,
      audioOffsetSec: 1.5,
    });

    expect(args).toContain("-filter_complex");
    expect(args[args.indexOf("-filter_complex") + 1]).toContain("apad,atrim=duration=8.500000");
    expect(args).toContain("-t");
    expect(args[args.indexOf("-t") + 1]).toBe("8.500000");
    expect(args[args.indexOf("-itsoffset") + 1]).toBe("1.500000");
  });

  it("builds direct mux args for zero delta", () => {
    const input: MuxerInput = {
      video_downbeat_offset_ms: 0,
      generated_audio_path: "audio.wav",
      original_video_path: "input.mp4",
      output_video_path: "output.mp4",
    };

    const args = buildMuxArgs(input);
    expect(args.includes("-itsoffset")).toBe(false);
    expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
    expect(args[args.indexOf("-c:a") + 1]).toBe("aac");
  });
});
