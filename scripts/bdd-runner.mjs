import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

function envFlag(name) {
  const value = process.env[`npm_config_${name}`];
  return value === "true" || value === "1" || value === "yes";
}

function collectExtraArgs() {
  return process.argv.slice(2);
}

function buildTagExpression() {
  const selectedTags = ["not @pending"];

  if (envFlag("real")) {
    selectedTags.push("@real");
  } else if (envFlag("mock")) {
    selectedTags.push("not @real");
  }

  if (envFlag("muxsync")) {
    selectedTags.push("@muxsync");
  }

  const explicitTags = process.env.npm_config_tags?.trim();
  if (explicitTags) {
    return explicitTags;
  }

  return selectedTags.join(" and ");
}

function buildReportPath() {
  const baseDir = path.join("test-artifacts", "bdd");
  if (envFlag("real")) {
    if (envFlag("muxsync")) {
      return path.join(baseDir, "real", "muxsync-report.html");
    }

    return path.join(baseDir, "real", "report.html");
  }

  return path.join(baseDir, "mock", "report.html");
}

function main() {
  fs.mkdirSync(path.join("test-artifacts", "bdd"), { recursive: true });

  const args = [
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

  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  process.exit(result.status ?? 1);
}

main();