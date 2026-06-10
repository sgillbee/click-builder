import type { MuxerInput } from "./contracts.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";

const SUPPORTED_VIDEO_CONTAINERS = new Set([".mp4", ".mov"]);
const SUPPORTED_AUDIO_CODECS = new Set(["aac", "pcm_s16le"]);

interface VideoStreamProbe {
  codecName: string;
  width: number;
  height: number;
  frameRate: string;
  pixelFormat: string;
}

interface MuxStrategy {
  mode: "visible-black-leader-splice" | "timestamp-delay" | "direct";
  effectiveSignedDeltaMs: number;
}

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

function probeVideoStream(filePath: string): VideoStreamProbe {
  const proc = spawn("ffprobe", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    filePath,
  ]);

  return new Promise<VideoStreamProbe>((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      reject(new Error(`[video-muxer] Failed to start ffprobe: ${error}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`[video-muxer] ffprobe failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as {
          streams?: Array<{
            codec_type?: string;
            codec_name?: string;
            width?: number;
            height?: number;
            avg_frame_rate?: string;
            r_frame_rate?: string;
            pix_fmt?: string;
          }>;
        };

        const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video");
        if (!videoStream?.codec_name || !videoStream.width || !videoStream.height) {
          reject(new Error(`[video-muxer] ffprobe did not return required video stream metadata for ${filePath}`));
          return;
        }

        resolve({
          codecName: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height,
          frameRate: videoStream.avg_frame_rate || videoStream.r_frame_rate || "30/1",
          pixelFormat: videoStream.pix_fmt || "yuv420p",
        });
      } catch (error) {
        reject(new Error(`[video-muxer] Failed to parse ffprobe metadata: ${error}`));
      }
    });
  }) as unknown as VideoStreamProbe;
}

export function determineMuxStrategy(input: MuxerInput): MuxStrategy {
  const effectiveSignedDeltaMs = input.effective_signed_delta_ms ?? input.video_downbeat_offset_ms;

  if (effectiveSignedDeltaMs > 0) {
    return { mode: "visible-black-leader-splice", effectiveSignedDeltaMs };
  }

  if (effectiveSignedDeltaMs < 0) {
    return { mode: "timestamp-delay", effectiveSignedDeltaMs };
  }

  return { mode: "direct", effectiveSignedDeltaMs };
}

function buildFinalMuxArgs(videoPath: string, audioPath: string, outputPath: string, audioCodec: string): string[] {
  return [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    audioCodec,
    "-shortest",
    outputPath,
  ];
}

function frameRateToFpsExpression(frameRate: string): string {
  if (!frameRate || frameRate === "0/0") {
    return "30";
  }

  const [numeratorRaw, denominatorRaw] = frameRate.split("/");
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return "30";
  }

  return (numerator / denominator).toFixed(6);
}

async function createVideoOnlyBody(originalVideoPath: string, outputPath: string): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i",
    originalVideoPath,
    "-map",
    "0:v:0",
    "-c:v",
    "copy",
    "-an",
    outputPath,
  ]);
}

async function createBlackLeaderSegment(probe: VideoStreamProbe, durationMs: number, outputPath: string): Promise<void> {
  const durationSeconds = Math.max(0.001, durationMs / 1000);

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${probe.width}x${probe.height}:r=${frameRateToFpsExpression(probe.frameRate)}:d=${durationSeconds.toFixed(6)}`,
    "-an",
    "-c:v",
    probe.codecName === "h264" ? "libx264" : probe.codecName,
    "-pix_fmt",
    probe.pixelFormat,
    outputPath,
  ]);
}

async function concatVideoSegments(segmentPaths: string[], outputPath: string, workDir: string): Promise<void> {
  const listPath = path.join(workDir, "concat-list.txt");
  const concatList = segmentPaths
    .map((segmentPath) => `file '${segmentPath.replace(/'/g, "''")}'`)
    .join("\n");

  fs.writeFileSync(listPath, concatList);

  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
}

