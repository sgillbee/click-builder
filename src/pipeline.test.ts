import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runPipeline } from "./pipeline.js";

describe("runPipeline", () => {
  let workDir: string;

  afterEach(() => {
    if (workDir && fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("creates a final video from YAML config and source video inputs", async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-pipeline-"));
    const configPath = path.join(workDir, "song.yaml");
    const inputVideoPath = path.join(workDir, "input.mp4");
    const outputVideoPath = path.join(workDir, "output.mp4");

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

    const finalPath = await runPipeline(configPath, inputVideoPath, outputVideoPath);

    expect(finalPath).toBe(outputVideoPath);
    expect(fs.existsSync(finalPath)).toBe(true);
  });
});
