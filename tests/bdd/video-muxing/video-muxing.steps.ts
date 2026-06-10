import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import { buildMuxArgs, determineMuxStrategy } from "../../../src/muxer/muxer.js";
import type { MuxerInput } from "../../../src/muxer/contracts.js";

interface VideoMuxState {
  input?: MuxerInput;
  args?: string[];
  countInDurationMs?: number;
  strategyMode?: string;
  effectiveSignedDeltaMs?: number;
}

const state: Partial<VideoMuxState> = {};

Given("an input video and generated click audio", () => {
  state.input = {
    video_downbeat_offset_ms: 4230.5,
    generated_audio_path: "generated-click.wav",
    original_video_path: "input-video.mp4",
    output_video_path: "output-video.mp4",
  };
});

Given("a configured video downbeat offset", () => {
  state.input = {
    video_downbeat_offset_ms: 5000,
    generated_audio_path: "generated-click.wav",
    original_video_path: "input-video.mp4",
    output_video_path: "output-video.mp4",
  };
});

Given("a generated count-in duration", () => {
  state.countInDurationMs = 5000;
});

Given("positive video delay is required", () => {
  state.input = {
    video_downbeat_offset_ms: 1500,
    generated_audio_path: "generated-click.wav",
    original_video_path: "input-video.mp4",
    output_video_path: "output-video.mp4",
  };
});

Given("zero video delay is required", () => {
  state.input = {
    video_downbeat_offset_ms: 0,
    generated_audio_path: "generated-click.wav",
    original_video_path: "input-video.mp4",
    output_video_path: "output-video.mp4",
  };
});

Given("a negative video downbeat offset is provided", () => {
  state.input = {
    video_downbeat_offset_ms: -250,
    generated_audio_path: "generated-click.wav",
    original_video_path: "input-video.mp4",
    output_video_path: "output-video.mp4",
  };
});

When("muxing is executed", () => {
  const strategy = determineMuxStrategy(state.input as MuxerInput);
  state.strategyMode = strategy.mode;
  state.effectiveSignedDeltaMs = strategy.effectiveSignedDeltaMs;
  state.args = buildMuxArgs(state.input as MuxerInput);
});

When("output is muxed for MVP mode", () => {
  const strategy = determineMuxStrategy(state.input as MuxerInput);
  state.strategyMode = strategy.mode;
  state.effectiveSignedDeltaMs = strategy.effectiveSignedDeltaMs;
  state.args = buildMuxArgs(state.input as MuxerInput);
});

Then("ffmpeg uses video stream copy mode", () => {
  expect(state.args).toBeDefined();
  const args = state.args as string[];
  const codecFlagIndex = args.indexOf("-c:v");

  expect(codecFlagIndex).toBeGreaterThan(-1);
  expect(args[codecFlagIndex + 1]).toBe("copy");
});

Then("video is not re-encoded", () => {
  const args = state.args as string[];
  expect(args.includes("libx264")).toBe(false);
  expect(args.includes("-c:v")).toBe(true);
  expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
});

Then("the effective stream offset aligns beat one of the song with beat one in the video", () => {
  expect(state.strategyMode).toBe("visible-black-leader-splice");
  expect(state.effectiveSignedDeltaMs).toBe(5000);

  // Positive-delay behavior now routes through visible leader generation.
  expect(state.countInDurationMs).toBe(5000);
  expect(state.input?.video_downbeat_offset_ms).toBe(state.countInDurationMs);
});

Then("the video stream starts after the configured delay window", () => {
  expect(state.strategyMode).toBe("visible-black-leader-splice");
  expect(state.effectiveSignedDeltaMs).toBe(1500);
});

Then("the mux offset is exactly zero seconds", () => {
  const args = state.args as string[];

  expect(state.strategyMode).toBe("direct");
  expect(args.includes("-itsoffset")).toBe(false);
});

Then("the audio stream starts after the configured delay window", () => {
  const args = state.args as string[];
  const offsetIndex = args.indexOf("-itsoffset");

  expect(state.strategyMode).toBe("timestamp-delay");
  expect(offsetIndex).toBeGreaterThan(-1);
  expect(args[offsetIndex + 1]).toBe("0.250000");

  // For negative offsets, ffmpeg applies -itsoffset to the audio input.
  expect(args.indexOf("input-video.mp4")).toBeLessThan(offsetIndex);
  expect(offsetIndex).toBeLessThan(args.indexOf("generated-click.wav"));
});
