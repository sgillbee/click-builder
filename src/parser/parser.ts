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
  const baseMetronomeMode = config.metronome_mode;
  const baseSectionMarkersEnabled = config.section_markers_enabled ?? true;

  const commands = config.structure.map((section) => {
    const meter = section.time_signature ? parseMeter(section.time_signature) : baseMeter;
    const bpm = section.tempo ? section.tempo : baseTempo;
    const metronomeMode = section.metronome_mode ? section.metronome_mode : baseMetronomeMode;
    const sectionMarkersEnabled = section.section_markers_enabled ?? baseSectionMarkersEnabled;

    return TimelineCommandSchema.parse({
      type: "section",
      name: section.section,
      measures: section.measures,
      bpm: bpm,
      meter: meter,
      metronome_mode: metronomeMode,
      section_markers_enabled: sectionMarkersEnabled,
    });
  });

  return {
    project_name: config.name,
    video_downbeat_offset_ms: config.video_downbeat_offset,
    timeline_commands: commands,
  };
}