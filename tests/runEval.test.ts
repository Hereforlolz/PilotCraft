import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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

// These three are committed evidence artifacts, not build output - a
// prior version of the fixture-mode test below unconditionally deleted
// evals/results.md and evals/results/latest.json before running, which
// destroyed real committed live-evaluation evidence the first time
// someone ran `npm test` locally. Every test in this file that touches
// them must snapshot first and restore byte-for-byte afterward, and the
// suite-level guard below independently verifies that held.
const TRACKED_EVIDENCE_FILES = [fixtureResultsPath, liveResultsPath, liveResultsJsonPath];

interface FileSnapshot {
  existed: boolean;
  content: Buffer | null;
}

function snapshotFile(filePath: string): FileSnapshot {
  if (!existsSync(filePath)) return { existed: false, content: null };
  return { existed: true, content: readFileSync(filePath) };
}

function restoreFile(filePath: string, snap: FileSnapshot) {
  if (snap.existed) {
    writeFileSync(filePath, snap.content!);
  } else if (existsSync(filePath)) {
    rmSync(filePath);
  }
}

function assertFileUnchanged(filePath: string, snap: FileSnapshot, label: string) {
  if (snap.existed) {
    assert.ok(existsSync(filePath), `${label} must still exist`);
    assert.deepEqual(readFileSync(filePath), snap.content, `${label} must not be modified`);
  } else {
    assert.ok(!existsSync(filePath), `${label} must not be created`);
  }
}

function runCli(args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--import", "tsx", runEvalPath, ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
}

// Suite-level regression guard: independent of any individual test's own
// snapshot/restore logic, this proves that running this file (and thus
// `npm test`) leaves all three tracked evidence files byte-for-byte
// exactly as they were before any test ran.
let suiteSnapshots: FileSnapshot[];

before(() => {
  suiteSnapshots = TRACKED_EVIDENCE_FILES.map(snapshotFile);
});

after(() => {
  TRACKED_EVIDENCE_FILES.forEach((filePath, i) => {
    assertFileUnchanged(filePath, suiteSnapshots[i], path.relative(repoRoot, filePath));
  });
});

test("npm run eval with no GEMINI_API_KEY and no --fixtures fails clearly instead of silently using fixtures", () => {
  const { GEMINI_API_KEY: _unused, ...envWithoutKey } = process.env;
  const result = runCli([], envWithoutKey);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /GEMINI_API_KEY is not set/);
  assert.match(result.stderr, /--fixtures/);
  // Must not have quietly run an evaluation in fixtures mode.
  assert.doesNotMatch(result.stdout, /Running \d+ scenarios/);
});

test("npm run eval -- --fixtures runs without a key, writes fixture-mode content, and leaves tracked evidence files exactly as they were", () => {
  const { GEMINI_API_KEY: _unused, ...envWithoutKey } = process.env;

  const snapshots = TRACKED_EVIDENCE_FILES.map(snapshotFile);
  const [fixtureSnap, liveMdSnap, liveJsonSnap] = snapshots;

  try {
    const result = runCli(["--fixtures"], envWithoutKey);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(fixtureResultsPath), "expected evals/fixture-results.md to be written");
    const fixtureMd = readFileSync(fixtureResultsPath, "utf8");
    assert.match(fixtureMd, /Mode: \*\*fixtures\*\*/);

    // Fixture mode must never create or modify the files reserved for live
    // results - asserted directly (byte-for-byte against a snapshot taken
    // before the run), not inferred from having deleted them beforehand.
    assertFileUnchanged(liveResultsPath, liveMdSnap, "evals/results.md");
    assertFileUnchanged(liveResultsJsonPath, liveJsonSnap, "evals/results/latest.json");
  } finally {
    // Restore every snapshotted file byte-for-byte, including
    // fixture-results.md itself: the CLI legitimately rewrites it (that's
    // what this test exercises), but a tracked evidence file's committed
    // content shouldn't come out of `npm test` looking different from what
    // was checked in. Restore original content when a file existed before,
    // remove it only when it didn't.
    restoreFile(fixtureResultsPath, fixtureSnap);
    restoreFile(liveResultsPath, liveMdSnap);
    restoreFile(liveResultsJsonPath, liveJsonSnap);
  }
});
