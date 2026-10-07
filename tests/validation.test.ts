import { test } from "node:test";
import assert from "node:assert/strict";
import { analysisReportSchema } from "../validation";
import { validReport } from "./fixtures";

test("a well-formed report passes validation", () => {
  const result = analysisReportSchema.safeParse(validReport);
  assert.equal(result.success, true);
});

test("readinessScore.score above 100 is rejected", () => {
  const report = { ...validReport, readinessScore: { ...validReport.readinessScore, score: 150 } };
  const result = analysisReportSchema.safeParse(report);
  assert.equal(result.success, false);
});

test("readinessScore.score below 0 is rejected", () => {
  const report = { ...validReport, readinessScore: { ...validReport.readinessScore, score: -1 } };
  const result = analysisReportSchema.safeParse(report);
  assert.equal(result.success, false);
});

test("readinessScore.score at the boundaries (0 and 100) is accepted", () => {
  assert.equal(
    analysisReportSchema.safeParse({ ...validReport, readinessScore: { ...validReport.readinessScore, score: 0 } }).success,
    true
  );
  assert.equal(
    analysisReportSchema.safeParse({ ...validReport, readinessScore: { ...validReport.readinessScore, score: 100 } }).success,
    true
  );
});

test("an invalid aiSuitability.rating enum value is rejected", () => {
  const report = { ...validReport, aiSuitability: { ...validReport.aiSuitability, rating: "amazing" } };
  const result = analysisReportSchema.safeParse(report);
  assert.equal(result.success, false);
});

// Regression: a live run returned whole sentences in stakeholders[].impact, and
// the UI (which renders "<impact> impact" as a pill) showed a paragraph.
test("stakeholders[].impact must be low, medium or high, not prose", () => {
  const stakeholders = (impact: string) => [{ role: "Support lead", impact, involvement: "Owns rollout" }];
  const prose = analysisReportSchema.safeParse({
    ...validReport,
    stakeholders: stakeholders("Accountable for resource allocation, policy sign-off, and organizational performance."),
  });
  assert.equal(prose.success, false);
  assert.match(prose.error!.issues.map((i) => i.path.join(".")).join(";"), /stakeholders\.0\.impact/);

  for (const level of ["low", "medium", "high"]) {
    assert.equal(analysisReportSchema.safeParse({ ...validReport, stakeholders: stakeholders(level) }).success, true, level);
  }
});

test("stakeholders[].impact is normalized to lowercase so 'High' is accepted and stored as 'high'", () => {
  const result = analysisReportSchema.safeParse({
    ...validReport,
    stakeholders: [{ role: "Support lead", impact: "  High ", involvement: "Owns rollout" }],
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.stakeholders[0].impact, "high");
});