export async function muxVideo(input: MuxerInput): Promise<string> {
  console.error(`[video-muxer] Merging ${input.generated_audio_path} with ${input.original_video_path}`);
  const strategy = determineMuxStrategy(input);
  const effectiveSignedDeltaMs = strategy.effectiveSignedDeltaMs;
  const firstClickTimestampMs = input.first_click_timestamp_ms;
  console.error(
    `[video-muxer] leader-aware inputs: video_downbeat_offset_ms=${input.video_downbeat_offset_ms.toFixed(3)} ` +
    `first_click_timestamp_ms=${firstClickTimestampMs === undefined ? "n/a" : firstClickTimestampMs.toFixed(3)} ` +
    `effective_signed_delta_ms=${effectiveSignedDeltaMs.toFixed(3)}`
  );

  const audioCodec = input.audio_codec ?? "aac";

  if (strategy.mode === "visible-black-leader-splice") {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-visible-leader-"));
    const bodyVideoPath = path.join(workDir, "body-video.mp4");
    const leaderVideoPath = path.join(workDir, "leader-video.mp4");
    const splicedVideoPath = path.join(workDir, "spliced-video.mp4");

    try {
      const probe = await probeVideoStream(input.original_video_path);
      console.error(
        `[video-muxer] workflow=visible-black-leader-splice leader_duration_ms=${effectiveSignedDeltaMs.toFixed(3)} ` +
        `body_stream_copy_preserved=true codec=${probe.codecName} fps=${probe.frameRate}`
      );

      await createVideoOnlyBody(input.original_video_path, bodyVideoPath);
      await createBlackLeaderSegment(probe, effectiveSignedDeltaMs, leaderVideoPath);
      await concatVideoSegments([leaderVideoPath, bodyVideoPath], splicedVideoPath, workDir);
      await runFfmpeg(buildFinalMuxArgs(splicedVideoPath, input.generated_audio_path, input.output_video_path, audioCodec));
    } finally {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    }

    return input.output_video_path;
  }

  const args = buildMuxArgs(input);
  const offsetIndex = args.indexOf("-itsoffset");
  const offsetSeconds = offsetIndex >= 0 ? args[offsetIndex + 1] : "0.000000";
  const streamLabel = strategy.mode === "timestamp-delay" ? "audio" : "video";
  console.error(`[video-muxer] workflow=${strategy.mode}`);
  console.error(`[video-muxer] Applying -itsoffset of ${offsetSeconds}s to ${streamLabel} stream...`);

  await runFfmpeg(args);

  return input.output_video_path;
}

export function isSupportedVideoInputFormat(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return [...SUPPORTED_VIDEO_CONTAINERS].some((ext) => lower.endsWith(ext));
}

export function isSupportedOutputConfig(outputPath: string, audioCodec: string): boolean {
  const lower = outputPath.toLowerCase();
  const containerSupported = [...SUPPORTED_VIDEO_CONTAINERS].some((ext) => lower.endsWith(ext));
  return containerSupported && SUPPORTED_AUDIO_CODECS.has(audioCodec.toLowerCase());
}

export function buildMuxArgs(input: MuxerInput): string[] {
  const effectiveSignedDeltaMs = input.effective_signed_delta_ms ?? input.video_downbeat_offset_ms;
  const offsetSeconds = Math.abs(effectiveSignedDeltaMs) / 1000.0;
  const audioCodec = input.audio_codec ?? "aac";

  // D = 0: direct mux. D < 0: delay audio stream.
  if (effectiveSignedDeltaMs === 0) {
    return buildFinalMuxArgs(input.original_video_path, input.generated_audio_path, input.output_video_path, audioCodec);
  }

  if (effectiveSignedDeltaMs > 0) {
    return buildFinalMuxArgs(input.original_video_path, input.generated_audio_path, input.output_video_path, audioCodec);
  }

  // D < 0: delay audio stream.
  if (effectiveSignedDeltaMs < 0) {
    return [
      "-y",
      "-i",
      input.original_video_path,
      "-itsoffset",
      offsetSeconds.toFixed(6),
      "-i",
      input.generated_audio_path,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      audioCodec,
      "-shortest",
      input.output_video_path,
    ];
  }

  return buildFinalMuxArgs(input.original_video_path, input.generated_audio_path, input.output_video_path, audioCodec);
}