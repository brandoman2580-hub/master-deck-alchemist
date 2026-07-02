#!/usr/bin/env node
/**
 * Blocks commits that stage docs/ files not listed in docs/.tracked.
 * Run via: npm run docs:check (also wired into pre-commit).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "docs", ".tracked");

/** @param {string} content */
function parseManifest(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function getStagedFiles() {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf8",
      cwd: ROOT,
    });
    return output.split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const manifest = fs.readFileSync(MANIFEST_PATH, "utf8");
  const tracked = new Set(parseManifest(manifest));
  const allowed = new Set(["docs/.tracked"]);

  for (const relativePath of tracked) {
    allowed.add(`docs/${relativePath.replace(/\\/g, "/")}`);
  }

  const violations = getStagedFiles().filter(
    (file) => file.startsWith("docs/") && !allowed.has(file),
  );

  if (violations.length === 0) {
    return;
  }

  console.error("Commit blocked: staged docs/ files are not in docs/.tracked:\n");
  for (const file of violations) {
    console.error(`  - ${file}`);
  }
  console.error(
    "\nDocs are local by default. To track a build-required doc, add its path to docs/.tracked",
  );
  console.error("and run: npm run docs:git-sync\n");
  process.exit(1);
}

main();
