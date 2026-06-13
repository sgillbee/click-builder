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
  profile: string | undefined;
  level: number | undefined;
  hasBFrames: number;
  timeBase: string;
}

interface MuxStrategy {
  mode: "visible-black-leader-splice" | "timestamp-delay" | "direct";
  effectiveSignedDeltaMs: number;
}

interface CompatibilityResult {
  ok: boolean;
  reason?: string;
}

interface VideoAnchoredDurationPlan {
  videoDurationSec: number;
  effectiveAudioDurationSec: number;
  truncatedAudioSec: number;
  warningRequired: boolean;
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

async function probeVideoStream(filePath: string): Promise<VideoStreamProbe> {
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
            profile?: string;
            level?: number;
            has_b_frames?: number;
            time_base?: string;
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
          profile: videoStream.profile,
          level: videoStream.level,
          hasBFrames: videoStream.has_b_frames ?? 0,
          timeBase: videoStream.time_base || "1/30000",
        });
      } catch (error) {
        reject(new Error(`[video-muxer] Failed to parse ffprobe metadata: ${error}`));
      }
    });
  });
}

async function probeMediaDurationSec(filePath: string): Promise<number> {
  const proc = spawn("ffprobe", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  return new Promise<number>((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      reject(new Error(`[video-muxer] Failed to start ffprobe for duration: ${error}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`[video-muxer] ffprobe duration probe failed with code ${code}: ${stderr}`));
        return;
      }

      const durationSec = Number(stdout.trim());
      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        reject(new Error(`[video-muxer] ffprobe did not return a valid duration for ${filePath}`));
        return;
      }

      resolve(durationSec);
    });
  });
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

export function resolveVideoAnchoredDurationPlan(
  videoDurationSec: number,
  effectiveAudioDurationSec: number,
  toleranceSec = 0.02,
): VideoAnchoredDurationPlan {
  const truncatedAudioSec = Math.max(0, effectiveAudioDurationSec - videoDurationSec);

  return {
    videoDurationSec,
    effectiveAudioDurationSec,
    truncatedAudioSec,
    warningRequired: truncatedAudioSec > toleranceSec,
  };
}

export function buildVideoAnchoredMuxArgs(options: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
  audioCodec: string;
  videoDurationSec: number;
  audioOffsetSec: number | undefined;
}): string[] {
  const args = ["-y", "-i", options.videoPath];

  if ((options.audioOffsetSec ?? 0) > 0) {
    args.push("-itsoffset", (options.audioOffsetSec as number).toFixed(6));
  }

  args.push(
    "-i",
    options.audioPath,
    "-filter_complex",
    `[1:a]apad,atrim=duration=${options.videoDurationSec.toFixed(6)}[aout]`,
    "-map",
    "0:v:0",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    options.audioCodec,
    "-t",
    options.videoDurationSec.toFixed(6),
    options.outputPath,
  );

  return args;
}

async function createVideoAnchoredMuxPlan(options: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
  audioCodec: string;
  audioOffsetSec: number | undefined;
}): Promise<{ args: string[]; plan: VideoAnchoredDurationPlan }> {
  const videoDurationSec = await probeMediaDurationSec(options.videoPath);
  const audioDurationSec = await probeMediaDurationSec(options.audioPath);
  const effectiveAudioDurationSec = audioDurationSec + (options.audioOffsetSec ?? 0);
  const plan = resolveVideoAnchoredDurationPlan(videoDurationSec, effectiveAudioDurationSec);

  return {
    args: buildVideoAnchoredMuxArgs({
      videoPath: options.videoPath,
      audioPath: options.audioPath,
      outputPath: options.outputPath,
      audioCodec: options.audioCodec,
      videoDurationSec: plan.videoDurationSec,
      audioOffsetSec: options.audioOffsetSec,
    }),
    plan,
  };
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

function frameRateToFpsNumber(frameRate: string): number {
  const fps = Number(frameRateToFpsExpression(frameRate));
  return Number.isFinite(fps) && fps > 0 ? fps : 30;
}

function formatH264Profile(profile?: string): string | undefined {
  if (!profile) {
    return undefined;
  }

  const normalized = profile.toLowerCase();
  if (normalized === "main" || normalized === "high" || normalized === "baseline") {
    return normalized;
  }

  return undefined;
}

function formatH264Level(level?: number): string | undefined {
  if (!level || !Number.isFinite(level)) {
    return undefined;
  }

  const major = Math.trunc(level / 10);
  const minor = Math.abs(level % 10);
  return `${major}.${minor}`;
}

function trackTimescaleFromTimeBase(timeBase: string): string | undefined {
  const [, denominatorRaw] = timeBase.split("/");
  const denominator = Number(denominatorRaw);

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return undefined;
  }

  return String(Math.trunc(denominator));
}

function buildLeaderEncodingArgs(probe: VideoStreamProbe): string[] {
  if (probe.codecName === "h264") {
    const args = ["-c:v", "libx264", "-pix_fmt", probe.pixelFormat];
    const profile = formatH264Profile(probe.profile);
    const level = formatH264Level(probe.level);
    const trackTimescale = trackTimescaleFromTimeBase(probe.timeBase);

    if (profile) {
      args.push("-profile:v", profile);
    }

    if (level) {
      args.push("-level:v", level);
    }

    args.push("-bf", String(Math.max(0, probe.hasBFrames)));

    if (trackTimescale) {
      args.push("-video_track_timescale", trackTimescale);
    }

    return args;
  }

  return ["-c:v", probe.codecName, "-pix_fmt", probe.pixelFormat];
}

export function isLosslessPrependCompatible(sourceProbe: VideoStreamProbe, leaderProbe: VideoStreamProbe): CompatibilityResult {
  const sourceFps = frameRateToFpsNumber(sourceProbe.frameRate);
  const leaderFps = frameRateToFpsNumber(leaderProbe.frameRate);

  if (sourceProbe.codecName !== leaderProbe.codecName) {
    return { ok: false, reason: `codec mismatch (${sourceProbe.codecName} vs ${leaderProbe.codecName})` };
  }

  if (sourceProbe.width !== leaderProbe.width || sourceProbe.height !== leaderProbe.height) {
    return { ok: false, reason: `frame size mismatch (${sourceProbe.width}x${sourceProbe.height} vs ${leaderProbe.width}x${leaderProbe.height})` };
  }

  if (sourceProbe.pixelFormat !== leaderProbe.pixelFormat) {
    return { ok: false, reason: `pixel format mismatch (${sourceProbe.pixelFormat} vs ${leaderProbe.pixelFormat})` };
  }

  if (Math.abs(sourceFps - leaderFps) > 0.001) {
    return { ok: false, reason: `frame rate mismatch (${sourceProbe.frameRate} vs ${leaderProbe.frameRate})` };
  }

  if ((sourceProbe.profile ?? "") !== (leaderProbe.profile ?? "")) {
    return { ok: false, reason: `profile mismatch (${sourceProbe.profile ?? "unknown"} vs ${leaderProbe.profile ?? "unknown"})` };
  }

  if (sourceProbe.hasBFrames !== leaderProbe.hasBFrames) {
    return { ok: false, reason: `b-frame mismatch (${sourceProbe.hasBFrames} vs ${leaderProbe.hasBFrames})` };
  }

  if (sourceProbe.timeBase !== leaderProbe.timeBase) {
    return { ok: false, reason: `time base mismatch (${sourceProbe.timeBase} vs ${leaderProbe.timeBase})` };
  }

  return { ok: true };
}

export function findTimestampDiscontinuity(timestampsSec: number[], maxGapSec: number): number | undefined {
  for (let index = 1; index < timestampsSec.length; index++) {
    const previous = timestampsSec[index - 1] as number;
    const current = timestampsSec[index] as number;
    const gap = current - previous;

    if (gap <= 0 || gap > maxGapSec) {
      return gap;
    }
  }

  return undefined;
}

export function resolvePositiveDelayOutcome(options: {
  compatibilityOk: boolean;
  continuityOk: boolean;
  allowReencodePositiveDelay: boolean;
}): "preserve" | "reencode" | "fail" {
  if (options.compatibilityOk && options.continuityOk) {
    return "preserve";
  }

  return options.allowReencodePositiveDelay ? "reencode" : "fail";
}

async function readVideoFrameTimestamps(filePath: string, startSec: number, endSec: number): Promise<number[]> {
  const proc = spawn("ffprobe", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "frame=best_effort_timestamp_time",
    "-of",
    "csv=p=0",
    "-read_intervals",
    `${Math.max(0, startSec).toFixed(3)}%${Math.max(startSec, endSec).toFixed(3)}`,
    filePath,
  ]);

  return new Promise<number[]>((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      reject(new Error(`[video-muxer] Failed to start ffprobe for frame timestamps: ${error}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`[video-muxer] ffprobe frame timestamp read failed with code ${code}: ${stderr}`));
        return;
      }

      const timestamps = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => Number(line))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);

      resolve(timestamps);
    });
  });
}

