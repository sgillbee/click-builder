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

      // Cue at start of section
      events.push({
        timestamp_ms: currentTimestampMs,
        stem: "cue",
        asset: `cue_${cmd.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.wav` // Mock asset name convention
      });

      for (let m = 0; m < cmd.measures; m++) {
        for (let b = 0; b < beatsPerMeasure; b++) {
          // Calculate absolute time for THIS beat relative to section start to avoid compounding iteration errors
          // Then add to the absolute section start time
          const beatOffsetMs = (m * beatsPerMeasure + b) * beatDurationMs;
          const absoluteBeatTimeMs = currentTimestampMs + beatOffsetMs;

          events.push({
            timestamp_ms: absoluteBeatTimeMs,
            stem: "click",
            asset: b === 0 ? "click_accent.wav" : "click_normal.wav" // Accent on downbeat
          });
        }
      }
      
      // Advance the global absolute section timestamp by the exact mathematical length of this section
      currentTimestampMs += (cmd.measures * beatsPerMeasure) * beatDurationMs;
    }
  }

  return {
    video_downbeat_offset_ms: ast.video_downbeat_offset_ms,
    total_duration_ms: currentTimestampMs,
    events: events,
  };
}