import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

export interface BeatConfig {
  meter: [number, number];
  bpm: number;
}

export interface FixtureDefinition {
  id: string;
  beat: BeatConfig;
  frameRate: number;
  resolution: { width: number; height: number };
  leaderBeats: number;
  songMeasures: number;
  trailingBeats: number;
  sections?: SectionWindowDefinition[];
}

export interface SectionWindowDefinition {
  name: string;
  measures: number;
  designator?: "song" | "lead" | "click";
}

export interface ScenarioDefinition {
  id: string;
  fixtureId: string;
  audioLeaderMs: number;
  videoLeaderMs: number;
  referenceAudioPath?: string;
}

export interface FixtureGeneratorConfig {
  outputDir: string;
  frameRate: number;
  resolution: { width: number; height: number };
  tempos: number[];
  previewEnabled: boolean;
  previewDir: string;
  pulseStyle: PulseStyle;
}

export type PulseStyle = "fullscreen" | "corner_decay";

interface ManifestFixture {
  id: string;
  path: string;
  meter: string;
  bpm: number;
  frame_rate: number;
  resolution: string;
  leader_ms: number;
  beat_duration_ms: number;
  measure_duration_ms: number;
  expected_pulse_timestamps_ms: number[];
  expected_downbeat_timestamps_ms: number[];
  expected_section_windows: Array<{
    name: string;
    start_ms: number;
    end_ms: number;
    visible: boolean;
    designator: "song" | "lead" | "click";
  }>;
}

interface ManifestScenario {
  id: string;
  fixture_id: string;
  fixture_path: string;
  audio_leader_ms: number;
  video_leader_ms: number;
  signed_delta_ms: number;
  reference_audio_path?: string;
}

interface FixtureManifest {
  generated_at: string;
  defaults: {
    frame_rate: number;
    resolution: string;
    pixel_format: string;
    video_codec: string;
    pulse_style: PulseStyle;
  };
  fixtures: ManifestFixture[];
  scenarios: ManifestScenario[];
}

const DEFAULT_FRAME_RATE = 60;
const DEFAULT_RESOLUTION = { width: 640, height: 360 };
const DEFAULT_TRAILING_BEATS = 1;
const DEFAULT_SONG_MEASURES = 2;

function runCommand(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "pipe" });
  if (result.status !== 0) {
    const stderr = result.stderr.toString();
    throw new Error(`${command} failed with code ${result.status}: ${stderr}`);
  }
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function computeBeatDurationMs(bpm: number, beatType: number): number {
  const quarterNoteMs = 60000 / bpm;
  return quarterNoteMs * (4 / beatType);
}

function expectedPulseTimesMs(fixture: FixtureDefinition): { beatTimes: number[]; downbeatTimes: number[] } {
  const beatsPerMeasure = fixture.beat.meter[0];
  const beatDurationMs = computeBeatDurationMs(fixture.beat.bpm, fixture.beat.meter[1]);
  const leaderMs = fixture.leaderBeats * beatDurationMs;
  const songBeats = totalSongMeasures(fixture) * beatsPerMeasure;

  const beatTimes: number[] = [];
  const downbeatTimes: number[] = [];

  for (let i = 0; i < songBeats; i++) {
    const ts = round6(leaderMs + i * beatDurationMs);
    beatTimes.push(ts);
    if (i % beatsPerMeasure === 0) {
      downbeatTimes.push(ts);
    }
  }

  return { beatTimes, downbeatTimes };
}

function totalSongMeasures(fixture: FixtureDefinition): number {
  if (fixture.sections && fixture.sections.length > 0) {
    return fixture.sections.reduce((sum, section) => sum + section.measures, 0);
  }

  return fixture.songMeasures;
}

function sectionWindowsMs(fixture: FixtureDefinition): Array<{
  name: string;
  start_ms: number;
  end_ms: number;
  visible: boolean;
  designator: "song" | "lead" | "click";
}> {
  if (!fixture.sections || fixture.sections.length === 0) {
    return [];
  }

  const beatDurationMs = computeBeatDurationMs(fixture.beat.bpm, fixture.beat.meter[1]);
  const measureDurationMs = beatDurationMs * fixture.beat.meter[0];
  let cursorMs = fixture.leaderBeats * beatDurationMs;

  return fixture.sections.map((section) => {
    const designator = section.designator ?? "song";
    const startMs = cursorMs;
    const endMs = cursorMs + section.measures * measureDurationMs;
    cursorMs = endMs;

    return {
      name: section.name,
      start_ms: round6(startMs),
      end_ms: round6(endMs),
      visible: designator === "song",
      designator,
    };
  });
}

