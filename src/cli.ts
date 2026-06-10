#!/usr/bin/env node
import { runPipeline } from "./pipeline.js";

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

main();
