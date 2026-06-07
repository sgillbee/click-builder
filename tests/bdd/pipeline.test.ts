import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { parseConfigToAst } from "../../src/parser/parser.js";
import { generateTimeline } from "../../src/timeline/generator.js";
import { renderAudio } from "../../src/audio/renderer.js";
import { muxVideo } from "../../src/muxer/muxer.js";

describe("BDD pipeline integration", () => {
  let workDir: string;
  let configPath: string;
  let inputVideoPath: string;
  let outputVideoPath: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-test-"));
    configPath = path.join(workDir, "song.yaml");
    inputVideoPath = path.join(workDir, "input.mp4");
    outputVideoPath = path.join(workDir, "output.mp4");

    fs.writeFileSync(
      configPath,
      `
name: "Great Are You Lord"
tempo: 72
time_signature: 6/8
video_downbeat_offset: 4230.5
structure:
  - section: "Count-in"
    measures: 1
  - section: "Verse 1"
    measures: 2
`
    );
    fs.writeFileSync(inputVideoPath, "mock video data");
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("Given a valid YAML config, when the pipeline runs, then each stage hands off cleanly", async () => {
    const yamlContent = fs.readFileSync(configPath, "utf-8");
    const ast = parseConfigToAst(yamlContent);

    expect(ast.timeline_commands).toHaveLength(2);

    const timeline = generateTimeline(ast);
    expect(timeline.events.length).toBeGreaterThan(0);

    const audioPath = await renderAudio(timeline);
    expect(fs.existsSync(audioPath)).toBe(true);

    const finalVideoPath = await muxVideo({
      video_downbeat_offset_ms: timeline.video_downbeat_offset_ms,
      generated_audio_path: audioPath,
      original_video_path: inputVideoPath,
      output_video_path: outputVideoPath,
    });

    expect(finalVideoPath).toBe(outputVideoPath);
    expect(fs.existsSync(finalVideoPath)).toBe(true);
  });
});