function buildFixtureDurationSeconds(fixture: FixtureDefinition): number {
  const beatsPerMeasure = fixture.beat.meter[0];
  const beatDurationMs = computeBeatDurationMs(fixture.beat.bpm, fixture.beat.meter[1]);
  const totalBeats = fixture.leaderBeats + totalSongMeasures(fixture) * beatsPerMeasure + fixture.trailingBeats;
  return round6((totalBeats * beatDurationMs) / 1000);
}

function escapeDrawText(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,");
}

function resolveDrawTextFontArg(fileExists: (fontPath: string) => boolean = fs.existsSync): string {
  const candidates = [
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  ];

  const selected = candidates.find((fontPath) => fileExists(fontPath));
  if (!selected) {
    throw new Error("No supported drawtext font file found on this host.");
  }

  const normalized = selected.replaceAll("\\", "/").replaceAll(":", "\\:");
  return `fontfile='${normalized}'`;
}

function buildVideoFilter(
  fixture: FixtureDefinition,
  options?: {
    pulseStyle?: PulseStyle;
    fontArgProvider?: () => string;
  },
): string {
  const beatsPerMeasure = fixture.beat.meter[0];
  const beatDurationSec = computeBeatDurationMs(fixture.beat.bpm, fixture.beat.meter[1]) / 1000;
  const measureDurationSec = beatDurationSec * beatsPerMeasure;
  const leaderSec = (fixture.leaderBeats * computeBeatDurationMs(fixture.beat.bpm, fixture.beat.meter[1])) / 1000;
  const pulseStyle = options?.pulseStyle ?? "corner_decay";
  const fontArgProvider = options?.fontArgProvider ?? (() => resolveDrawTextFontArg());

  const leaderStr = leaderSec.toFixed(6);
  const beatDurStr = beatDurationSec.toFixed(6);
  const measureDurStr = measureDurationSec.toFixed(6);
  const beatPhase = `mod(t-${leaderStr},${beatDurStr})`;
  const measurePhase = `mod(t-${leaderStr},${measureDurStr})`;

  const beatPulse = `gte(t,${leaderStr})*lt(${beatPhase},${(1 / fixture.frameRate).toFixed(6)})`;
  const downbeatPulse = `gte(t,${leaderStr})*lt(${measurePhase},${(1 / fixture.frameRate).toFixed(6)})`;

  const filters: string[] = [];

  if (pulseStyle === "fullscreen") {
    filters.push(
      `drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='${beatPulse}'`,
      `drawbox=x=0:y=0:w=iw:h=ih:color=yellow:t=fill:enable='${downbeatPulse}'`,
    );
  } else {
    const cornerX = "iw-80";
    const cornerY = "16";
    const cornerW = "64";
    const cornerH = "64";

    filters.push(
      `drawbox=x=${cornerX}:y=${cornerY}:w=${cornerW}:h=${cornerH}:color=black@0.35:t=fill`,
      `drawbox=x=${cornerX}:y=${cornerY}:w=${cornerW}:h=${cornerH}:color=white@0.70:t=fill:enable='gte(t,${leaderStr})*lt(${beatPhase},0.040000)'`,
      `drawbox=x=${cornerX}:y=${cornerY}:w=${cornerW}:h=${cornerH}:color=white@0.40:t=fill:enable='gte(t,${leaderStr})*gte(${beatPhase},0.040000)*lt(${beatPhase},0.080000)'`,
      `drawbox=x=${cornerX}:y=${cornerY}:w=${cornerW}:h=${cornerH}:color=white@0.20:t=fill:enable='gte(t,${leaderStr})*gte(${beatPhase},0.080000)*lt(${beatPhase},0.120000)'`,
      `drawbox=x=${cornerX}:y=${cornerY}:w=${cornerW}:h=${cornerH}:color=yellow@0.85:t=fill:enable='gte(t,${leaderStr})*lt(${measurePhase},0.060000)'`,
      `drawbox=x=${cornerX}:y=${cornerY}:w=${cornerW}:h=${cornerH}:color=yellow@0.55:t=fill:enable='gte(t,${leaderStr})*gte(${measurePhase},0.060000)*lt(${measurePhase},0.120000)'`,
      `drawbox=x=${cornerX}:y=${cornerY}:w=${cornerW}:h=${cornerH}:color=yellow@0.30:t=fill:enable='gte(t,${leaderStr})*gte(${measurePhase},0.120000)*lt(${measurePhase},0.180000)'`,
    );
  }

  const fontArg = fontArgProvider();

  for (const section of sectionWindowsMs(fixture)) {
    if (!section.visible) {
      continue;
    }

    const text = escapeDrawText(section.name);
    const startSec = (section.start_ms / 1000).toFixed(6);
    const endSec = (section.end_ms / 1000).toFixed(6);
    filters.push(
      `drawtext=${fontArg}:fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h*0.08:text='${text}':enable='between(t,${startSec},${endSec})'`,
    );
  }

  return filters.join(",");
}

