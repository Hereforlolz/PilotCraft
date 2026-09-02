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
