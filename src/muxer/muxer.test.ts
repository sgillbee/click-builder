import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { muxVideo } from "./muxer.js";
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
});
