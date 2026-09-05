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
// someone ran `npm test` locally. Every spawned-CLI test in this file
// must snapshot first and restore byte-for-byte afterward (including on
// failure), and the suite-level guard below independently verifies that
// held.
const TRACKED_EVIDENCE_FILES = [fixtureResultsPath, liveResultsPath, liveResultsJsonPath];

// A generous ceiling for a process that should fail its own argument/env
// check before doing any work - miles below the ~86s a real 9-scenario
// live evaluation takes, so a regression back to actually calling Gemini
// shows up as a timing failure even if some other assertion were to miss it.
const FAST_FAIL_CEILING_MS = 15_000;

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

function snapshotEvidenceFiles(): FileSnapshot[] {
  return TRACKED_EVIDENCE_FILES.map(snapshotFile);
}

function restoreEvidenceFiles(snapshots: FileSnapshot[]) {
  TRACKED_EVIDENCE_FILES.forEach((filePath, i) => restoreFile(filePath, snapshots[i]));
}

function assertEvidenceFilesUnchanged(snapshots: FileSnapshot[]) {
  TRACKED_EVIDENCE_FILES.forEach((filePath, i) => {
    assertFileUnchanged(filePath, snapshots[i], path.relative(repoRoot, filePath));
  });
}

// Explicitly defines GEMINI_API_KEY as an empty string rather than omitting
// it. dotenv.config() (called at the top of evals/runEval.ts) only fills in
// a key that is *absent* from process.env - an empty string still counts as
// "already defined" and is left alone (dotenv's `populate()` checks
// `hasOwnProperty`, not truthiness, and only overwrites when `override:
// true` is passed, which runEval.ts does not do). Simply deleting the key
// from the spawned env (the previous approach) left it absent, so on a
// developer machine with a real .env, dotenv re-populated it from disk and
// the "no key" test silently ran the full live evaluation instead of
// failing fast.
function envWithBlankKey(): NodeJS.ProcessEnv {
  return { ...process.env, GEMINI_API_KEY: "" };
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
  suiteSnapshots = snapshotEvidenceFiles();
});

after(() => {
  assertEvidenceFilesUnchanged(suiteSnapshots);
});

test("npm run eval with no usable GEMINI_API_KEY and no --fixtures fails fast instead of falling back to a real .env's key", () => {
  const snapshots = snapshotEvidenceFiles();

  try {
    const startedAt = Date.now();
    const result = runCli([], envWithBlankKey());
    const durationMs = Date.now() - startedAt;

    assert.equal(result.status, 1);
    assert.match(result.stderr, /GEMINI_API_KEY is not set/);
    assert.match(result.stderr, /--fixtures/);
    // Must not have quietly run an evaluation - neither in fixtures mode
    // nor (the regression this guards against) a real live run against
    // whatever key a developer's own .env happens to define.
    assert.doesNotMatch(result.stdout, /Running \d+ scenarios/);
    assert.ok(
      durationMs < FAST_FAIL_CEILING_MS,
      `expected the missing-key check to fail fast, but it took ${durationMs}ms - ` +
        `this is the exact symptom of dotenv re-loading a real key from .env and running the full live evaluation`
    );

    // A real live run would create/modify these; a fast-fail must not.
    assertEvidenceFilesUnchanged(snapshots);
  } finally {
    restoreEvidenceFiles(snapshots);
  }
});

test("npm run eval -- --fixtures runs without a usable key, writes fixture-mode content, and leaves tracked evidence files exactly as they were", () => {
  const snapshots = snapshotEvidenceFiles();
  const [fixtureSnap, liveMdSnap, liveJsonSnap] = snapshots;

  try {
    const result = runCli(["--fixtures"], envWithBlankKey());

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
