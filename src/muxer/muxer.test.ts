import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { buildMuxArgs, muxVideo } from "./muxer.js";
import type { MuxerInput } from "./contracts.js";

function generateTestAudio(audioPath: string): void {
  const result = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1000:duration=1",
    "-c:a",
    "pcm_s16le",
    audioPath,
  ]);

  if (result.status !== 0) {
    throw new Error(`Failed to generate test audio: ${result.stderr.toString()}`);
  }
}

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

describe("muxVideo", () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    for (const filePath of createdPaths.splice(0)) {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
      }
    }
  });

  it("creates the muxed output file and preserves the video copy contract", async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-muxer-"));
    const audioPath = path.join(workDir, "audio.wav");
    const videoPath = path.join(workDir, "input.mp4");
    const outputPath = path.join(workDir, "output.mp4");

    generateTestAudio(audioPath);
    generateTestVideo(videoPath);

    const input: MuxerInput = {
      video_downbeat_offset_ms: 4230.5,
      generated_audio_path: audioPath,
      original_video_path: videoPath,
      output_video_path: outputPath,
    };

    const finalPath = await muxVideo(input);
    createdPaths.push(workDir);

    expect(finalPath).toBe(outputPath);
    expect(fs.existsSync(finalPath)).toBe(true);
  });

  it("builds ffmpeg args with stream-copy and precise offset", () => {
    const input: MuxerInput = {
      video_downbeat_offset_ms: 4230.5,
      generated_audio_path: "audio.wav",
      original_video_path: "input.mp4",
      output_video_path: "output.mp4",
    };

    const args = buildMuxArgs(input);
    expect(args).toContain("-itsoffset");
    expect(args[args.indexOf("-itsoffset") + 1]).toBe("4.230500");
    expect(args.indexOf("-itsoffset")).toBeLessThan(args.indexOf("input.mp4"));
    expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
    expect(args[args.indexOf("-c:a") + 1]).toBe("aac");
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
});
