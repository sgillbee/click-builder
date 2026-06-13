import { TimelineEventSchema } from "../contracts.js";
import type { AstJson, TimelineJson } from "../contracts.js";
import { z } from "zod";

type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export function generateTimeline(ast: AstJson): TimelineJson {
  const events: TimelineEvent[] = [];
  let currentTimestampMs = 0;
  let sectionIndex = 0;
  let previousSectionLastMeasureDurationMs: number | undefined;
  let previousSectionLastMeasurePulseCount: number | undefined;

  for (const cmd of ast.timeline_commands) {
    if (cmd.type === "section") {
      const beatsPerMeasure = cmd.meter[0];
      const beatType = cmd.meter[1]; // Usually 4 for quarter, 8 for eighth
      
      // Calculate beat duration. 
      // BPM usually defines quarter notes per minute.
      // If time signature is X/8, a beat is an eighth note. 
      // Strictly speaking: 1 quarter note = 60000 / BPM ms.
      // We assume BPM = quarter note for now, but adjust based on beatType if necessary.
      // A common convention: 60000 / BPM is length of a quarter note.
      const quarterNoteDurationMs = 60000 / cmd.bpm;
      const beatDurationMs = quarterNoteDurationMs * (4 / beatType);
      const measureDurationMs = beatsPerMeasure * beatDurationMs;

      let pulsesPerMeasure = beatsPerMeasure;
      if (cmd.meter[0] === 6 && cmd.meter[1] === 8 && cmd.metronome_mode) {
        if (cmd.metronome_mode === "in-6") {
          pulsesPerMeasure = 6;
        } else if (cmd.metronome_mode === "in-4") {
          pulsesPerMeasure = 4;
        } else {
          pulsesPerMeasure = 2;
        }
      }

      const pulseIntervalMs = measureDurationMs / pulsesPerMeasure;
      const sectionDesignator = cmd.section_designator ?? "song";
      const downbeatEmphasisEnabled = cmd.downbeat_emphasis_enabled ?? true;
      const midBeatFillerEnabled = cmd.mid_beat_filler_enabled ?? false;
      const countInEnabled = cmd.count_in_enabled ?? true;
      const countCuesEnabled = cmd.count_cues_enabled ?? false;

      const sectionCueName = cmd.section_cue_override ?? cmd.name;
      const normalizedSectionName = sectionCueName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const isIntroSection = normalizedSectionName === "intro" || normalizedSectionName.startsWith("intro_");
      const shouldEmitAutoIntroCountCues = sectionDesignator !== "click" && countInEnabled && isIntroSection;

      if (cmd.section_markers_enabled ?? true) {
        // Section cues are a one-measure heads-up before the section downbeat.
        const cueTimestampMs = sectionIndex > 0 && previousSectionLastMeasureDurationMs !== undefined
          ? Math.max(0, currentTimestampMs - previousSectionLastMeasureDurationMs)
          : currentTimestampMs;

        events.push({
          timestamp_ms: cueTimestampMs,
          stem: "cue",
          asset: `cue.section:${normalizedSectionName}`
        });
      }

      if (shouldEmitAutoIntroCountCues && sectionIndex > 0 && previousSectionLastMeasureDurationMs !== undefined) {
        const leadMeasureStartMs = Math.max(0, currentTimestampMs - previousSectionLastMeasureDurationMs);
        const leadPulseCount = previousSectionLastMeasurePulseCount ?? pulsesPerMeasure;
        const leadPulseIntervalMs = previousSectionLastMeasureDurationMs / leadPulseCount;

        for (let pulseIndex = 1; pulseIndex < leadPulseCount; pulseIndex++) {
          events.push({
            timestamp_ms: leadMeasureStartMs + pulseIndex * leadPulseIntervalMs,
            stem: "cue",
            asset: `cue.count:${pulseIndex + 1}`,
          });
        }
      }

      for (let m = 0; m < cmd.measures; m++) {
        const isLastMeasure = m === cmd.measures - 1;
        const configuredFinalBeats = cmd.final_measure_beats;
        const usePartialLastMeasure = isLastMeasure && configuredFinalBeats !== undefined;
        const clampedFinalBeats = Math.min(beatsPerMeasure, Math.max(1, configuredFinalBeats ?? beatsPerMeasure));
        const effectiveBeatsThisMeasure = usePartialLastMeasure ? clampedFinalBeats : beatsPerMeasure;
        const effectiveMeasureDurationMs = effectiveBeatsThisMeasure * beatDurationMs;
        const effectivePulsesThisMeasure = usePartialLastMeasure
          ? Math.max(1, Math.round((effectiveBeatsThisMeasure / beatsPerMeasure) * pulsesPerMeasure))
          : pulsesPerMeasure;

        const measureOffsetMs = m * measureDurationMs;
        const measureStartMs = currentTimestampMs + measureOffsetMs;
        const pulseIntervalMsThisMeasure = effectiveMeasureDurationMs / effectivePulsesThisMeasure;

        for (let b = 0; b < effectivePulsesThisMeasure; b++) {
          // Calculate absolute time for THIS beat relative to section start to avoid compounding iteration errors
          // Then add to the absolute section start time
          const beatOffsetMs = b * pulseIntervalMsThisMeasure;
          const absoluteBeatTimeMs = measureStartMs + beatOffsetMs;

          events.push({
            timestamp_ms: absoluteBeatTimeMs,
            stem: "click",
            asset: b === 0 && downbeatEmphasisEnabled ? "click.downbeat" : "click.upbeat"
          });

          if (midBeatFillerEnabled) {
            events.push({
              timestamp_ms: absoluteBeatTimeMs + pulseIntervalMsThisMeasure / 2,
              stem: "click",
              asset: "click.between",
            });
          }

          const shouldEmitCountCue = (countCuesEnabled || (shouldEmitAutoIntroCountCues && sectionIndex === 0)) && m === 0 && b > 0;
          if (shouldEmitCountCue) {
            events.push({
              timestamp_ms: absoluteBeatTimeMs,
              stem: "cue",
              asset: `cue.count:${b + 1}`,
            });
          }
        }
      }
      
      // Advance the global absolute section timestamp by the exact mathematical length of this section
      const finalBeats = cmd.final_measure_beats === undefined
        ? beatsPerMeasure
        : Math.min(beatsPerMeasure, Math.max(1, cmd.final_measure_beats));
      previousSectionLastMeasureDurationMs = finalBeats * beatDurationMs;
      previousSectionLastMeasurePulseCount = usePulseCountForFinalMeasure(pulsesPerMeasure, beatsPerMeasure, finalBeats);
      const fullMeasures = Math.max(0, cmd.measures - 1);
      currentTimestampMs += (fullMeasures * beatsPerMeasure + finalBeats) * beatDurationMs;
      sectionIndex += 1;
    }
  }

  return {
    video_downbeat_offset_ms: ast.video_downbeat_offset_ms,
    click_profile: ast.click_profile,
    input_video_path: ast.input_video_path,
    output_video_path: ast.output_video_path,
    stems: ast.stems,
    total_duration_ms: currentTimestampMs,
    events: events,
  };
}

function usePulseCountForFinalMeasure(pulsesPerMeasure: number, beatsPerMeasure: number, finalBeats: number): number {
  if (finalBeats === beatsPerMeasure) {
    return pulsesPerMeasure;
  }

  return Math.max(1, Math.round((finalBeats / beatsPerMeasure) * pulsesPerMeasure));
}