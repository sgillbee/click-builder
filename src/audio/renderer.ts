import type { TimelineJson } from "../contracts.js";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { spawn } from "child_process";

const SUPPORTED_AUDIO_FRAGMENT_EXTENSIONS = new Set([".wav", ".mp3"]);

interface AudioMixOptions {
  normalizationDb?: number;
  limiter?: number;
  stemRouting?: Partial<Record<"click" | "cue" | "room", "stereo" | "left" | "right" | "band-only">>;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args]);
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      reject(new Error(`[audio-renderer] Failed to start ffmpeg: ${error}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`[audio-renderer] ffmpeg failed with code ${code}: ${stderr}`));
        return;
      }
      resolve();
    });
  });
}

function resolveEventAssetPath(assetName: string, stem: "click" | "cue" | "room"): string {
  const repoRoot = path.resolve(process.cwd());
  const assetsRoot = path.join(repoRoot, "assets");

  const fallbackClick = path.join(assetsRoot, "Metronome", "Metronome.wav");
  const fallbackCue = path.join(assetsRoot, "Metronome", "MetronomeUp.wav");

  const candidates = [
    assetName,
    path.join(assetsRoot, assetName),
    path.join(assetsRoot, "Metronome", assetName),
    path.join(assetsRoot, "English Guides", "Song Sections", assetName),
    path.join(assetsRoot, "English Guides", "Dynamic Cues", assetName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  if (stem === "click") {
    return fallbackClick;
  }

  return fallbackCue;
}

function buildStemPanFilter(route: "stereo" | "left" | "right" | "band-only"): string | null {
  if (route === "stereo") {
    return null;
  }

  if (route === "left") {
    return "pan=stereo|c0=c0|c1=0*c0";
  }

  return "pan=stereo|c0=0*c0|c1=c0";
}

export async function renderAudio(timeline: TimelineJson): Promise<string> {
  const outputPath = path.join(os.tmpdir(), `click_track_${Date.now()}.wav`);
  const args = buildRenderArgs(timeline, outputPath);

  await runFfmpeg(args);
  return outputPath;
}

export function isSupportedAudioFragmentFormat(filePath: string): boolean {
  return SUPPORTED_AUDIO_FRAGMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function buildRenderArgs(timeline: TimelineJson, outputPath: string, options: AudioMixOptions = {}): string[] {
  const durationSeconds = Math.max(0.1, timeline.total_duration_ms / 1000 + 0.25);
  const normalizationDb = options.normalizationDb ?? -3;
  const limiter = options.limiter ?? 0.95;
  const stemRouting = options.stemRouting ?? {};

  console.error(`[audio-renderer] Rendering ${timeline.events.length} events with ffmpeg...`);
  console.error(`[audio-renderer] Target path: ${outputPath}`);

  const args: string[] = [
    "-y",
    "-f",
    "lavfi",
    "-t",
    durationSeconds.toFixed(6),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
  ];

  const delayedLabels: string[] = [];
  timeline.events.forEach((event, index) => {
    const resolvedAsset = resolveEventAssetPath(event.asset, event.stem);
    args.push("-i", resolvedAsset);
    delayedLabels.push(`[e${index}]`);
  });

  const filterParts: string[] = [];
  timeline.events.forEach((event, index) => {
    const route = stemRouting[event.stem] ?? "stereo";
    const panFilter = buildStemPanFilter(route);
    const sourceLabel = `[${index + 1}:a]`;
    const routedLabel = `[r${index}]`;
    const inputLabel = panFilter ? routedLabel : sourceLabel;
    const delayMs = Math.max(0, Math.round(event.timestamp_ms));

    if (panFilter) {
      filterParts.push(`${sourceLabel}${panFilter}${routedLabel}`);
    }

    filterParts.push(`${inputLabel}adelay=${delayMs}|${delayMs}[e${index}]`);
  });

  const amixInputs = ["[0:a]", ...delayedLabels].join("");
  filterParts.push(`${amixInputs}amix=inputs=${timeline.events.length + 1}:normalize=0,volume=${normalizationDb}dB,alimiter=limit=${limiter}[outa]`);

  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[outa]",
    "-c:a",
    "pcm_s16le",
    outputPath
  );

  return args;
}