function buildFixtureDefinitions(config: FixtureGeneratorConfig): FixtureDefinition[] {
  const baseline: FixtureDefinition[] = [];
  for (const bpm of config.tempos) {
    baseline.push({
      id: `baseline-4-4-${bpm}`,
      beat: { meter: [4, 4], bpm },
      frameRate: config.frameRate,
      resolution: config.resolution,
      leaderBeats: 2,
      songMeasures: DEFAULT_SONG_MEASURES,
      trailingBeats: DEFAULT_TRAILING_BEATS,
    });

    baseline.push({
      id: `baseline-6-8-${bpm}`,
      beat: { meter: [6, 8], bpm },
      frameRate: config.frameRate,
      resolution: config.resolution,
      leaderBeats: 2,
      songMeasures: DEFAULT_SONG_MEASURES,
      trailingBeats: DEFAULT_TRAILING_BEATS,
    });
  }

  const scenarios: FixtureDefinition[] = [
    {
      id: "scenario-d0-4-4-80",
      beat: { meter: [4, 4], bpm: 80 },
      frameRate: config.frameRate,
      resolution: config.resolution,
      leaderBeats: 2,
      songMeasures: DEFAULT_SONG_MEASURES,
      trailingBeats: DEFAULT_TRAILING_BEATS,
    },
    {
      id: "scenario-dpos-4-4-80",
      beat: { meter: [4, 4], bpm: 80 },
      frameRate: config.frameRate,
      resolution: config.resolution,
      leaderBeats: 1,
      songMeasures: DEFAULT_SONG_MEASURES,
      trailingBeats: DEFAULT_TRAILING_BEATS,
    },
    {
      id: "scenario-dneg-4-4-80",
      beat: { meter: [4, 4], bpm: 80 },
      frameRate: config.frameRate,
      resolution: config.resolution,
      leaderBeats: 3,
      songMeasures: DEFAULT_SONG_MEASURES,
      trailingBeats: DEFAULT_TRAILING_BEATS,
    },
  ];

  const sectionOverlayFixture: FixtureDefinition = {
    id: "sections-4-4-80",
    beat: { meter: [4, 4], bpm: 80 },
    frameRate: config.frameRate,
    resolution: config.resolution,
    leaderBeats: 0,
    songMeasures: 10,
    trailingBeats: DEFAULT_TRAILING_BEATS,
    sections: [
      { name: "Lead", measures: 2, designator: "lead" },
      { name: "Intro", measures: 2, designator: "song" },
      { name: "Verse 1", measures: 2, designator: "song" },
      { name: "Chorus", measures: 2, designator: "song" },
      { name: "Outro", measures: 2, designator: "song" },
    ],
  };

  const complexSectionOverlayFixture: FixtureDefinition = {
    id: "sections-6-8-70",
    beat: { meter: [6, 8], bpm: 70 },
    frameRate: config.frameRate,
    resolution: config.resolution,
    leaderBeats: 1,
    songMeasures: 24,
    trailingBeats: DEFAULT_TRAILING_BEATS,
    sections: [
      { name: "Click", measures: 2, designator: "click" },
      { name: "Intro", measures: 2, designator: "song" },
      { name: "Verse 1", measures: 2, designator: "song" },
      { name: "Chorus", measures: 2, designator: "song" },
      { name: "Interlude", measures: 1, designator: "song" },
      { name: "Verse 2", measures: 2, designator: "song" },
      { name: "Chorus", measures: 2, designator: "song" },
      { name: "Bridge 1", measures: 2, designator: "song" },
      { name: "Bridge 2", measures: 2, designator: "song" },
      { name: "Instrumental", measures: 2, designator: "song" },
      { name: "Chorus", measures: 2, designator: "song" },
      { name: "Outro", measures: 3, designator: "song" },
    ],
  };

  return [...baseline, ...scenarios, sectionOverlayFixture, complexSectionOverlayFixture];
}

function buildScenarioDefinitions(fixtures: FixtureDefinition[]): ScenarioDefinition[] {
  const byId = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const audioLeaderMs = 1500;

  const defs: ScenarioDefinition[] = [
    { id: "d0", fixtureId: "scenario-d0-4-4-80", audioLeaderMs, videoLeaderMs: 1500 },
    { id: "dpos", fixtureId: "scenario-dpos-4-4-80", audioLeaderMs, videoLeaderMs: 750 },
    { id: "dneg", fixtureId: "scenario-dneg-4-4-80", audioLeaderMs, videoLeaderMs: 2250 },
    {
      id: "complex-6-8",
      fixtureId: "sections-6-8-70",
      audioLeaderMs: 428.571429,
      videoLeaderMs: 428.571429,
      referenceAudioPath: "tests/fixtures/golden/complex-6-8-click-cues.wav",
    },
  ];

  for (const def of defs) {
    if (!byId.has(def.fixtureId)) {
      throw new Error(`Scenario fixture not found: ${def.fixtureId}`);
    }
  }

  return defs;
}

