import { describe, expect, it } from "vitest";
import { generateTimeline } from "../../src/timeline/generator.js";
import type { AstJson } from "../../src/contracts.js";

describe("Given AST input, when generating a timeline, then beats stay on absolute timestamps", () => {
  it("uses floating point beat math and overlays cues on the metronome foundation", () => {
    const ast: AstJson = {
      project_name: "Great Are You Lord",
      video_downbeat_offset_ms: 4230.5,
      timeline_commands: [
        {
          type: "section",
          name: "Count-in",
          measures: 1,
          bpm: 139,
          meter: [6, 8],
        },
      ],
    };

    const timeline = generateTimeline(ast);

    expect(timeline.video_downbeat_offset_ms).toBe(4230.5);
    expect(timeline.events[0]).toMatchObject({
      timestamp_ms: 0,
      stem: "cue",
    });
    expect(timeline.events[1].stem).toBe("click");
    expect(timeline.events[1].timestamp_ms).toBeCloseTo(0, 5);
    expect(timeline.events[2].timestamp_ms).toBeCloseTo(215.8273388, 4);
    expect(timeline.events).toHaveLength(7); // 1 cue + 6 click events for a 6/8 measure
  });
});
