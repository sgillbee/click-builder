#!/usr/bin/env node
import { runPipeline } from "./pipeline.js";

async function main() {
  const rawArgs = process.argv.slice(2);
  const allowReencodePositiveDelay = rawArgs.includes("--allow-reencode");
  const positionalArgs = rawArgs.filter((arg) => arg !== "--allow-reencode");
  const configPath = positionalArgs[0];
  const originalVideoPath = positionalArgs[1];
  const outputVideoPath = positionalArgs[2];

  if (!configPath) {
    console.error("Usage: click-builder [--allow-reencode] <config.yaml> [input-video] [output-video]");
    console.error("Video paths may also be supplied in YAML, with CLI taking precedence.");
    process.exit(1);
  }

  try {
    console.error(`[pipeline] Starting click-track build for ${configPath}`);
    const finalVideoPath = await runPipeline(
      configPath,
      originalVideoPath,
      outputVideoPath,
      {},
      { allowReencodePositiveDelay }
    );
    console.log(JSON.stringify({ final_video: finalVideoPath }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("[pipeline] Failed to build click-track video");
    console.error(error);
    process.exit(1);
  }
}

main();
