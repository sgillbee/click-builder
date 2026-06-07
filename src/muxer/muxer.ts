import type { MuxerInput } from "./contracts.js";
import { spawn } from "child_process";

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args]);
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      reject(new Error(`[video-muxer] Failed to start ffmpeg: ${error}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`[video-muxer] ffmpeg failed with code ${code}: ${stderr}`));
        return;
      }
      resolve();
    });
  });
}

export async function muxVideo(input: MuxerInput): Promise<string> {
  console.error(`[video-muxer] Merging ${input.generated_audio_path} with ${input.original_video_path}`);

  const args = buildMuxArgs(input);
  const offsetIndex = args.indexOf("-itsoffset");
  const offsetSeconds = offsetIndex >= 0 ? args[offsetIndex + 1] : "unknown";
  console.error(`[video-muxer] Applying -itsoffset of ${offsetSeconds}s to video stream...`);

  await runFfmpeg(args);

  return input.output_video_path;
}

export function buildMuxArgs(input: MuxerInput): string[] {
  const offsetSeconds = input.video_downbeat_offset_ms / 1000.0;
  return [
    "-y",
    "-itsoffset",
    offsetSeconds.toFixed(6),
    "-i",
    input.original_video_path,
    "-i",
    input.generated_audio_path,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    input.output_video_path,
  ];
}