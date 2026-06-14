import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import { buildRenderArgs, renderAudio } from "./renderer.js";
import type { TimelineJson } from "../contracts.js";

describe("renderAudio", () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    for (const outputPath of createdPaths.splice(0)) {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }
  });

  it("writes a generated audio file and returns its path", async () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 4230.5,
      total_duration_ms: 1000,
      events: [
        { timestamp_ms: 0, stem: "cue", asset: "cue_intro.wav" },
        { timestamp_ms: 0, stem: "click", asset: "click_accent.wav" },
      ],
    };

    const outputPath = await renderAudio(timeline);
    createdPaths.push(outputPath);

    expect(outputPath).toContain("click_track_");
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it("builds pan filters for routed stems and leaves full-stereo stems untouched", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      stems: [
        {
          id: "click-stem",
          source: { type: "generated", generated_stem: "click" },
          routing: { left: 0, right: 100 },
        },
        {
          id: "cue-stem",
          source: { type: "generated", generated_stem: "cue" },
          routing: { left: 100, right: 100 },
        },
      ],
      events: [
        { timestamp_ms: 0, stem: "click", asset: "click.downbeat" },
        { timestamp_ms: 0, stem: "cue", asset: "cue.section:intro" },
      ],
    };

    const args = buildRenderArgs(timeline, "out.wav");
    const filter = args[args.indexOf("-filter_complex") + 1] as string;

    expect(filter).toContain("pan=stereo|c0=0.000000*c0|c1=1.000000*c0");
    expect(filter).not.toContain("pan=stereo|c0=1.000000*c0|c1=1.000000*c0");
  });

  it("builds no pan filter when stems use the default full-stereo routing", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      stems: [
        {
          id: "click-stem",
          source: { type: "generated", generated_stem: "click" },
          routing: { left: 100, right: 100 },
        },
      ],
      events: [{ timestamp_ms: 0, stem: "click", asset: "click.downbeat" }],
    };

    const args = buildRenderArgs(timeline, "out.wav");
    const filter = args[args.indexOf("-filter_complex") + 1] as string;

    expect(filter).not.toContain("pan=stereo");
  });

  it("maps ending section cues to the ending profile asset", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      click_profile: "assets/click-profiles/PraiseCharts.config.yml",
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.section:ending" }],
    };

    const args = buildRenderArgs(timeline, "out.wav");
    const inputArgs = args.filter((arg) => arg.includes("Ending.wav"));

    expect(inputArgs.length).toBeGreaterThan(0);
  });

  it("maps turnaround section cues to the turnaround profile asset", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      click_profile: "assets/click-profiles/PraiseCharts.config.yml",
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.section:turnaround" }],
    };

    const args = buildRenderArgs(timeline, "out.wav");
    const inputArgs = args.filter((arg) => arg.includes("Turnaround.wav"));

    expect(inputArgs.length).toBeGreaterThan(0);
  });

  it("maps tag section cues to the tag profile asset", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      click_profile: "assets/click-profiles/PraiseCharts.config.yml",
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.section:tag" }],
    };

    const args = buildRenderArgs(timeline, "out.wav");
    const inputArgs = args.filter((arg) => arg.includes("Tag.wav"));

    expect(inputArgs.length).toBeGreaterThan(0);
  });

  it("maps post chorus section cues to the post chorus profile asset", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      click_profile: "assets/click-profiles/PraiseCharts.config.yml",
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.section:post_chorus" }],
    };

    const args = buildRenderArgs(timeline, "out.wav");
    const inputArgs = args.filter((arg) => arg.includes("Post Chorus.wav"));

    expect(inputArgs.length).toBeGreaterThan(0);
  });

  it("maps refrain section cues to the refrain profile asset", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      click_profile: "assets/click-profiles/PraiseCharts.config.yml",
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.section:refrain" }],
    };

    const args = buildRenderArgs(timeline, "out.wav");
    const inputArgs = args.filter((arg) => arg.includes("Refrain.wav"));

    expect(inputArgs.length).toBeGreaterThan(0);
  });

  it("maps vamp section cues to the vamp profile asset", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      click_profile: "assets/click-profiles/PraiseCharts.config.yml",
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.section:vamp" }],
    };

    const args = buildRenderArgs(timeline, "out.wav");
    const inputArgs = args.filter((arg) => arg.includes("Vamp.wav"));

    expect(inputArgs.length).toBeGreaterThan(0);
  });

  it("fails fast for unmapped section cues when section default is not set", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      click_profile: "assets/click-profiles/PraiseCharts.config.yml",
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.section:made_up_section" }],
    };

    expect(() => buildRenderArgs(timeline, "out.wav")).toThrow(
      "Missing mapping for cue.section:made_up_section"
    );
  });

  it("fails fast for unmapped count cues when count default is not set", () => {
    const timeline: TimelineJson = {
      video_downbeat_offset_ms: 0,
      total_duration_ms: 1000,
      click_profile: "assets/click-profiles/PraiseCharts.config.yml",
      events: [{ timestamp_ms: 0, stem: "cue", asset: "cue.count:99" }],
    };

    expect(() => buildRenderArgs(timeline, "out.wav")).toThrow(
      "Missing mapping for cue.count:99"
    );
  });
});
