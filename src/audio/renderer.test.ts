import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import { renderAudio } from "./renderer.js";
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
});
