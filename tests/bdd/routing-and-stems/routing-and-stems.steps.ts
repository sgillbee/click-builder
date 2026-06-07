import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import { buildRenderArgs } from "../../../src/audio/renderer.js";
import type { TimelineJson } from "../../../src/contracts.js";

interface RoutingState {
  timeline?: TimelineJson;
  args?: string[];
}

const state: Partial<RoutingState> = {};

Given("click stem is routed to right channel only", () => {
  state.timeline = {
    video_downbeat_offset_ms: 0,
    total_duration_ms: 1000,
    events: [{ timestamp_ms: 0, stem: "click", asset: "click_accent.wav" }],
  };
});

Given("room stem is routed to left channel only", () => {
  state.timeline = {
    video_downbeat_offset_ms: 0,
    total_duration_ms: 1000,
    events: [
      { timestamp_ms: 0, stem: "click", asset: "click_accent.wav" },
      { timestamp_ms: 0, stem: "room", asset: "room_mix.wav" },
    ],
  };
});

When("audio is rendered", () => {
  state.args = buildRenderArgs(state.timeline as TimelineJson, "out.wav", {
    stemRouting: {
      click: "right",
      room: "left",
    },
  });
});

Then("output contains channel-specific routing as configured", () => {
  const filter = (state.args as string[])[(state.args as string[]).indexOf("-filter_complex") + 1] as string;

  expect(filter).toContain("pan=stereo|c0=0*c0|c1=c0");
  expect(filter).toContain("pan=stereo|c0=c0|c1=0*c0");
});

Given("cue stem routing is set to band-only", () => {
  state.timeline = {
    video_downbeat_offset_ms: 0,
    total_duration_ms: 1000,
    events: [{ timestamp_ms: 0, stem: "cue", asset: "cue_intro.wav" }],
  };
});

When("output is generated", () => {
  state.args = buildRenderArgs(state.timeline as TimelineJson, "out.wav", {
    stemRouting: {
      cue: "band-only",
    },
  });
});

Then("cues are absent from room channel output", () => {
  const filter = (state.args as string[])[(state.args as string[]).indexOf("-filter_complex") + 1] as string;
  expect(filter).toContain("pan=stereo|c0=0*c0|c1=c0");
});
