import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { muxVideo } from "./muxer.js";
import type { MuxerInput } from "./contracts.js";

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

    fs.writeFileSync(audioPath, "mock audio");
    fs.writeFileSync(videoPath, "mock video");

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
