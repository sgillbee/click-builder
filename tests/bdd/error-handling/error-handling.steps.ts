import { After, Before, Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { runPipeline } from "../../../src/pipeline.js";

interface ErrorHandlingState {
  workDir: string;
  missingConfigPath: string;
  invalidConfigPath: string;
  validConfigPath: string;
  missingVideoPath: string;
  placeholderVideoPath: string;
  outputVideoPath: string;
  cliStatus?: number | null;
  cliStdErr?: string;
  pipelineError?: Error;
  renderCalled: boolean;
  muxCalled: boolean;
}

const state: Partial<ErrorHandlingState> = {};

function getPipelineCliPath(): string {
  return path.resolve(process.cwd(), "src", "pipeline.ts");
}

Before(() => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-bdd-errors-"));
  state.workDir = workDir;
  state.missingConfigPath = path.join(workDir, "missing.yaml");
  state.invalidConfigPath = path.join(workDir, "invalid.yaml");
  state.validConfigPath = path.join(workDir, "valid.yaml");
  state.missingVideoPath = path.join(workDir, "missing-video.mp4");
  state.placeholderVideoPath = path.join(workDir, "placeholder-input.mp4");
  state.outputVideoPath = path.join(workDir, "output.mp4");
  state.renderCalled = false;
  state.muxCalled = false;

  fs.writeFileSync(
    state.invalidConfigPath,
    `name: "Invalid Config"\ntempo: 120\ntime_signature: "4/4"\nstructure:\n  - section: "Intro"\n    measures: 1\n`
  );

  fs.writeFileSync(
    state.validConfigPath,
    `name: "Valid Config"\ntempo: 120\ntime_signature: "4/4"\nvideo_downbeat_offset_ms: 0\nstructure:\n  - section: "Intro"\n    measures: 1\n`
  );

  fs.writeFileSync(state.placeholderVideoPath, "placeholder-video-content");
});

After(() => {
  if (state.workDir && fs.existsSync(state.workDir)) {
    fs.rmSync(state.workDir, { recursive: true, force: true });
  }
  Object.keys(state).forEach((key) => delete state[key as keyof ErrorHandlingState]);
});

Given("a missing config file path", () => {
  expect(fs.existsSync(state.missingConfigPath as string)).toBe(false);
});

When("the parser CLI is executed", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--loader",
      "ts-node/esm",
      getPipelineCliPath(),
      state.missingConfigPath as string,
      state.placeholderVideoPath as string,
      state.outputVideoPath as string,
    ],
    { encoding: "utf-8" }
  );

  state.cliStatus = result.status;
  state.cliStdErr = result.stderr;
});

Then("the command exits non-zero", () => {
  expect((state.cliStatus ?? 0) !== 0).toBe(true);
});

Then("the error is written to stderr", () => {
  expect((state.cliStdErr ?? "").length).toBeGreaterThan(0);
  expect(state.cliStdErr).toContain("Failed");
});

Given("YAML missing required fields", () => {
  expect(fs.existsSync(state.invalidConfigPath as string)).toBe(true);
});

When("config parsing runs", async () => {
  state.renderCalled = false;
  state.muxCalled = false;

  try {
    await runPipeline(
      state.invalidConfigPath as string,
      state.placeholderVideoPath as string,
      state.outputVideoPath as string,
      {
        async render() {
          state.renderCalled = true;
          return path.join(state.workDir as string, "rendered.wav");
        },
        async mux() {
          state.muxCalled = true;
          return state.outputVideoPath as string;
        },
      }
    );
  } catch (error) {
    state.pipelineError = error as Error;
  }
});

Then("schema validation fails with a structured error message", () => {
  expect(state.pipelineError).toBeDefined();
  expect(state.pipelineError?.name).toBe("ZodError");
  expect(state.renderCalled).toBe(false);
  expect(state.muxCalled).toBe(false);
});

Given("ffmpeg exits with an error code during render or mux", () => {
  expect(fs.existsSync(state.validConfigPath as string)).toBe(true);
  expect(fs.existsSync(state.missingVideoPath as string)).toBe(false);
});

When("the pipeline runs", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--loader",
      "ts-node/esm",
      getPipelineCliPath(),
      state.validConfigPath as string,
      state.missingVideoPath as string,
      state.outputVideoPath as string,
    ],
    { encoding: "utf-8" }
  );

  state.cliStatus = result.status;
  state.cliStdErr = result.stderr;
});

Then("the failing stage logs diagnostics to stderr", () => {
  expect((state.cliStdErr ?? "").length).toBeGreaterThan(0);
  expect(state.cliStdErr).toContain("ffmpeg failed");
});

Then("the pipeline exits non-zero", () => {
  expect((state.cliStatus ?? 0) !== 0).toBe(true);
});