async function validateSpliceBoundaryContinuity(filePath: string, spliceBoundarySec: number, frameRate: string): Promise<CompatibilityResult> {
  const fps = frameRateToFpsNumber(frameRate);
  const frameDurationSec = 1 / fps;
  const timestamps = await readVideoFrameTimestamps(filePath, spliceBoundarySec - 0.5, spliceBoundarySec + 3.0);

  if (timestamps.length < 2) {
    return { ok: false, reason: "insufficient frame timestamps near splice boundary" };
  }

  const maxGapSec = Math.max(0.25, frameDurationSec * 4);
  const gapSec = findTimestampDiscontinuity(timestamps, maxGapSec);
  if (gapSec !== undefined) {
    return { ok: false, reason: `timestamp discontinuity detected at splice boundary (gap=${gapSec.toFixed(6)}s)` };
  }

  return { ok: true };
}

function buildPositiveDelayFailure(reason: string): Error {
  return new Error(
    `[video-muxer] Lossless positive-delay prepend is unsafe: ${reason}. ` +
    `Re-run with --allow-reencode to permit re-encoded fallback.`
  );
}

function maybeWarnAboutTruncatedAudio(plan: VideoAnchoredDurationPlan): void {
  if (!plan.warningRequired) {
    return;
  }

  console.error(
    `[video-muxer] warning: generated audio exceeds video duration by ${plan.truncatedAudioSec.toFixed(3)}s; ` +
    `trimming audio to preserve source video end`
  );
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
    ...buildLeaderEncodingArgs(probe),
    outputPath,
  ]);
}

