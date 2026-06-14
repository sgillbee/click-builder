import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import { parseConfigToAst } from "../../../src/parser/parser.js";
import { generateTimeline } from "../../../src/timeline/generator.js";
import type { AstJson, TimelineJson } from "../../../src/contracts.js";

interface TimingState {
  yamlContent: string;
  ast?: AstJson;
  timeline?: TimelineJson;
  divisions?: number;
  meter?: string;
  startMeter?: string;
  switchMeter?: string;
  returnMeter?: string;
}

const state: Partial<TimingState> = {};

function buildYaml(overrides: {
  tempo?: number;
  timeSignature?: string;
  divisions?: number;
  structure: string;
}): string {
  const divisionsLine = overrides.divisions ? `divisions: ${overrides.divisions}\n` : "";
  return `name: "Timing Test Song"
tempo: ${overrides.tempo ?? 120}
time_signature: ${overrides.timeSignature ?? "4/4"}
${divisionsLine}video_downbeat_offset_ms: 0
structure:
${overrides.structure}
`;
}

Given(/^a song that starts in (\d+)\/(\d+)$/, (top: string, bottom: string) => {
  state.startMeter = `${top}/${bottom}`;
});

Given(/^switches to (\d+)\/(\d+) for one measure$/, (top: string, bottom: string) => {
  state.switchMeter = `${top}/${bottom}`;
});

Given(/^returns to (\d+)\/(\d+)$/, (top: string, bottom: string) => {
  state.returnMeter = `${top}/${bottom}`;

  state.yamlContent = buildYaml({
    structure: `  - section: "Start"
    measures: 1
    time_signature: ${state.startMeter}
  - section: "Middle"
    measures: 1
    time_signature: ${state.switchMeter}
  - section: "Return"
    measures: 1
    time_signature: ${state.returnMeter}`,
  });

  expect(state.yamlContent).toContain(`time_signature: ${state.startMeter}`);
  expect(state.yamlContent).toContain(`time_signature: ${state.switchMeter}`);
  expect(state.yamlContent).toContain(`time_signature: ${state.returnMeter}`);
});

Given(/^a song in (\d+)\/(\d+) meter$/, (top: string, bottom: string) => {
  state.meter = `${top}/${bottom}`;
  const divisionsOverride = state.divisions ? { divisions: state.divisions } : {};
  state.yamlContent = buildYaml({
    tempo: 120,
    timeSignature: state.meter,
    ...divisionsOverride,
    structure: `  - section: "Verse"
    measures: 1`,
  });
});

Given("a section at 139 BPM", () => {
  state.yamlContent = buildYaml({
    tempo: 139,
    timeSignature: "4/4",
    structure: `  - section: "Precision"
    measures: 1`,
  });
});

When("divisions are set to {int}", (divisions: number) => {
  state.divisions = divisions;
  state.yamlContent = buildYaml({
    tempo: 120,
    timeSignature: state.meter ?? "4/4",
    divisions,
    structure: `  - section: "Verse"
    measures: 1`,
  });
  state.ast = parseConfigToAst(state.yamlContent);
  state.timeline = generateTimeline(state.ast);
});

When("the timeline is generated", () => {
  state.ast = parseConfigToAst(state.yamlContent as string);
  state.timeline = generateTimeline(state.ast);
});

When("beat timestamps are emitted", () => {
  state.ast = parseConfigToAst(state.yamlContent as string);
  state.timeline = generateTimeline(state.ast);
});

Then("all subsequent beat timestamps remain aligned to absolute time", () => {
  const clickEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "click");
  expect(clickEvents).toHaveLength(10);

  clickEvents.forEach((event, index) => {
    expect(event.timestamp_ms).toBeCloseTo(index * 500, 8);
  });
});

Then("six click pulses are generated per bar", () => {
  const clickEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "click");
  expect(clickEvents).toHaveLength(6);
});

Then("four click pulses are generated per bar", () => {
  const clickEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "click");
  expect(clickEvents).toHaveLength(4);
});

Then("two click pulses are generated per bar", () => {
  const clickEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "click");
  expect(clickEvents).toHaveLength(2);
});

Then("timestamp values retain floating-point precision", () => {
  const clickEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "click");
  expect(clickEvents[1]?.timestamp_ms).toBeDefined();
  expect(clickEvents[1]?.timestamp_ms).toBeCloseTo(431.6546762589, 8);
});

Then("they are not rounded to integer milliseconds", () => {
  const clickEvents = (state.timeline?.events ?? []).filter((event) => event.stem === "click");
  expect(Number.isInteger(clickEvents[1]?.timestamp_ms)).toBe(false);
});
