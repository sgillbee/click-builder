import { TimelineEventSchema } from "../contracts.js";
import type { AstJson, TimelineJson } from "../contracts.js";
import { z } from "zod";

type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export function generateTimeline(ast: AstJson): TimelineJson {
  const events: TimelineEvent[] = [];
  let currentTimestampMs = 0;

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
      const downbeatEmphasisEnabled = cmd.downbeat_emphasis_enabled ?? true;
      const midBeatFillerEnabled = cmd.mid_beat_filler_enabled ?? false;
      const countCuesEnabled = cmd.count_cues_enabled ?? false;

      if (cmd.section_markers_enabled ?? true) {
        // Cue at start of section
        const sectionCueName = cmd.section_cue_override ?? cmd.name;
        const normalizedSectionName = sectionCueName.toLowerCase().replace(/[^a-z0-9]/g, "_");
        events.push({
          timestamp_ms: currentTimestampMs,
          stem: "cue",
          asset: `cue.section:${normalizedSectionName}`
        });
      }

      for (let m = 0; m < cmd.measures; m++) {
        const measureStartMs = currentTimestampMs + m * measureDurationMs;
        for (let b = 0; b < pulsesPerMeasure; b++) {
          // Calculate absolute time for THIS beat relative to section start to avoid compounding iteration errors
          // Then add to the absolute section start time
          const beatOffsetMs = b * pulseIntervalMs;
          const absoluteBeatTimeMs = measureStartMs + beatOffsetMs;

          events.push({
            timestamp_ms: absoluteBeatTimeMs,
            stem: "click",
            asset: b === 0 && downbeatEmphasisEnabled ? "click.downbeat" : "click.upbeat"
          });

          if (midBeatFillerEnabled) {
            events.push({
              timestamp_ms: absoluteBeatTimeMs + pulseIntervalMs / 2,
              stem: "click",
              asset: "click.between",
            });
          }

          if (countCuesEnabled && b > 0 && b < 4) {
            events.push({
              timestamp_ms: absoluteBeatTimeMs,
              stem: "cue",
              asset: `cue.count:${b + 1}`,
            });
          }
        }
      }
      
      // Advance the global absolute section timestamp by the exact mathematical length of this section
      currentTimestampMs += cmd.measures * measureDurationMs;
    }
  }

  return {
    video_downbeat_offset_ms: ast.video_downbeat_offset_ms,
    click_profile: ast.click_profile,
    total_duration_ms: currentTimestampMs,
    events: events,
  };
}