async function createReencodedPositiveDelayVideo(
  originalVideoPath: string,
  probe: VideoStreamProbe,
  durationMs: number,
  outputPath: string,
): Promise<void> {
  const durationSeconds = Math.max(0.001, durationMs / 1000);

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${probe.width}x${probe.height}:r=${frameRateToFpsExpression(probe.frameRate)}:d=${durationSeconds.toFixed(6)}`,
    "-i",
    originalVideoPath,
    "-filter_complex",
    "[0:v]setpts=PTS-STARTPTS[leader];[1:v]setpts=PTS-STARTPTS[body];[leader][body]concat=n=2:v=1:a=0[v]",
    "-map",
    "[v]",
    "-an",
    ...buildLeaderEncodingArgs(probe),
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
    const fallbackVideoPath = path.join(workDir, "reencoded-video.mp4");

    try {
      const probe = await probeVideoStream(input.original_video_path);
      console.error(
        `[video-muxer] workflow=visible-black-leader-splice leader_duration_ms=${effectiveSignedDeltaMs.toFixed(3)} ` +
        `body_stream_copy_preserved=true codec=${probe.codecName} fps=${probe.frameRate}`
      );

      try {
        await createVideoOnlyBody(input.original_video_path, bodyVideoPath);
        await createBlackLeaderSegment(probe, effectiveSignedDeltaMs, leaderVideoPath);

        const leaderProbe = await probeVideoStream(leaderVideoPath);
        const compatibility = isLosslessPrependCompatible(probe, leaderProbe);
        if (!compatibility.ok) {
          throw buildPositiveDelayFailure(compatibility.reason ?? "prepend compatibility validation failed");
        }

        await concatVideoSegments([leaderVideoPath, bodyVideoPath], splicedVideoPath, workDir);

        const continuity = await validateSpliceBoundaryContinuity(
          splicedVideoPath,
          effectiveSignedDeltaMs / 1000,
          probe.frameRate,
        );
        const outcome = resolvePositiveDelayOutcome({
          compatibilityOk: compatibility.ok,
          continuityOk: continuity.ok,
          allowReencodePositiveDelay: input.allow_reencode_positive_delay === true,
        });

        if (outcome === "fail") {
          throw buildPositiveDelayFailure(continuity.reason ?? "splice-boundary continuity validation failed");
        }

        if (outcome === "reencode") {
          console.error(
            `[video-muxer] workflow=visible-black-leader-reencode-fallback leader_duration_ms=${effectiveSignedDeltaMs.toFixed(3)} ` +
            `reason=${continuity.reason ?? "unsafe lossless prepend"}`
          );
          await createReencodedPositiveDelayVideo(input.original_video_path, probe, effectiveSignedDeltaMs, fallbackVideoPath);
          const finalMux = await createVideoAnchoredMuxPlan({
            videoPath: fallbackVideoPath,
            audioPath: input.generated_audio_path,
            outputPath: input.output_video_path,
            audioCodec,
            audioOffsetSec: undefined,
          });
          maybeWarnAboutTruncatedAudio(finalMux.plan);
          await runFfmpeg(finalMux.args);
          return input.output_video_path;
        }

        const finalMux = await createVideoAnchoredMuxPlan({
          videoPath: splicedVideoPath,
          audioPath: input.generated_audio_path,
          outputPath: input.output_video_path,
          audioCodec,
          audioOffsetSec: undefined,
        });
        maybeWarnAboutTruncatedAudio(finalMux.plan);
        await runFfmpeg(finalMux.args);
      } catch (error) {
        if (input.allow_reencode_positive_delay !== true) {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[video-muxer] workflow=visible-black-leader-reencode-fallback leader_duration_ms=${effectiveSignedDeltaMs.toFixed(3)} ` +
          `reason=${message}`
        );
        await createReencodedPositiveDelayVideo(input.original_video_path, probe, effectiveSignedDeltaMs, fallbackVideoPath);
        const finalMux = await createVideoAnchoredMuxPlan({
          videoPath: fallbackVideoPath,
          audioPath: input.generated_audio_path,
          outputPath: input.output_video_path,
          audioCodec,
          audioOffsetSec: undefined,
        });
        maybeWarnAboutTruncatedAudio(finalMux.plan);
        await runFfmpeg(finalMux.args);
      }
    } finally {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    }

    return input.output_video_path;
  }

  const offsetSeconds = strategy.mode === "timestamp-delay"
    ? (Math.abs(effectiveSignedDeltaMs) / 1000.0).toFixed(6)
    : "0.000000";
  const streamLabel = strategy.mode === "timestamp-delay" ? "audio" : "video";
  console.error(`[video-muxer] workflow=${strategy.mode}`);
  console.error(`[video-muxer] Applying -itsoffset of ${offsetSeconds}s to ${streamLabel} stream...`);

  const finalMux = await createVideoAnchoredMuxPlan({
    videoPath: input.original_video_path,
    audioPath: input.generated_audio_path,
    outputPath: input.output_video_path,
    audioCodec,
    audioOffsetSec: strategy.mode === "timestamp-delay" ? Number(offsetSeconds) : 0,
  });
  maybeWarnAboutTruncatedAudio(finalMux.plan);
  await runFfmpeg(finalMux.args);

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
    return [
      "-y",
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
      audioCodec,
      input.output_video_path,
    ];
  }

  if (effectiveSignedDeltaMs > 0) {
    return [
      "-y",
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
      audioCodec,
      input.output_video_path,
    ];
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
      input.output_video_path,
    ];
  }

  return [
    "-y",
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
    audioCodec,
    input.output_video_path,
  ];
}