import type { TimelineJson } from "../contracts.js";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

const SUPPORTED_AUDIO_FRAGMENT_EXTENSIONS = new Set([".wav", ".mp3"]);
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

interface AudioMixOptions {
  normalizationDb?: number;
  limiter?: number;
  stemRouting?: Partial<Record<"click" | "cue" | "room", { left: number; right: number }>>;
}

interface ClickProfile {
  click: {
    downbeat: string;
    upbeat: string;
    between?: string;
  };
  cues?: {
    section_default?: string;
    count_default?: string;
    by_section?: Record<string, string>;
    by_count?: Record<string, string>;
  };
}

const DEFAULT_CLICK_PROFILE_PATH = path.join("assets", "click-profiles", "PraiseCharts.config.yml");

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

function writeTempFilterGraph(filterGraph: string): string {
  const filterPath = path.join(os.tmpdir(), `click_track_filter_${Date.now()}_${Math.random().toString(16).slice(2)}.txt`);
  fs.writeFileSync(filterPath, filterGraph, "utf-8");
  return filterPath;
}

function loadClickProfile(profilePath?: string): LoadedClickProfile {
  const profileRelativePath = profilePath ?? DEFAULT_CLICK_PROFILE_PATH;
  const profileCandidates = path.isAbsolute(profileRelativePath)
    ? [profileRelativePath]
    : [path.join(process.cwd(), profileRelativePath), path.join(PACKAGE_ROOT, profileRelativePath)];

  const resolvedProfilePath = profileCandidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());

  if (!resolvedProfilePath) {
    throw new Error(
      `[audio-renderer] Failed to load click profile. Tried: ${profileCandidates.join(", ")}`
    );
  }

  try {
    const fileContent = fs.readFileSync(resolvedProfilePath, "utf-8");
    return {
      profile: parseYaml(fileContent) as ClickProfile,
      profilePath: resolvedProfilePath,
    };
  } catch (error) {
    throw new Error(`[audio-renderer] Failed to load click profile at ${resolvedProfilePath}: ${error}`);
  }
}

function resolveProfileAsset(assetName: string, profile: ClickProfile, profilePath: string): string | null {
  if (assetName === "click.downbeat") {
    if (!profile.click.downbeat) {
      throw new Error(`[audio-renderer] Missing mapping for click.downbeat in click profile ${profilePath}`);
    }
    return profile.click.downbeat;
  }

  if (assetName === "click.upbeat") {
    if (!profile.click.upbeat) {
      throw new Error(`[audio-renderer] Missing mapping for click.upbeat in click profile ${profilePath}`);
    }
    return profile.click.upbeat;
  }

  if (assetName === "click.between") {
    if (!profile.click.between) {
      throw new Error(`[audio-renderer] Missing mapping for click.between in click profile ${profilePath}`);
    }
    return profile.click.between;
  }

  if (assetName.startsWith("cue.section:")) {
    const sectionName = assetName.split(":", 2)[1] ?? "";
    const sectionOverride = profile.cues?.by_section?.[sectionName];
    if (sectionOverride) {
      return sectionOverride;
    }

    // Fall back to generic families for common song section variants.
    if (sectionName.includes("chorus") && profile.cues?.by_section?.chorus) {
      return profile.cues.by_section.chorus;
    }
    if (sectionName.includes("verse") && profile.cues?.by_section?.verse) {
      return profile.cues.by_section.verse;
    }
    if (sectionName.includes("bridge") && profile.cues?.by_section?.bridge) {
      return profile.cues.by_section.bridge;
    }
    if (sectionName.includes("intro") && profile.cues?.by_section?.intro) {
      return profile.cues.by_section.intro;
    }
    if (sectionName.includes("outro") && profile.cues?.by_section?.outro) {
      return profile.cues.by_section.outro;
    }
    if (sectionName.includes("tag") && profile.cues?.by_section?.outro) {
      return profile.cues.by_section.outro;
    }

    const sectionDefault = profile.cues?.section_default;
    if (sectionDefault) {
      return sectionDefault;
    }

    throw new Error(
      `[audio-renderer] Missing mapping for cue.section:${sectionName} in click profile ${profilePath}. Add cues.by_section.${sectionName} or cues.section_default`
    );
  }

  if (assetName.startsWith("cue.count:")) {
    const countIndex = assetName.split(":", 2)[1] ?? "";
    const countOverride = profile.cues?.by_count?.[countIndex];
    if (countOverride) {
      return countOverride;
    }

    const countDefault = profile.cues?.count_default;
    if (countDefault) {
      return countDefault;
    }

    throw new Error(
      `[audio-renderer] Missing mapping for cue.count:${countIndex} in click profile ${profilePath}. Add cues.by_count."${countIndex}" or cues.count_default`
    );
  }

  return null;
}

function resolveEventAssetPath(assetName: string, stem: "click" | "cue" | "room", profilePath?: string): string {
  const assetsRoots = [path.join(process.cwd(), "assets"), path.join(PACKAGE_ROOT, "assets")];
  const loadedProfile = loadClickProfile(profilePath);
  const profile = loadedProfile.profile;
  const resolvedProfilePath = loadedProfile.profilePath;

  const fallbackClick = assetsRoots.map((root) => path.join(root, "PraiseCharts", "PraiseCharts Downbeat.wav"));
  const fallbackCue = assetsRoots.map((root) => path.join(root, "Metronome", "MetronomeUp.wav"));

  const profileMappedAsset = resolveProfileAsset(assetName, profile, resolvedProfilePath);
  const resolvedAssetName = profileMappedAsset ?? assetName;

  const candidates = [resolvedAssetName, ...assetsRoots.flatMap((assetsRoot) => [
    path.join(assetsRoot, resolvedAssetName),
    path.join(assetsRoot, "PraiseCharts", resolvedAssetName),
    path.join(assetsRoot, "Metronome", resolvedAssetName),
    path.join(assetsRoot, "English Guides", "Song Sections", resolvedAssetName),
    path.join(assetsRoot, "English Guides", "Dynamic Cues", resolvedAssetName),
  ])];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  if (profileMappedAsset) {
    throw new Error(
      `[audio-renderer] Mapped asset for ${assetName} not found on disk: ${resolvedAssetName} (profile ${resolvedProfilePath})`
    );
  }

  if (stem === "click") {
    const clickFallback = fallbackClick.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (clickFallback) {
      return clickFallback;
    }
    throw new Error("[audio-renderer] No fallback click asset found in project or installed package assets.");
  }

  const cueFallback = fallbackCue.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (cueFallback) {
    return cueFallback;
  }
  throw new Error("[audio-renderer] No fallback cue asset found in project or installed package assets.");
}

