import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

function envFlag(name: string): boolean {
  const value = process.env[`npm_config_${name}`];
  return value === "true" || value === "1" || value === "yes";
}

function collectExtraArgs(): string[] {
  return process.argv.slice(2);
}

function buildTagExpression(): string {
  const selectedTags: string[] = ["not @pending"];

  if (envFlag("real")) {
    selectedTags.push("@real");
  } else if (envFlag("mock")) {
    selectedTags.push("not @real");
  }

  if (envFlag("muxsync")) {
    selectedTags.push("@muxsync");
  }

  if (envFlag("tags")) {
    const explicit = process.env.npm_config_tags?.trim();
    if (explicit) {
      return explicit;
    }
  }

  return selectedTags.join(" and ");
}

function buildReportPath(): string {
  const baseDir = path.join("test-artifacts", "bdd");
  if (envFlag("real")) {
    if (envFlag("muxsync")) {
      return path.join(baseDir, "real", "muxsync-report.html");
    }

    return path.join(baseDir, "real", "report.html");
  }

  return path.join(baseDir, "mock", "report.html");
}

function main(): void {
  const cucumberArgs = [
    "node",
    "--loader",
    "ts-node/esm",
    "./node_modules/@cucumber/cucumber/bin/cucumber.js",
    "tests/bdd/**/*.feature",
    "--import",
    "tests/bdd/**/*.steps.ts",
    "--format",
    "pretty",
    "--tags",
    buildTagExpression(),
    "--format",
    `html:${buildReportPath()}`,
    ...collectExtraArgs(),
  ];

  fs.mkdirSync(path.join("test-artifacts", "bdd"), { recursive: true });

  const result = spawnSync(cucumberArgs[0], cucumberArgs.slice(1), {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  process.exit(result.status ?? 1);
}

main();