import { describe, expect, it } from "vitest";
import { parseConfigToAst } from "./parser.js";

describe("parseConfigToAst", () => {
  it("parses tempo, offsets, and mid-song meter shifts", () => {
    const yamlContent = `
name: "Great Are You Lord"
tempo: 72
time_signature: 6/8
video_downbeat_offset_ms: 4230.5
structure:
  - section: "Count-in"
    measures: 1
  - section: "Verse 1"
    measures: 8
  - section: "Bridge"
    measures: 4
    time_signature: 4/4
`;

    const ast = parseConfigToAst(yamlContent);

    expect(ast.project_name).toBe("Great Are You Lord");
    expect(ast.video_downbeat_offset_ms).toBe(4230.5);
    expect(ast.timeline_commands).toHaveLength(3);
    expect(ast.timeline_commands[0]).toMatchObject({
      type: "section",
      name: "Count-in",
      measures: 1,
      bpm: 72,
      meter: [6, 8],
    });
    expect(ast.timeline_commands[2]).toMatchObject({
      type: "section",
      name: "Bridge",
      measures: 4,
      bpm: 72,
      meter: [4, 4],
    });
  });

  it("throws on malformed input missing required config fields", () => {
    const yamlContent = `
name: "Broken Song"
tempo: 72
time_signature: 6/8
structure:
  - section: "Intro"
    measures: 1
`;

    expect(() => parseConfigToAst(yamlContent)).toThrow();
  });

  it("supports global and section-level metronome mode overrides", () => {
    const yamlContent = `
name: "Subdivision Song"
tempo: 120
time_signature: 6/8
metronome_mode: in-2
video_downbeat_offset_ms: 0
structure:
  - section: "Verse"
    measures: 1
  - section: "Bridge"
    measures: 1
    metronome_mode: in-4
`;

    const ast = parseConfigToAst(yamlContent);

    expect(ast.timeline_commands[0]?.metronome_mode).toBe("in-2");
    expect(ast.timeline_commands[1]?.metronome_mode).toBe("in-4");
  });

  it("parses partial final measure beat counts", () => {
    const yamlContent = `
name: "Partial Measure Song"
tempo: 100
time_signature: 4/4
video_downbeat_offset_ms: 0
structure:
  - section: "Outro"
    measures: 2
    final_measure_beats: 1
`;

    const ast = parseConfigToAst(yamlContent);
    expect(ast.timeline_commands[0]?.final_measure_beats).toBe(1);
  });

  it("accepts legacy video_downbeat_offset key for backward compatibility", () => {
    const yamlContent = `
name: "Legacy Key Song"
tempo: 100
time_signature: 4/4
video_downbeat_offset: 250
structure:
  - section: "Intro"
    measures: 1
`;

    const ast = parseConfigToAst(yamlContent);
    expect(ast.video_downbeat_offset_ms).toBe(250);
  });

  it("supports global section marker disable with section-level override", () => {
    const yamlContent = `
name: "Marker Flags"
tempo: 120
time_signature: 4/4
video_downbeat_offset_ms: 0
section_markers_enabled: false
structure:
  - section: "Intro"
    measures: 1
  - section: "Verse"
    measures: 1
    section_markers_enabled: true
`;

    const ast = parseConfigToAst(yamlContent);

    expect(ast.timeline_commands[0]?.section_markers_enabled).toBe(false);
    expect(ast.timeline_commands[1]?.section_markers_enabled).toBe(true);
  });

  it("normalizes stem declarations and project video paths", () => {
    const yamlContent = `
name: "Stem Project"
tempo: 90
time_signature: 4/4
video_downbeat_offset_ms: 100
input_video_path: "project/input.mp4"
output_video_path: "project/output.mp4"
stems:
  - id: "click-stem"
    source:
      type: "generated"
      generated_stem: "click"
  - id: "cue-stem"
    source:
      type: "generated"
      generated_stem: "cue"
    routing:
      left_percent: 0
  - id: "source-stem"
    source:
      type: "source-video-audio"
    routing:
      right_percent: 25
structure:
  - section: "Click"
    measures: 1
  - section: "Verse 1"
    measures: 1
`;

    const ast = parseConfigToAst(yamlContent);

    expect(ast.input_video_path).toBe("project/input.mp4");
    expect(ast.output_video_path).toBe("project/output.mp4");
    expect(ast.timeline_commands[0]?.section_designator).toBe("click");
    expect(ast.stems).toEqual([
      {
        id: "click-stem",
        source: { type: "generated", generated_stem: "click" },
        routing: { left: 100, right: 100 },
      },
      {
        id: "cue-stem",
        source: { type: "generated", generated_stem: "cue" },
        routing: { left: 0, right: 100 },
      },
      {
        id: "source-stem",
        source: { type: "source-video-audio" },
        routing: { left: 100, right: 25 },
      },
    ]);
  });

  it("rejects invalid meter formatting", () => {
    const yamlContent = `
name: "Bad Meter"
tempo: 90
time_signature: 4-4
video_downbeat_offset_ms: 100
structure:
  - section: "Intro"
    measures: 1
`;

    expect(() => parseConfigToAst(yamlContent)).toThrow("Invalid time signature format: 4-4");
  });

  it("rejects invalid meter numbers", () => {
    const yamlContent = `
name: "Bad Meter Numbers"
tempo: 90
time_signature: x/4
video_downbeat_offset_ms: 100
structure:
  - section: "Intro"
    measures: 1
`;

    expect(() => parseConfigToAst(yamlContent)).toThrow("Invalid time signature numbers: x/4");
  });
});
