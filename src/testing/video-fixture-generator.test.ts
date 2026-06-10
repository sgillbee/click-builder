import { describe, expect, it } from "vitest";
import { __testables, type FixtureDefinition } from "./video-fixture-generator.js";

describe("video-fixture-generator helpers", () => {
  it("computes section windows with lead hidden and song sections visible", () => {
    const fixture: FixtureDefinition = {
      id: "sections-4-4-80",
      beat: { meter: [4, 4], bpm: 80 },
      frameRate: 60,
      resolution: { width: 640, height: 360 },
      leaderBeats: 0,
      songMeasures: 10,
      trailingBeats: 1,
      sections: [
        { name: "Lead", measures: 2, designator: "lead" },
        { name: "Intro", measures: 2, designator: "song" },
        { name: "Verse 1", measures: 2, designator: "song" },
      ],
    };

    const windows = __testables.sectionWindowsMs(fixture);

    expect(windows).toEqual([
      { name: "Lead", start_ms: 0, end_ms: 6000, visible: false, designator: "lead" },
      { name: "Intro", start_ms: 6000, end_ms: 12000, visible: true, designator: "song" },
      { name: "Verse 1", start_ms: 12000, end_ms: 18000, visible: true, designator: "song" },
    ]);
  });

  it("uses sections to determine total song measures and pulse counts", () => {
    const fixture: FixtureDefinition = {
      id: "sections-4-4-80",
      beat: { meter: [4, 4], bpm: 80 },
      frameRate: 60,
      resolution: { width: 640, height: 360 },
      leaderBeats: 0,
      songMeasures: 2,
      trailingBeats: 1,
      sections: [
        { name: "Lead", measures: 2, designator: "lead" },
        { name: "Intro", measures: 2, designator: "song" },
        { name: "Verse 1", measures: 2, designator: "song" },
      ],
    };

    const totalMeasures = __testables.totalSongMeasures(fixture);
    const pulses = __testables.expectedPulseTimesMs(fixture);

    expect(totalMeasures).toBe(6);
    expect(pulses.beatTimes).toHaveLength(24);
    expect(pulses.downbeatTimes).toHaveLength(6);
  });

  it("builds video filter with drawtext only for visible sections", () => {
    const fixture: FixtureDefinition = {
      id: "sections-visible-only",
      beat: { meter: [4, 4], bpm: 80 },
      frameRate: 60,
      resolution: { width: 640, height: 360 },
      leaderBeats: 0,
      songMeasures: 4,
      trailingBeats: 1,
      sections: [
        { name: "Lead", measures: 1, designator: "lead" },
        { name: "Verse: 1", measures: 1, designator: "song" },
      ],
    };

    const filter = __testables.buildVideoFilter(
      fixture,
      {
        fontArgProvider: () => "fontfile='C\\:/Windows/Fonts/arial.ttf'",
      },
    );

    expect(filter).toContain("drawbox=x=iw-80:y=16:w=64:h=64:color=black@0.35");
    expect(filter).toContain("color=white@0.70");
    expect(filter).toContain("color=yellow@0.85");
    expect(filter).toContain("fontfile='C\\:/Windows/Fonts/arial.ttf'");
    expect(filter).toContain("text='Verse\\: 1'");
    expect(filter).toContain("between(t,3.000000,6.000000)");
    expect(filter).not.toContain("text='Lead'");

  });

  it("computes windows for the complex 6/8 section overlay fixture", () => {
    const fixture: FixtureDefinition = {
      id: "sections-6-8-70",
      beat: { meter: [6, 8], bpm: 70 },
      frameRate: 60,
      resolution: { width: 640, height: 360 },
      leaderBeats: 1,
      songMeasures: 24,
      trailingBeats: 1,
      sections: [
        { name: "Click", measures: 2, designator: "click" },
        { name: "Intro", measures: 2, designator: "song" },
        { name: "Verse 1", measures: 2, designator: "song" },
        { name: "Chorus", measures: 2, designator: "song" },
        { name: "Interlude", measures: 1, designator: "song" },
      ],
    };

    const windows = __testables.sectionWindowsMs(fixture);

    expect(windows).toEqual([
      { name: "Click", start_ms: 428.571429, end_ms: 5571.428571, visible: false, designator: "click" },
      { name: "Intro", start_ms: 5571.428571, end_ms: 10714.285714, visible: true, designator: "song" },
      { name: "Verse 1", start_ms: 10714.285714, end_ms: 15857.142857, visible: true, designator: "song" },
      { name: "Chorus", start_ms: 15857.142857, end_ms: 21000, visible: true, designator: "song" },
      { name: "Interlude", start_ms: 21000, end_ms: 23571.428571, visible: true, designator: "song" },
    ]);
  });

  it("supports explicit fullscreen pulse style for compatibility", () => {
    const fixture: FixtureDefinition = {
      id: "fullscreen-compat",
      beat: { meter: [4, 4], bpm: 80 },
      frameRate: 60,
      resolution: { width: 640, height: 360 },
      leaderBeats: 0,
      songMeasures: 2,
      trailingBeats: 1,
    };

    const filter = __testables.buildVideoFilter(fixture, {
      pulseStyle: "fullscreen",
      fontArgProvider: () => "fontfile='C\\:/Windows/Fonts/arial.ttf'",
    });

    expect(filter).toContain("drawbox=x=0:y=0:w=iw:h=ih:color=white");
    expect(filter).toContain("drawbox=x=0:y=0:w=iw:h=ih:color=yellow");
    expect(filter).not.toContain("drawbox=x=iw-80:y=16:w=64:h=64");
  });

  it("throws when no supported drawtext font file exists", () => {
    expect(() => __testables.resolveDrawTextFontArg(() => false)).toThrow("No supported drawtext font file found on this host.");
  });
});
