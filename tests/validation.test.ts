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

// Regression test for a finding an independent audit raised: every array in
// the schema allowed zero items, so a report could have no workflow, risks,
// pilot phases, success metrics, or missing-evidence entries and still pass.
test("emptying a core planning array is rejected", () => {
  for (const field of ["clarifyingQuestions", "futureWorkflow", "stakeholders", "adoptionBarriers", "risks", "pilotPlan", "successMetrics"] as const) {
    const report = { ...validReport, [field]: [] };
    const result = analysisReportSchema.safeParse(report);
    assert.equal(result.success, false, `${field}: [] should be rejected`);
  }
});

test("an empty evidenceCheck.missingEvidence is rejected (it must not be able to imply evidence is complete)", () => {
  const report = { ...validReport, evidenceCheck: { ...validReport.evidenceCheck, missingEvidence: [] } };
  const result = analysisReportSchema.safeParse(report);
  assert.equal(result.success, false);
});

test("evidenceCheck.userProvidedFacts and .assumptions may legitimately be empty", () => {
  const report = { ...validReport, evidenceCheck: { ...validReport.evidenceCheck, userProvidedFacts: [], assumptions: [] } };
  const result = analysisReportSchema.safeParse(report);
  assert.equal(result.success, true);
});

test("a blank string entry in a string array is rejected", () => {
  const report = { ...validReport, clarifyingQuestions: [...validReport.clarifyingQuestions, "   "] };
  const result = analysisReportSchema.safeParse(report);
  assert.equal(result.success, false);
});
