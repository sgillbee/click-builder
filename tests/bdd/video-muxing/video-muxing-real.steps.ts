import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { muxVideo } from "../../../src/muxer/muxer.js";

interface ScenarioManifestEntry {
  id: string;
  fixture_id: string;
  fixture_path: string;
  audio_leader_ms: number;
  video_leader_ms: number;
  signed_delta_ms: number;
  beat_duration_ms: number;
}

interface FixtureManifestEntry {
  id: string;
  expected_section_windows: Array<{
    name: string;
    start_ms: number;
    end_ms: number;
    visible: boolean;
    designator: "song" | "lead" | "click";
  }>;
}

interface StreamStartInfo {
  videoStartSec: number;
  audioStartSec: number;
}

interface RealMuxState {
  workDir: string;
  scenario?: ScenarioManifestEntry;
  fixture?: FixtureManifestEntry;
  outputPath?: string;
  starts?: StreamStartInfo;
}

const state: Partial<RealMuxState> = {};
const MANIFEST_PATH = path.join(process.cwd(), "tests", "fixtures", "video-sync", "manifest.json");
const BASE_AUDIO_PATH = path.join(process.cwd(), "tests", "fixtures", "golden", "simple-intro-click.wav");
const START_TOLERANCE_SEC = 0.06;
const CLICK_ONSET_TOLERANCE_SEC = 0.10;

function readScenarioFromManifest(id: string): ScenarioManifestEntry {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing fixture manifest at ${MANIFEST_PATH}. Run fixture generation first.`);
  }

  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as {
    scenarios: ScenarioManifestEntry[];
    fixtures: Array<{ id: string; beat_duration_ms: number }>;
  };

  const entry = parsed.scenarios.find((scenario) => scenario.id === id);
  if (!entry) {
    throw new Error(`Scenario '${id}' not found in manifest.`);
  }

  const fixture = parsed.fixtures.find((candidate) => candidate.id === entry.fixture_id);
  if (!fixture) {
    throw new Error(`Fixture '${entry.fixture_id}' not found for scenario '${id}'.`);
  }

  return {
    ...entry,
    beat_duration_ms: fixture.beat_duration_ms,
  };
}

function readFixtureFromManifest(id: string): FixtureManifestEntry {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing fixture manifest at ${MANIFEST_PATH}. Run fixture generation first.`);
  }

  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as {
    fixtures: FixtureManifestEntry[];
  };

  const entry = parsed.fixtures.find((fixture) => fixture.id === id);
  if (!entry) {
    throw new Error(`Fixture '${id}' not found in manifest.`);
  }

  return entry;
}

function readStreamStarts(filePath: string): StreamStartInfo {
  const result = spawnSync(
    "ffprobe",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      filePath,
    ],
    { encoding: "utf-8" },
  );

  if (result.status !== 0) {
    throw new Error(`ffprobe failed: ${result.stderr}`);
  }

  const parsed = JSON.parse(result.stdout) as {
    streams: Array<{ codec_type?: string; start_time?: string }>;
  };

  const video = parsed.streams.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams.find((stream) => stream.codec_type === "audio");

  return {
    videoStartSec: Number(video?.start_time ?? "0"),
    audioStartSec: Number(audio?.start_time ?? "0"),
  };
}

function readClickOnsetsSec(filePath: string): number[] {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-i",
      filePath,
      "-af",
      "silencedetect=noise=-40dB:d=0.02",
      "-f",
      "null",
      "NUL",
    ],
    { encoding: "utf-8" },
  );

  const output = `${result.stdout}\n${result.stderr}`;
  const regex = /silence_end:\s*([0-9]+(?:\.[0-9]+)?)/g;
  const onsets: number[] = [];
  let match: RegExpExecArray | null = regex.exec(output);

  while (match) {
    onsets.push(Number(match[1]));
    match = regex.exec(output);
  }

  return onsets;
}

