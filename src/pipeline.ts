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

    const finalVideoPath = await mux({
        video_downbeat_offset_ms: timeline.video_downbeat_offset_ms,
        generated_audio_path: audioPath,
        original_video_path: originalVideoPath,
        output_video_path: outputVideoPath,
    });

    return finalVideoPath;
}

function isDirectExecution(): boolean {
    if (!process.argv[1]) {
        return false;
    }

    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

async function main() {
    const configPath = process.argv[2];
    const originalVideoPath = process.argv[3];
    const outputVideoPath = process.argv[4];

    if (!configPath || !originalVideoPath || !outputVideoPath) {
        console.error("Usage: node pipeline.ts <config.yaml> <input-video> <output-video>");
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