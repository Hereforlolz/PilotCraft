import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BAKED_SAMPLES, findBakedSample, type BakedSample } from "../src/bakedSamples";
import { SAMPLE_SCENARIOS } from "../src/sampleScenarios";
import { analysisReportSchema } from "../validation";
import { validReport } from "./fixtures";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const fake: BakedSample = {
  id: "support-triage",
  scenario: "scenario text",
  report: validReport as BakedSample["report"],
  model: "some-model",
  generatedAt: "2026-10-08T00:00:00.000Z",
};

test("findBakedSample returns the entry only when id and scenario text both match", () => {
  assert.equal(findBakedSample("support-triage", "scenario text", [fake]), fake);
  assert.equal(findBakedSample("support-triage", "scenario text, edited", [fake]), undefined);
  assert.equal(findBakedSample("weekly-status", "scenario text", [fake]), undefined);
  assert.equal(findBakedSample("support-triage", "scenario text", []), undefined);
});

test("sample scenario ids are unique", () => {
  const ids = SAMPLE_SCENARIOS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

// These run against whatever is committed in src/bakedSamples.json (nothing,
// until `npm run bake-samples` has been run): a bad or stale bake must fail CI
// rather than reach visitors.
test("every committed baked sample is for a known sample, has the current scenario text, and passes the report schema", () => {
  const seen = new Set<string>();
  for (const baked of BAKED_SAMPLES) {
    const sample = SAMPLE_SCENARIOS.find((s) => s.id === baked.id);
    assert.ok(sample, `baked sample "${baked.id}" has no matching sample scenario`);
    assert.ok(!seen.has(baked.id), `duplicate baked sample "${baked.id}"`);
    seen.add(baked.id);
    assert.equal(baked.scenario, sample.text, `baked sample "${baked.id}" is stale - the scenario text changed; re-run npm run bake-samples`);
    assert.ok(baked.model && baked.model !== "unknown", `baked sample "${baked.id}" has no recorded model`);
    assert.ok(!Number.isNaN(Date.parse(baked.generatedAt)), `baked sample "${baked.id}" has an invalid generatedAt`);
    const parsed = analysisReportSchema.safeParse(baked.report);
    assert.ok(parsed.success, `baked sample "${baked.id}" fails schema validation`);
  }
});

test("bake-samples refuses to run without a real GEMINI_API_KEY and does not touch the data file", () => {
  const dataPath = path.join(repoRoot, "src", "bakedSamples.json");
  const before = readFileSync(dataPath, "utf8");
  for (const key of ["", "MY_GEMINI_API_KEY"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", path.join(repoRoot, "scripts", "bakeSamples.ts")], {
      cwd: repoRoot,
      env: { ...process.env, GEMINI_API_KEY: key },
      encoding: "utf8",
      timeout: 60000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GEMINI_API_KEY is not set/);
  }
  assert.equal(readFileSync(dataPath, "utf8"), before);
});
