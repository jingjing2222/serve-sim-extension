#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Keep this package as an explicit release-tooling dependency. Changesets'
// apply-release-plan package is the upstream code that writes changelog entries
// with `## ${version}` headings and inserts them above existing version headings.
export const changesetsApplyReleasePlanEntry = require.resolve("@changesets/apply-release-plan");

const changesetsVersionHeadingPattern = /^#{1,6}\s+\d+\.\d+/;

export function extractReleaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => isHeadingForVersion(line, version));

  if (start === -1) {
    throw new Error(`Could not find CHANGELOG.md section for version ${version}.`);
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (changesetsVersionHeadingPattern.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  }

  const section = lines.slice(start, end).join("\n").trim();
  if (!section) {
    throw new Error(`CHANGELOG.md section for version ${version} was empty.`);
  }
  return `${section}\n`;
}

export function readReleaseVersion(packageJsonPath = "package.json") {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (typeof packageJson.version !== "string" || !packageJson.version) {
    throw new Error(`${packageJsonPath} must include a version string.`);
  }
  return packageJson.version;
}

function isHeadingForVersion(line, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^#{1,6}\\s+${escaped}\\s*$`).test(line);
}

function parseArgs(argv) {
  const options = {
    changelog: "CHANGELOG.md",
    packageJson: "package.json",
    out: "release-notes.md",
    version: undefined,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--") {
      continue;
    } else if (arg === "--changelog" && next) {
      options.changelog = next;
      index++;
    } else if (arg === "--package-json" && next) {
      options.packageJson = next;
      index++;
    } else if (arg === "--out" && next) {
      options.out = next;
      index++;
    } else if (arg === "--version" && next) {
      options.version = next;
      index++;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const version = options.version ?? readReleaseVersion(options.packageJson);
  const changelog = readFileSync(options.changelog, "utf8");
  const releaseNotes = extractReleaseNotes(changelog, version);
  writeFileSync(options.out, releaseNotes);
  process.stdout.write(`Wrote ${options.out} for ${version}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
