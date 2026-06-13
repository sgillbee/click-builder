import { parse } from "yaml";
import { YamlConfigSchema, TimelineCommandSchema } from "../contracts.js";
import type { AstJson } from "../contracts.js";

/**
 * Parses a fractional string like "6/8" into a number tuple [6, 8]
 */
function parseMeter(meterString: string): [number, number] {
  const parts = meterString.split("/");
  if (parts.length !== 2) {
    throw new Error(`Invalid time signature format: ${meterString}`);
  }
  const [topRaw, bottomRaw] = parts;
  if (!topRaw || !bottomRaw) {
    throw new Error(`Invalid time signature format: ${meterString}`);
  }
  const top = parseInt(topRaw, 10);
  const bottom = parseInt(bottomRaw, 10);
  if (isNaN(top) || isNaN(bottom)) {
    throw new Error(`Invalid time signature numbers: ${meterString}`);
  }
  return [top, bottom];
}

function isClickSectionName(sectionName: string): boolean {
  return sectionName.toLowerCase().replace(/[^a-z0-9]/g, "_") === "click";
}

function normalizeStemRouting(stem: { routing?: { left_percent?: number | undefined; right_percent?: number | undefined } | undefined }): { left: number; right: number } {
  return {
    left: stem.routing?.left_percent ?? 100,
    right: stem.routing?.right_percent ?? 100,
  };
}

function normalizeStemSource(source: { type: string; generated_stem?: string }): { type: "generated"; generated_stem: "click" | "cue" } | { type: "source-video-audio" } {
  if (source.type === "generated") {
    return {
      type: "generated",
      generated_stem: source.generated_stem === "cue" ? "cue" : "click",
    };
  }

  return { type: "source-video-audio" };
}

export function parseConfigToAst(yamlContent: string): AstJson {
  let parsed;
  try {
    parsed = parse(yamlContent);
  } catch (error) {
    throw new Error(`Failed to parse YAML: ${error}`);
  }

  // Validate against our rigorous schema
  const config = YamlConfigSchema.parse(parsed);

  const baseMeter = parseMeter(config.time_signature);
  const baseTempo = config.tempo;
  const baseCountInEnabled = config.count_in_enabled ?? true;
  const baseMetronomeMode = config.metronome_mode;
  const baseSectionMarkersEnabled = config.section_markers_enabled ?? true;
  const baseDownbeatEmphasisEnabled = config.downbeat_emphasis_enabled ?? true;
  const baseMidBeatFillerEnabled = config.mid_beat_filler_enabled ?? false;
  const normalizedStems = config.stems?.map((stem) => ({
    id: stem.id,
    source: normalizeStemSource(stem.source),
    routing: normalizeStemRouting(stem),
  }));

  const commands = config.structure.map((section) => {
    const meter = section.time_signature ? parseMeter(section.time_signature) : baseMeter;
    const bpm = section.tempo ? section.tempo : baseTempo;
    const sectionDesignator = section.section_designator ?? (isClickSectionName(section.section) ? "click" : "song");
    const countInEnabled = section.count_in_enabled ?? baseCountInEnabled;
    const metronomeMode = section.metronome_mode ? section.metronome_mode : baseMetronomeMode;
    const sectionMarkersEnabled = section.section_markers_enabled ?? (sectionDesignator === "click" ? false : baseSectionMarkersEnabled);
    const downbeatEmphasisEnabled = section.downbeat_emphasis_enabled ?? baseDownbeatEmphasisEnabled;
    const midBeatFillerEnabled = section.mid_beat_filler_enabled ?? baseMidBeatFillerEnabled;
    const countCuesEnabled = section.count_cues_enabled ?? false;
    const sectionCueOverride = section.section_cue_override;
    const finalMeasureBeats = section.final_measure_beats;

    return TimelineCommandSchema.parse({
      type: "section",
      name: section.section,
      measures: section.measures,
      final_measure_beats: finalMeasureBeats,
      bpm: bpm,
      meter: meter,
      section_designator: sectionDesignator,
      count_in_enabled: countInEnabled,
      metronome_mode: metronomeMode,
      section_markers_enabled: sectionMarkersEnabled,
      downbeat_emphasis_enabled: downbeatEmphasisEnabled,
      mid_beat_filler_enabled: midBeatFillerEnabled,
      count_cues_enabled: countCuesEnabled,
      section_cue_override: sectionCueOverride,
    });
  });

  return {
    project_name: config.name,
    video_downbeat_offset_ms: config.video_downbeat_offset_ms ?? config.video_downbeat_offset ?? 0,
    click_profile: config.click_profile,
    input_video_path: config.input_video_path,
    output_video_path: config.output_video_path,
    stems: normalizedStems,
    timeline_commands: commands,
  };
}