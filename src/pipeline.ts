import { spawn } from "child_process";
import * as path from "path";

// Helper to run a module and pipe stdin to it, returning its stdout
async function runModule(modulePath: string, args: string[], inputData: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn("npx", ["ts-node", modulePath, ...args]);
        let output = "";
        let errorOutput = "";

        proc.stdout.on("data", (data) => {
            output += data.toString();
        });

        proc.stderr.on("data", (data) => {
            errorOutput += data.toString();
            // Optional: immediately pipe stderr out to the real console so user sees logs live
            console.error(data.toString().trimEnd());
        });

        proc.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`Module ${modulePath} failed with code ${code}.\nStderr: ${errorOutput}`));
            } else {
                resolve(output);
            }
        });

        // Write the JSON payload to the child process stdin
        if (inputData) {
            proc.stdin.write(inputData);
            proc.stdin.end();
        }
    });
}

async function main() {
    console.log("=== Click Track Builder Pipeline ===");
    
    // Configs
    const configPath = "demo-config.yaml"; // Assumed file for the pipeline
    const originalVideoPath = "demo-video.mp4";
    const finalVideoPath = "out.mp4";

    const repoRoot = path.join(__dirname, "..", "..");
    const parserPath = path.join(repoRoot, "src", "parser", "cli.ts");
    const timelinePath = path.join(repoRoot, "src", "timeline", "cli.ts");
    const audioPath = path.join(repoRoot, "src", "audio", "cli.ts");
    const muxerPath = path.join(repoRoot, "src", "muxer", "cli.ts");

    try {
        console.log("\n[1/4] Running Config Parser...");
        const astJsonString = await runModule(parserPath, [configPath], "");
        const astJson = JSON.parse(astJsonString);

        console.log("\n[2/4] Running Timeline Generator...");
        const timelineJsonString = await runModule(timelinePath, [], astJsonString);
        const timelineJson = JSON.parse(timelineJsonString);

        console.log("\n[3/4] Running Audio Renderer...");
        const rendererResultString = await runModule(audioPath, [], timelineJsonString);
        const rendererResult = JSON.parse(rendererResultString);

        console.log("\n[4/4] Running Video Muxer...");
        const muxerInput = {
            video_downbeat_offset_ms: timelineJson.video_downbeat_offset_ms,
            generated_audio_path: rendererResult.generated_audio_path,
            original_video_path: originalVideoPath,
            output_video_path: finalVideoPath
        };
        const muxerResultString = await runModule(muxerPath, [], JSON.stringify(muxerInput));
        const finalResult = JSON.parse(muxerResultString);

        console.log("\n=== Pipeline Complete ===");
        console.log(finalResult);

    } catch (e) {
        console.error("\nPipeline Failed!");
        console.error(e);
        process.exit(1);
    }
}

main();