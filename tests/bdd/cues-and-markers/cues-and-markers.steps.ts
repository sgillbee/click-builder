import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import { parseConfigToAst } from "../../../src/parser/parser.js";
import { generateTimeline } from "../../../src/timeline/generator.js";
import type { AstJson, TimelineJson } from "../../../src/contracts.js";

interface CueState {
  yamlContent: string;
  ast?: AstJson;
  timeline?: TimelineJson;
}

const state: Partial<CueState> = {};

Given("a configuration with a one-measure metronome pre-roll and a one-measure spoken count-in", () => {
  state.yamlContent = `name: "Cue Overlay Song"
tempo: 120
time_signature: 4/4
video_downbeat_offset_ms: 0
structure:
  - section: "Pre-roll"
    measures: 1
  - section: "Count-in"
    measures: 1
`;
});

When("audio stems are rendered", () => {
  state.ast = parseConfigToAst(state.yamlContent as string);
  state.timeline = generateTimeline(state.ast);
});

Then("count-in cues are overlaid at matching beat timestamps on top of click events", () => {
  const events = state.timeline?.events ?? [];
  const cueEvents = events.filter((event) => event.stem === "cue");
  const clickEvents = events.filter((event) => event.stem === "click");

  expect(cueEvents.length).toBeGreaterThan(0);
  expect(clickEvents.length).toBeGreaterThan(0);

  cueEvents.forEach((cue) => {
    const matchingClick = clickEvents.find((click) => Math.abs(click.timestamp_ms - cue.timestamp_ms) < 0.000001);
    expect(matchingClick).toBeDefined();
  });
});

Given("a song configuration with section markers disabled", () => {
  state.yamlContent = `name: "No Marker Song"
tempo: 120
time_signature: 4/4
video_downbeat_offset_ms: 0
count_in_enabled: false
section_markers_enabled: false
structure:
  - section: "Intro"
    measures: 1
  - section: "Verse"
    measures: 1
`;
});

When("the click track is generated", () => {
  state.ast = parseConfigToAst(state.yamlContent as string);
  state.timeline = generateTimeline(state.ast);
});

Then("only metronome events are emitted", () => {
  const events = state.timeline?.events ?? [];
  expect(events.length).toBeGreaterThan(0);
  expect(events.every((event) => event.stem === "click")).toBe(true);
});

Then("no section-cue stem is rendered", () => {
  const cueEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "cue");
  expect(cueEvents).toHaveLength(0);
});

Given("a song with Intro, Verse, Chorus, and Bridge sections", () => {
  state.yamlContent = `name: "Section Cues"
tempo: 120
time_signature: 4/4
video_downbeat_offset_ms: 0
count_in_enabled: false
structure:
  - section: "Intro"
    measures: 1
  - section: "Verse"
    measures: 1
  - section: "Chorus"
    measures: 1
  - section: "Bridge"
    measures: 1
`;
});

When("the cue timeline is generated", () => {
  state.ast = parseConfigToAst(state.yamlContent as string);
  state.timeline = generateTimeline(state.ast);
});

Then("each section cue is emitted one measure before its section downbeat", () => {
  const cueEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "cue");
  const cueTimes = cueEvents.map((event) => event.timestamp_ms);

  expect(cueEvents).toHaveLength(4);
  expect(cueTimes[0]).toBeCloseTo(0, 8);
  expect(cueTimes[1]).toBeCloseTo(0, 8);
  expect(cueTimes[2]).toBeCloseTo(2000, 8);
  expect(cueTimes[3]).toBeCloseTo(4000, 8);
});