function buildStemPanFilter(route: { left: number; right: number } | undefined): string | null {
  if (!route || (route.left === 100 && route.right === 100)) {
    return null;
  }

  const leftWeight = (route.left / 100).toFixed(6);
  const rightWeight = (route.right / 100).toFixed(6);
  return `pan=stereo|c0=${leftWeight}*c0|c1=${rightWeight}*c0`;
}

function buildStemRoutingMap(timeline: TimelineJson): Partial<Record<"click" | "cue" | "room", { left: number; right: number }>> {
  const routing: Partial<Record<"click" | "cue" | "room", { left: number; right: number }>> = {};

  for (const stem of timeline.stems ?? []) {
    if (stem.source.type === "generated") {
      routing[stem.source.generated_stem] = {
        left: stem.routing.left,
        right: stem.routing.right,
      };
    }
  }

  return routing;
}

export async function renderAudio(timeline: TimelineJson): Promise<string> {
  const outputPath = path.join(os.tmpdir(), `click_track_${Date.now()}.wav`);
  const args = buildRenderArgs(timeline, outputPath);
  const filterGraphIndex = args.indexOf("-filter_complex");
  let filterGraphPath: string | undefined;

  if (filterGraphIndex > -1) {
    const filterGraph = args[filterGraphIndex + 1];
    if (filterGraph === undefined) {
      throw new Error("[audio-renderer] Missing filter graph content for ffmpeg invocation.");
    }

    filterGraphPath = writeTempFilterGraph(filterGraph);
    args.splice(filterGraphIndex, 2, "-filter_complex_script", filterGraphPath);
  }

  try {
    await runFfmpeg(args);
  } finally {
    if (filterGraphPath && fs.existsSync(filterGraphPath)) {
      fs.unlinkSync(filterGraphPath);
    }
  }

  return outputPath;
}

export function isSupportedAudioFragmentFormat(filePath: string): boolean {
  return SUPPORTED_AUDIO_FRAGMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function buildRenderArgs(timeline: TimelineJson, outputPath: string, options: AudioMixOptions = {}): string[] {
  const durationSeconds = Math.max(0.1, timeline.total_duration_ms / 1000 + 0.25);
  const normalizationDb = options.normalizationDb ?? -3;
  const limiter = options.limiter ?? 0.95;
  const stemRouting = options.stemRouting ?? buildStemRoutingMap(timeline);

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

  const resolvedEventAssets = timeline.events.map((event) =>
    resolveEventAssetPath(event.asset, event.stem, timeline.click_profile)
  );

  const assetToInputIndex = new Map<string, number>();
  for (const resolvedAsset of resolvedEventAssets) {
    if (assetToInputIndex.has(resolvedAsset)) {
      continue;
    }
    args.push("-i", resolvedAsset);
    assetToInputIndex.set(resolvedAsset, assetToInputIndex.size + 1);
  }

  const assetEventSlots = new Map<string, number[]>();
  resolvedEventAssets.forEach((resolvedAsset, eventIndex) => {
    const slots = assetEventSlots.get(resolvedAsset);
    if (slots) {
      slots.push(eventIndex);
      return;
    }
    assetEventSlots.set(resolvedAsset, [eventIndex]);
  });

  const delayedLabels: string[] = [];
  timeline.events.forEach((_, index) => delayedLabels.push(`[e${index}]`));

  const filterParts: string[] = [];
  const eventSourceLabels = new Array<string>(timeline.events.length);

  const orderedAssets = Array.from(assetToInputIndex.entries()).sort((a, b) => a[1] - b[1]);
  orderedAssets.forEach(([resolvedAsset, inputIndex], assetOrder) => {
    const eventSlots = assetEventSlots.get(resolvedAsset) ?? [];
    if (eventSlots.length === 0) {
      return;
    }

    const splitLabels = eventSlots.map((_, splitIndex) => `[src${assetOrder}_${splitIndex}]`);
    const sourceInputLabel = `[${inputIndex}:a]`;

    if (eventSlots.length === 1) {
      filterParts.push(`${sourceInputLabel}anull${splitLabels[0]}`);
    } else {
      filterParts.push(`${sourceInputLabel}asplit=${eventSlots.length}${splitLabels.join("")}`);
    }

    eventSlots.forEach((eventIndex, splitIndex) => {
      eventSourceLabels[eventIndex] = splitLabels[splitIndex] as string;
    });
  });

  timeline.events.forEach((event, index) => {
    const route = stemRouting[event.stem];
    const panFilter = buildStemPanFilter(route);
    const sourceLabel = eventSourceLabels[index];
    if (!sourceLabel) {
      throw new Error(`[audio-renderer] Missing prepared source label for event index ${index}`);
    }
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

interface LoadedClickProfile {
  profile: ClickProfile;
  profilePath: string;
}