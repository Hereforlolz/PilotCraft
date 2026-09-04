import { test } from "node:test";
import assert from "node:assert/strict";
import { reportToMarkdown } from "../src/reportToMarkdown";
import { validReport } from "./fixtures";

test("reportToMarkdown includes every top-level section", () => {
  const md = reportToMarkdown(validReport);

  for (const heading of [
    "# PilotCraft Adoption Strategy Report",
    "## Scenario Assessment",
    "## AI Suitability",
    "## Readiness Score",
    "## Clarifying Questions",
    "## Evidence Check",
    "## Future Workflow",
    "## Human / AI Responsibility Split",
    "## Risk Assessment",
    "## Stakeholder Impact",
    "## Adoption Barriers",
    "## Training & Communication",
    "## Pilot Implementation Plan",
    "## Success Metrics",
    "## Go / No-Go Criteria",
  ]) {
    assert.ok(md.includes(heading), `missing section: ${heading}`);
  }
});

test("reportToMarkdown carries over actual field content, not placeholders", () => {
  const md = reportToMarkdown(validReport);

  assert.ok(md.includes(validReport.problemStatement));
  assert.ok(md.includes(validReport.aiSuitability.rating));
  assert.ok(md.includes(String(validReport.readinessScore.score)));
  assert.ok(md.includes(validReport.risks[0].risk));
  assert.ok(md.includes(validReport.successMetrics[0].collectionMethod));
});

test("reportToMarkdown handles empty arrays without producing malformed markdown", () => {
  const emptyish = {
    ...validReport,
    clarifyingQuestions: [],
    evidenceCheck: { userProvidedFacts: [], assumptions: [], missingEvidence: [] },
    adoptionBarriers: [],
  };

  const md = reportToMarkdown(emptyish);
  assert.ok(md.includes("_None identified._") || md.includes("_None extracted._"));
});
