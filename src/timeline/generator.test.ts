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
    expect(timeline.events[1].asset).toBe("click.downbeat");
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

  it("supports partial final measure beats for section tail", () => {
    const ast: AstJson = {
      project_name: "Partial Tail",
      video_downbeat_offset_ms: 0,
      timeline_commands: [
        {
          type: "section",
          name: "Outro",
          measures: 2,
          final_measure_beats: 1,
          bpm: 120,
          meter: [4, 4],
          section_markers_enabled: false,
        },
      ],
    };

    const timeline = generateTimeline(ast);
    const clicks = timeline.events.filter((event) => event.stem === "click");

    // Measure 1 = 4 beats, measure 2 = 1 beat.
    expect(clicks).toHaveLength(5);
    expect(timeline.total_duration_ms).toBeCloseTo(2500, 8);
  });

  it("emits section cues one measure before subsequent section downbeats", () => {
    const ast: AstJson = {
      project_name: "Lead Cues",
      video_downbeat_offset_ms: 0,
      timeline_commands: [
        {
          type: "section",
          name: "Verse",
          measures: 2,
          bpm: 120,
          meter: [4, 4],
          count_in_enabled: false,
        },
        {
          type: "section",
          name: "Chorus",
          measures: 1,
          bpm: 120,
          meter: [4, 4],
          count_in_enabled: false,
        },
      ],
    };

    const timeline = generateTimeline(ast);
    const cues = timeline.events.filter((event) => event.stem === "cue");

    expect(cues).toHaveLength(2);
    expect(cues[0]?.asset).toBe("cue.section:verse");
    expect(cues[0]?.timestamp_ms).toBeCloseTo(0, 8);

    // Chorus starts at 4000ms; lead cue is at previous measure start (2000ms).
    expect(cues[1]?.asset).toBe("cue.section:chorus");
    expect(cues[1]?.timestamp_ms).toBeCloseTo(2000, 8);
  });

  it("emits automatic intro count cues on the preceding lead measure", () => {
    const ast: AstJson = {
      project_name: "Intro Lead Counts",
      video_downbeat_offset_ms: 0,
      timeline_commands: [
        {
          type: "section",
          name: "Click",
          measures: 2,
          bpm: 70,
          meter: [6, 8],
          count_in_enabled: true,
          section_designator: "click",
        },
        {
          type: "section",
          name: "Intro",
          measures: 2,
          bpm: 70,
          meter: [6, 8],
          count_in_enabled: true,
        },
      ],
    };

    const timeline = generateTimeline(ast);
    const countCues = timeline.events.filter((event) => event.stem === "cue" && String(event.asset).startsWith("cue.count:"));

    expect(countCues.map((event) => event.asset)).toEqual([
      "cue.count:2",
      "cue.count:3",
      "cue.count:4",
      "cue.count:5",
      "cue.count:6",
    ]);

    expect(countCues.map((event) => event.timestamp_ms)).toEqual([
      3000,
      3428.571428571429,
      3857.1428571428573,
      4285.714285714286,
      4714.285714285715,
    ]);
  });
});
