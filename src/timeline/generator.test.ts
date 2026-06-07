import { describe, expect, it } from "vitest";
import { generateTimeline } from "./generator.js";
import type { AstJson } from "../contracts.js";

describe("generateTimeline", () => {
  it("uses absolute floating-point timestamps and overlays cues on clicks", () => {
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
    expect(timeline.events).toHaveLength(7);
  });

  it("supports 6/8 subdivision modes without changing section duration", () => {
    const ast: AstJson = {
      project_name: "Subdivision Test",
      video_downbeat_offset_ms: 0,
      timeline_commands: [
        {
          type: "section",
          name: "Verse",
          measures: 1,
          bpm: 120,
          meter: [6, 8],
          metronome_mode: "in-2",
        },
      ],
    };

    const timeline = generateTimeline(ast);
    const clicks = timeline.events.filter((event) => event.stem === "click");

    expect(clicks).toHaveLength(2);
    expect(clicks[0]?.timestamp_ms).toBeCloseTo(0, 8);
    expect(clicks[1]?.timestamp_ms).toBeCloseTo(750, 8);
    expect(timeline.total_duration_ms).toBeCloseTo(1500, 8);
  });

  it("omits section cue events when markers are disabled", () => {
    const ast: AstJson = {
      project_name: "No Markers",
      video_downbeat_offset_ms: 0,
      timeline_commands: [
        {
          type: "section",
          name: "Verse",
          measures: 1,
          bpm: 120,
          meter: [4, 4],
          section_markers_enabled: false,
        },
      ],
    };

    const timeline = generateTimeline(ast);

    expect(timeline.events.some((event) => event.stem === "cue")).toBe(false);
    expect(timeline.events.filter((event) => event.stem === "click")).toHaveLength(4);
  });
});
