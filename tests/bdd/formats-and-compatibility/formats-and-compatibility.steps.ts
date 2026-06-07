import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import { isSupportedAudioFragmentFormat } from "../../../src/audio/renderer.js";
import { buildMuxArgs, isSupportedOutputConfig, isSupportedVideoInputFormat } from "../../../src/muxer/muxer.js";
import type { MuxerInput } from "../../../src/muxer/contracts.js";

interface FormatState {
  videoInputs?: string[];
  fragmentInputs?: string[];
  acceptedVideos?: boolean[];
  acceptedFragments?: boolean[];
  muxInput?: MuxerInput;
  muxArgs?: string[];
}

const state: Partial<FormatState> = {};

Given("source video files in mp4 and mov", () => {
  state.videoInputs = ["song.mp4", "song.mov"];
});

When("inputs are validated", () => {
  state.acceptedVideos = (state.videoInputs as string[]).map((item) => isSupportedVideoInputFormat(item));
});

Then("each supported format is accepted", () => {
  expect(state.acceptedVideos).toEqual([true, true]);
});

Given("cue and click fragments in wav and mp3", () => {
  state.fragmentInputs = ["click.wav", "cue.mp3"];
});

When("fragments are loaded", () => {
  state.acceptedFragments = (state.fragmentInputs as string[]).map((item) => isSupportedAudioFragmentFormat(item));
});

Then("each supported format is accepted for rendering", () => {
  expect(state.acceptedFragments).toEqual([true, true]);
});

Given("an output target of mp4 with AAC audio", () => {
  state.muxInput = {
    video_downbeat_offset_ms: 0,
    generated_audio_path: "click.wav",
    original_video_path: "input.mp4",
    output_video_path: "output.mp4",
    audio_codec: "aac",
  };
});

When("pipeline rendering completes", () => {
  state.muxArgs = buildMuxArgs(state.muxInput as MuxerInput);
});

Then("output uses the configured container and codec combination", () => {
  const args = state.muxArgs as string[];
  expect(isSupportedOutputConfig((state.muxInput as MuxerInput).output_video_path, (state.muxInput as MuxerInput).audio_codec as string)).toBe(true);
  expect(args[args.indexOf("-c:a") + 1]).toBe("aac");
  expect((state.muxInput as MuxerInput).output_video_path.endsWith(".mp4")).toBe(true);
});
