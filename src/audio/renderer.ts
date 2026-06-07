import type { TimelineJson } from "../contracts.js";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { spawn } from "child_process";

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

function resolveEventAssetPath(assetName: string, stem: "click" | "cue"): string {
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

  return stem === "click" ? fallbackClick : fallbackCue;
}

export async function renderAudio(timeline: TimelineJson): Promise<string> {
  const outputPath = path.join(os.tmpdir(), `click_track_${Date.now()}.wav`);
  const durationSeconds = Math.max(0.1, timeline.total_duration_ms / 1000 + 0.25);

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
    const delayMs = Math.max(0, Math.round(event.timestamp_ms));
    filterParts.push(`[${index + 1}:a]adelay=${delayMs}|${delayMs}[e${index}]`);
  });

  const amixInputs = ["[0:a]", ...delayedLabels].join("");
  filterParts.push(`${amixInputs}amix=inputs=${timeline.events.length + 1}:normalize=0,volume=-3dB,alimiter=limit=0.95[outa]`);

  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[outa]",
    "-c:a",
    "pcm_s16le",
    outputPath
  );

  await runFfmpeg(args);
  return outputPath;
}