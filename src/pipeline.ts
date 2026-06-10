#!/usr/bin/env node
import * as fs from "fs";
import { fileURLToPath } from "url";
import * as path from "path";
import { parseConfigToAst } from "./parser/parser.js";
import { generateTimeline } from "./timeline/generator.js";
import { renderAudio } from "./audio/renderer.js";
import { muxVideo } from "./muxer/muxer.js";
import type { AstJson, TimelineJson } from "./contracts.js";
import type { MuxerInput } from "./muxer/contracts.js";

export interface PipelineDependencies {
    parse: (yamlContent: string) => AstJson;
    timeline: (ast: AstJson) => TimelineJson;
    render: (timeline: TimelineJson) => Promise<string>;
    mux: (input: MuxerInput) => Promise<string>;
}

function sectionDurationMs(command: AstJson["timeline_commands"][number]): number {
    const beatsPerMeasure = command.meter[0];
    const beatType = command.meter[1];
    const quarterNoteDurationMs = 60000 / command.bpm;
    const beatDurationMs = quarterNoteDurationMs * (4 / beatType);
    const finalBeats = command.final_measure_beats === undefined
        ? beatsPerMeasure
        : Math.min(beatsPerMeasure, Math.max(1, command.final_measure_beats));
    const fullMeasures = Math.max(0, command.measures - 1);

    return (fullMeasures * beatsPerMeasure + finalBeats) * beatDurationMs;
}

function computeClickLeaderMs(ast: AstJson): number {
    let leaderMs = 0;

    for (const command of ast.timeline_commands) {
        if ((command.section_designator ?? "song") !== "click") {
            break;
        }

        leaderMs += sectionDurationMs(command);
    }

    return leaderMs;
}

export function computeLeaderAwareDeltaMs(ast: AstJson, timeline: TimelineJson): {
    first_click_timestamp_ms: number;
    effective_signed_delta_ms: number;
} {
    const clickEvents = timeline.events.filter((event) => event.stem === "click");
    if (clickEvents.length === 0) {
        throw new Error("[pipeline] Cannot compute leader-aware delta: timeline has no click events.");
    }

    const clickLeaderMs = computeClickLeaderMs(ast);
    // Represent first click relative to song downbeat; click-intro appears as a negative timestamp.
    const firstClickTimestampMs = -clickLeaderMs;
    const effectiveSignedDeltaMs = clickLeaderMs - timeline.video_downbeat_offset_ms;

    return {
        first_click_timestamp_ms: firstClickTimestampMs,
        effective_signed_delta_ms: effectiveSignedDeltaMs,
    };
}

export async function runPipeline(
    configPath: string,
    originalVideoPath: string,
    outputVideoPath: string,
    deps: Partial<PipelineDependencies> = {}
): Promise<string> {
    const yamlContent = fs.readFileSync(configPath, "utf-8");
    const parse = deps.parse ?? parseConfigToAst;
    const timelineBuilder = deps.timeline ?? generateTimeline;
    const render = deps.render ?? renderAudio;
    const mux = deps.mux ?? muxVideo;

    const ast = parse(yamlContent);
    const timeline = timelineBuilder(ast);
    const audioPath = await render(timeline);
    const leaderAware = computeLeaderAwareDeltaMs(ast, timeline);

    console.error(
        `[pipeline] leader-aware-mux: video_downbeat_offset_ms=${timeline.video_downbeat_offset_ms.toFixed(3)} ` +
        `first_click_timestamp_ms=${leaderAware.first_click_timestamp_ms.toFixed(3)} ` +
        `effective_signed_delta_ms=${leaderAware.effective_signed_delta_ms.toFixed(3)}`
    );

    const finalVideoPath = await mux({
        video_downbeat_offset_ms: timeline.video_downbeat_offset_ms,
        first_click_timestamp_ms: leaderAware.first_click_timestamp_ms,
        effective_signed_delta_ms: leaderAware.effective_signed_delta_ms,
        generated_audio_path: audioPath,
        original_video_path: originalVideoPath,
        output_video_path: outputVideoPath,
    });

    return finalVideoPath;
}

function isDirectExecution(): boolean {
    const argv1 = process.argv[1];
    if (!argv1) {
        return false;
    }

    const entryPath = path.resolve(argv1);
    const modulePath = fileURLToPath(import.meta.url);
    const normalizeForCompare = (value: string) =>
        process.platform === "win32" ? path.normalize(value).toLowerCase() : path.normalize(value);

    if (normalizeForCompare(entryPath) === normalizeForCompare(modulePath)) {
        return true;
    }

    // npm global bin shims on Windows can invoke this module indirectly.
    // In that case argv[1] can be click-builder(.cmd) instead of dist/pipeline.js.
    const entryName = path.basename(argv1).toLowerCase();
    return entryName === "click-builder" || entryName === "click-builder.cmd";
}

async function main() {
    const configPath = process.argv[2];
    const originalVideoPath = process.argv[3];
    const outputVideoPath = process.argv[4];

    if (!configPath || !originalVideoPath || !outputVideoPath) {
        console.error("Usage: click-builder <config.yaml> <input-video> <output-video>");
        process.exit(1);
    }

    try {
        console.error(`[pipeline] Starting click-track build for ${configPath}`);
        const finalVideoPath = await runPipeline(configPath, originalVideoPath, outputVideoPath);
        console.log(JSON.stringify({ final_video: finalVideoPath }, null, 2));
        process.exit(0);
    } catch (error) {
        console.error("[pipeline] Failed to build click-track video");
        console.error(error);
        process.exit(1);
    }
}

if (isDirectExecution()) {
    main();
}