function createAudioWithLeader(baseAudioPath: string, outputPath: string, leaderMs: number): void {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      baseAudioPath,
      "-af",
      `adelay=${Math.max(0, Math.round(leaderMs))}`,
      "-c:a",
      "pcm_s16le",
      outputPath,
    ],
    { encoding: "utf-8" },
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg adelay failed: ${result.stderr}`);
  }
}

function writeMuxArtifact(inputPath: string, scenarioId: string): void {
  const previewDir = path.join(process.cwd(), "test-artifacts", "bdd", "real", "mux-sync", "muxed-output");
  fs.mkdirSync(previewDir, { recursive: true });

  // Always write a unique artifact to avoid EBUSY when a previous run is open in a media player.
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const uniqueOutputPath = path.join(previewDir, `${scenarioId}-${stamp}.mp4`);
  fs.copyFileSync(inputPath, uniqueOutputPath);

  // Best effort: also refresh a stable "latest" path for convenience.
  const latestOutputPath = path.join(previewDir, `${scenarioId}-latest.mp4`);
  try {
    fs.copyFileSync(inputPath, latestOutputPath);
  } catch {
    // Ignore lock errors on the convenience copy; unique artifact above is authoritative.
  }
}

Before(() => {
  state.workDir = fs.mkdtempSync(path.join(os.tmpdir(), "click-builder-real-mux-"));
});

After(() => {
  if (state.workDir && fs.existsSync(state.workDir)) {
    fs.rmSync(state.workDir, { recursive: true, force: true });
  }

  Object.keys(state).forEach((key) => delete state[key as keyof RealMuxState]);
});

Given("video sync scenario fixture {string}", (scenarioId: string) => {
  const scenario = readScenarioFromManifest(scenarioId);
  const fixturePath = path.resolve(process.cwd(), scenario.fixture_path);

  expect(fs.existsSync(fixturePath)).toBe(true);
  expect(fs.existsSync(BASE_AUDIO_PATH)).toBe(true);
  state.scenario = { ...scenario, fixture_path: fixturePath };
});

Given("section label fixture metadata {string}", (fixtureId: string) => {
  state.fixture = readFixtureFromManifest(fixtureId);
});

When("real muxing is executed for the scenario", async () => {
  const scenario = state.scenario as ScenarioManifestEntry;
  const stagedAudioPath = path.join(state.workDir as string, `${scenario.id}-audio-led.wav`);
  const outputPath = path.join(state.workDir as string, `${scenario.id}-muxed.mp4`);

  // Normalize test audio to scenario-declared leader so visible and audible downbeats align by design.
  createAudioWithLeader(BASE_AUDIO_PATH, stagedAudioPath, scenario.audio_leader_ms);

  await muxVideo({
    video_downbeat_offset_ms: scenario.signed_delta_ms,
    generated_audio_path: stagedAudioPath,
    original_video_path: scenario.fixture_path,
    output_video_path: outputPath,
  });

  state.outputPath = outputPath;
  state.starts = readStreamStarts(outputPath);
  writeMuxArtifact(outputPath, scenario.id);
});

Then("ffprobe stream start timings align with the signed delta expectation", () => {
  const scenario = state.scenario as ScenarioManifestEntry;
  const starts = state.starts as StreamStartInfo;
  const deltaSec = Math.abs(scenario.signed_delta_ms) / 1000;

  if (scenario.signed_delta_ms > 0) {
    expect(starts.audioStartSec).toBeLessThanOrEqual(START_TOLERANCE_SEC);
    expect(Math.abs(starts.videoStartSec - deltaSec)).toBeLessThanOrEqual(START_TOLERANCE_SEC);
  } else if (scenario.signed_delta_ms < 0) {
    expect(starts.videoStartSec).toBeLessThanOrEqual(START_TOLERANCE_SEC);
    expect(Math.abs(starts.audioStartSec - deltaSec)).toBeLessThanOrEqual(START_TOLERANCE_SEC);
  } else {
    expect(starts.videoStartSec).toBeLessThanOrEqual(START_TOLERANCE_SEC);
    expect(starts.audioStartSec).toBeLessThanOrEqual(START_TOLERANCE_SEC);
  }

  // Confidence guard: verify real audible click timing against scenario leader + beat duration.
  const outputPath = state.outputPath as string;
  const clickOnsets = readClickOnsetsSec(outputPath);
  expect(clickOnsets.length).toBeGreaterThanOrEqual(3);
  const firstOnset = clickOnsets[0] as number;
  const secondOnset = clickOnsets[1] as number;
  const thirdOnset = clickOnsets[2] as number;

  const expectedFirstClickSec = (scenario.audio_leader_ms + Math.max(0, -scenario.signed_delta_ms)) / 1000;
  expect(Math.abs(firstOnset - expectedFirstClickSec)).toBeLessThanOrEqual(CLICK_ONSET_TOLERANCE_SEC);

  const expectedBeatGapSec = scenario.beat_duration_ms / 1000;
  expect(Math.abs((secondOnset - firstOnset) - expectedBeatGapSec)).toBeLessThanOrEqual(CLICK_ONSET_TOLERANCE_SEC);
  expect(Math.abs((thirdOnset - secondOnset) - expectedBeatGapSec)).toBeLessThanOrEqual(CLICK_ONSET_TOLERANCE_SEC);
});

Then("section label windows match Lead Intro Verse 1 Chorus Outro boundaries", () => {
  const fixture = state.fixture as FixtureManifestEntry;
  const windows = fixture.expected_section_windows;

  expect(windows).toHaveLength(5);

  expect(windows[0]).toMatchObject({ name: "Lead", visible: false, designator: "lead", start_ms: 0, end_ms: 6000 });
  expect(windows[1]).toMatchObject({ name: "Intro", visible: true, designator: "song", start_ms: 6000, end_ms: 12000 });
  expect(windows[2]).toMatchObject({ name: "Verse 1", visible: true, designator: "song", start_ms: 12000, end_ms: 18000 });
  expect(windows[3]).toMatchObject({ name: "Chorus", visible: true, designator: "song", start_ms: 18000, end_ms: 24000 });
  expect(windows[4]).toMatchObject({ name: "Outro", visible: true, designator: "song", start_ms: 24000, end_ms: 30000 });
});
