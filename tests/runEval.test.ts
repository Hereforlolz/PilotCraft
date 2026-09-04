import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Regression coverage for the eval CLI's safety behavior: it must never
// silently substitute canned fixtures for a missing GEMINI_API_KEY, and
// fixture-mode output must never land in the files reserved for live
// results. These spawn the real script (tsx evals/runEval.ts) rather than
// importing it, since the module runs its argument/env gate as a
// top-level side effect.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runEvalPath = path.join(repoRoot, "evals", "runEval.ts");
const fixtureResultsPath = path.join(repoRoot, "evals", "fixture-results.md");
const liveResultsPath = path.join(repoRoot, "evals", "results.md");
const liveResultsJsonPath = path.join(repoRoot, "evals", "results", "latest.json");

function runCli(args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--import", "tsx", runEvalPath, ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
}

test("npm run eval with no GEMINI_API_KEY and no --fixtures fails clearly instead of silently using fixtures", () => {
  const { GEMINI_API_KEY: _unused, ...envWithoutKey } = process.env;
  const result = runCli([], envWithoutKey);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /GEMINI_API_KEY is not set/);
  assert.match(result.stderr, /--fixtures/);
  // Must not have quietly run an evaluation in fixtures mode.
  assert.doesNotMatch(result.stdout, /Running \d+ scenarios/);
});

test("npm run eval -- --fixtures runs without a key and writes only evals/fixture-results.md", () => {
  const { GEMINI_API_KEY: _unused, ...envWithoutKey } = process.env;
  if (existsSync(liveResultsPath)) rmSync(liveResultsPath);
  if (existsSync(liveResultsJsonPath)) rmSync(liveResultsJsonPath);

  const result = runCli(["--fixtures"], envWithoutKey);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(fixtureResultsPath), "expected evals/fixture-results.md to be written");
  const fixtureMd = readFileSync(fixtureResultsPath, "utf8");
  assert.match(fixtureMd, /Mode: \*\*fixtures\*\*/);

  // Fixture mode must never touch the files reserved for live results.
  assert.ok(!existsSync(liveResultsPath), "fixture mode must not write evals/results.md");
  assert.ok(!existsSync(liveResultsJsonPath), "fixture mode must not write evals/results/latest.json");
});
