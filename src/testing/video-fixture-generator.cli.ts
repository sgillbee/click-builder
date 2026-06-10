import * as fs from "fs";
import * as path from "path";
import {
  generateVideoSyncFixtures,
  getDefaultFixtureGeneratorConfig,
  type FixtureGeneratorConfig,
} from "./video-fixture-generator.js";

function loadConfig(configArg?: string): FixtureGeneratorConfig {
  const defaults = getDefaultFixtureGeneratorConfig();
  if (!configArg) {
    return defaults;
  }

  const configPath = path.resolve(configArg);
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<FixtureGeneratorConfig> & {
    pulse_style?: FixtureGeneratorConfig["pulseStyle"];
  };

  return {
    outputDir: parsed.outputDir ?? defaults.outputDir,
    frameRate: parsed.frameRate ?? defaults.frameRate,
    resolution: parsed.resolution ?? defaults.resolution,
    tempos: parsed.tempos ?? defaults.tempos,
    previewEnabled: parsed.previewEnabled ?? defaults.previewEnabled,
    previewDir: parsed.previewDir ?? defaults.previewDir,
    pulseStyle: parsed.pulseStyle ?? parsed.pulse_style ?? defaults.pulseStyle,
  };
}

function main(): void {
  try {
    const configArg = process.argv[2];
    const config = loadConfig(configArg);
    const manifest = generateVideoSyncFixtures(config);

    console.log(
      JSON.stringify(
        {
          success: true,
          output_dir: config.outputDir,
          fixture_count: manifest.fixtures.length,
          scenario_count: manifest.scenarios.length,
          manifest_path: path.join(config.outputDir, "manifest.json").replaceAll("\\", "/"),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("[video-fixture-generator] Failed to generate fixtures");
    console.error(error);
    process.exit(1);
  }
}

main();