function generateFixtureMp4(fixture: FixtureDefinition, outputDir: string, pulseStyle: PulseStyle): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${fixture.id}.mp4`);
  const durationSec = buildFixtureDurationSeconds(fixture);
  const filter = buildVideoFilter(fixture, { pulseStyle });

  runCommand("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${fixture.resolution.width}x${fixture.resolution.height}:r=${fixture.frameRate}:d=${durationSec.toFixed(6)}`,
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    `${fixture.frameRate}`,
    "-x264-params",
    `scenecut=0:keyint=${fixture.frameRate}:min-keyint=${fixture.frameRate}`,
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  return outputPath;
}

function createPreviewIfEnabled(config: FixtureGeneratorConfig, videoPath: string): void {
  if (!config.previewEnabled) {
    return;
  }

  fs.mkdirSync(config.previewDir, { recursive: true });
  const previewOutput = path.join(config.previewDir, path.basename(videoPath));
  fs.copyFileSync(videoPath, previewOutput);
}

function toMeterString(meter: [number, number]): string {
  return `${meter[0]}/${meter[1]}`;
}

export function getDefaultFixtureGeneratorConfig(): FixtureGeneratorConfig {
  return {
    outputDir: path.join("tests", "fixtures", "video-sync"),
    frameRate: DEFAULT_FRAME_RATE,
    resolution: DEFAULT_RESOLUTION,
    tempos: [70, 80, 120],
    previewEnabled: false,
    previewDir: path.join("test-artifacts", "bdd", "real", "video-sync", "fixtures"),
    pulseStyle: "corner_decay",
  };
}

export function generateVideoSyncFixtures(config: FixtureGeneratorConfig): FixtureManifest {
  const fixtures = buildFixtureDefinitions(config);
  const scenarios = buildScenarioDefinitions(fixtures);

  const manifestFixtures: ManifestFixture[] = [];

  for (const fixture of fixtures) {
    const outputPath = generateFixtureMp4(fixture, config.outputDir, config.pulseStyle);
    createPreviewIfEnabled(config, outputPath);

    const beatDurationMs = computeBeatDurationMs(fixture.beat.bpm, fixture.beat.meter[1]);
    const measureDurationMs = beatDurationMs * fixture.beat.meter[0];
    const leaderMs = fixture.leaderBeats * beatDurationMs;
    const pulses = expectedPulseTimesMs(fixture);

    manifestFixtures.push({
      id: fixture.id,
      path: outputPath.replaceAll("\\", "/"),
      meter: toMeterString(fixture.beat.meter),
      bpm: fixture.beat.bpm,
      frame_rate: fixture.frameRate,
      resolution: `${fixture.resolution.width}x${fixture.resolution.height}`,
      leader_ms: round6(leaderMs),
      beat_duration_ms: round6(beatDurationMs),
      measure_duration_ms: round6(measureDurationMs),
      expected_pulse_timestamps_ms: pulses.beatTimes,
      expected_downbeat_timestamps_ms: pulses.downbeatTimes,
      expected_section_windows: sectionWindowsMs(fixture),
    });
  }

  const fixtureById = new Map(manifestFixtures.map((fixture) => [fixture.id, fixture]));

  const manifestScenarios: ManifestScenario[] = scenarios.map((scenario) => {
    const fixture = fixtureById.get(scenario.fixtureId);
    if (!fixture) {
      throw new Error(`Missing manifest fixture for scenario: ${scenario.id}`);
    }

    return {
      id: scenario.id,
      fixture_id: scenario.fixtureId,
      fixture_path: fixture.path,
      audio_leader_ms: scenario.audioLeaderMs,
      video_leader_ms: scenario.videoLeaderMs,
      signed_delta_ms: scenario.audioLeaderMs - scenario.videoLeaderMs,
      ...(scenario.referenceAudioPath ? { reference_audio_path: scenario.referenceAudioPath } : {}),
    };
  });

  const manifest: FixtureManifest = {
    generated_at: new Date().toISOString(),
    defaults: {
      frame_rate: config.frameRate,
      resolution: `${config.resolution.width}x${config.resolution.height}`,
      pixel_format: "yuv420p",
      video_codec: "libx264",
      pulse_style: config.pulseStyle,
    },
    fixtures: manifestFixtures,
    scenarios: manifestScenarios,
  };

  const manifestPath = path.join(config.outputDir, "manifest.json");
  fs.mkdirSync(config.outputDir, { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  return manifest;
}

export const __testables = {
  computeBeatDurationMs,
  expectedPulseTimesMs,
  totalSongMeasures,
  sectionWindowsMs,
  buildFixtureDurationSeconds,
  escapeDrawText,
  resolveDrawTextFontArg,
  buildVideoFilter,
};
