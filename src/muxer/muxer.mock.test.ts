import { EventEmitter } from "events";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const mockState = vi.hoisted(() => ({
  frameGap: false,
}));

vi.mock("child_process", () => {
  const spawn = vi.fn((command: string, args: string[]) => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();

    process.nextTick(() => {
      if (command === "ffprobe" && args.includes("-show_streams")) {
        const payload = JSON.stringify({
          streams: [
            {
              codec_type: "video",
              codec_name: "h264",
              width: 320,
              height: 240,
              avg_frame_rate: "30/1",
              pix_fmt: "yuv420p",
              profile: "Main",
              level: 41,
              has_b_frames: 0,
              time_base: "1/30000",
            },
          ],
        });
        proc.stdout.emit("data", payload);
        proc.emit("close", 0);
        return;
      }

      if (command === "ffprobe" && args.includes("-show_entries")) {
        const targetPath = args[args.length - 1] ?? "";
        const isLongAudio = targetPath.includes("audio-long");
        const isBoundaryProbe = args.join(" ").includes("frame=best_effort_timestamp_time");

        if (args.join(" ").includes("format=duration")) {
          proc.stdout.emit("data", isLongAudio ? "4.0\n" : "2.0\n");
          proc.emit("close", 0);
          return;
        }

        if (isBoundaryProbe) {
          if (mockState.frameGap) {
            proc.stdout.emit("data", "3.000000\n3.033333\n3.066667\n6.054688\n6.087021\n");
            proc.emit("close", 0);
            return;
          }

          proc.stdout.emit("data", "3.000000\n3.033333\n3.066667\n3.100000\n3.133333\n");
          proc.emit("close", 0);
          return;
        }

        proc.stdout.emit("data", "0.000000\n0.033333\n0.066667\n0.100000\n");
        proc.emit("close", 0);
        return;
      }

      if (command === "ffmpeg") {
        proc.emit("close", 0);
        return;
      }

      proc.emit("error", new Error(`Unexpected spawn command: ${command}`));
    });

    return proc;
  });

  return { spawn };
});

import { muxVideo } from "./muxer.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("muxVideo mocked branches", () => {
  it("preserves positive-delay muxing when probes stay compatible and continuous", async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-muxer-mock-"));
    const outputPath = path.join(workDir, "output.mp4");

    const finalPath = await muxVideo({
      video_downbeat_offset_ms: 1500,
      generated_audio_path: path.join(workDir, "audio.wav"),
      original_video_path: path.join(workDir, "input.mp4"),
      output_video_path: outputPath,
    });

    expect(finalPath).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(false);
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("reencodes a positive-delay prepend when continuity is unsafe and fallback is allowed", async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-muxer-mock-"));
    const outputPath = path.join(workDir, "output.mp4");
    mockState.frameGap = true;

    const finalPath = await muxVideo({
      video_downbeat_offset_ms: 1500,
      allow_reencode_positive_delay: true,
      generated_audio_path: path.join(workDir, "audio-long.wav"),
      original_video_path: path.join(workDir, "unsafe-input.mp4"),
      output_video_path: outputPath,
    });

    expect(finalPath).toBe(outputPath);
    mockState.frameGap = false;
    fs.rmSync(workDir, { recursive: true, force: true });
  });
});
