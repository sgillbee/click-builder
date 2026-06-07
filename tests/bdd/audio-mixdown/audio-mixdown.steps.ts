import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import { buildRenderArgs } from "../../../src/audio/renderer.js";
import type { TimelineJson } from "../../../src/contracts.js";

interface AudioMixState {
  timeline?: TimelineJson;
  args?: string[];
}

const state: Partial<AudioMixState> = {};

Given("generated click and cue events", () => {
  state.timeline = {
    video_downbeat_offset_ms: 0,
    total_duration_ms: 2000,
    events: [
      { timestamp_ms: 0, stem: "click", asset: "click_accent.wav" },
      { timestamp_ms: 500, stem: "click", asset: "click_normal.wav" },
      { timestamp_ms: 0, stem: "cue", asset: "cue_intro.wav" },
    ],
  };
});

When("stems are built", () => {
  state.args = buildRenderArgs(state.timeline as TimelineJson, "out.wav");
});

Then("the metronome stem is rendered continuously as the base layer", () => {
  const args = state.args as string[];
  expect(args).toContain("anullsrc=channel_layout=stereo:sample_rate=48000");

  const filter = args[args.indexOf("-filter_complex") + 1] as string;
  expect(filter).toContain("[0:a]");
  expect(filter).toContain("amix=inputs=4");
});

Then("cue stems are mixed as overlays", () => {
  const filter = (state.args as string[])[(state.args as string[]).indexOf("-filter_complex") + 1] as string;
  expect(filter).toContain("[e0]");
  expect(filter).toContain("[e1]");
  expect(filter).toContain("[e2]");
});

Given("a config value for normalization target of -3 dB", () => {
  state.timeline = {
    video_downbeat_offset_ms: 0,
    total_duration_ms: 1000,
    events: [{ timestamp_ms: 0, stem: "click", asset: "click_accent.wav" }],
  };
});

When("stems are mixed down", () => {
  state.args = buildRenderArgs(state.timeline as TimelineJson, "out.wav", { normalizationDb: -3 });
});

Then("output processing applies the configured target level", () => {
  const filter = (state.args as string[])[(state.args as string[]).indexOf("-filter_complex") + 1] as string;
  expect(filter).toContain("volume=-3dB");
});

Given("overlapping click and cue transients", () => {
  state.timeline = {
    video_downbeat_offset_ms: 0,
    total_duration_ms: 1000,
    events: [
      { timestamp_ms: 0, stem: "click", asset: "click_accent.wav" },
      { timestamp_ms: 0, stem: "cue", asset: "cue_intro.wav" },
    ],
  };
});

When("the mix is rendered", () => {
  state.args = buildRenderArgs(state.timeline as TimelineJson, "out.wav");
});

Then("the resulting output does not clip", () => {
  const filter = (state.args as string[])[(state.args as string[]).indexOf("-filter_complex") + 1] as string;
  expect(filter).toContain("alimiter=limit=0.95");
});
