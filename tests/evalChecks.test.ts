import { test } from "node:test";
import assert from "node:assert/strict";
import type { AnalysisReport } from "../src/types";
import type { EvalScenario } from "../evals/scenarios";
import { EVAL_SCENARIOS } from "../evals/scenarios";
import { CANNED_RESPONSES } from "../evals/fixtures";
import {
  checkNoFabricatedBaselines,
  checkMissingEvidenceIdentified,
  checkNonAiAlternativeConsidered,
  checkActionableHumanReview,
  checkEvidenceCalibratedSuitability,
  checkSensitiveDataFlagged,
  checkUnsupportedRoiNotParroted,
  runAllChecks,
} from "../evals/checks";
import { validReport } from "./fixtures";

function scenarioWith(overrides: Partial<EvalScenario["rubric"]>): EvalScenario {
  return {
    id: "test-scenario",
    title: "Test scenario",
    category: "conditional",
    scenario: "A test scenario.",
    rubric: {
      baselineProvided: false,
      obviousNonAiAlternative: false,
      involvesSensitiveData: false,
      unsupportedRoiClaim: false,
      acceptableRatings: ["strong", "conditional", "poor"],
      scoreRange: [0, 100],
      ...overrides,
    },
  };
}

function reportWith(overrides: Partial<AnalysisReport>): AnalysisReport {
  return { ...validReport, ...overrides };
}

// --- checkNoFabricatedBaselines ---

test("checkNoFabricatedBaselines: skipped when scenario provided a baseline", () => {
  const scenario = scenarioWith({ baselineProvided: true });
  const [check] = checkNoFabricatedBaselines(validReport, scenario);
  assert.equal(check.status, "skipped");
});

test("checkNoFabricatedBaselines: passes when baseline is honestly hedged", () => {
  const scenario = scenarioWith({ baselineProvided: false });
  const report = reportWith({
    successMetrics: [{ metric: "x", baseline: "Not provided - to be measured", proposedTarget: "y", collectionMethod: "z" }],
  });
  const [check] = checkNoFabricatedBaselines(report, scenario);
  assert.equal(check.status, "pass");
});

test("checkNoFabricatedBaselines: fails when a specific number is invented with no hedge", () => {
  const scenario = scenarioWith({ baselineProvided: false });
  const report = reportWith({
    successMetrics: [{ metric: "x", baseline: "3.5 hours per launch", proposedTarget: "y", collectionMethod: "z" }],
  });
  const [check] = checkNoFabricatedBaselines(report, scenario);
  assert.equal(check.status, "fail");
});

// --- checkMissingEvidenceIdentified ---

test("checkMissingEvidenceIdentified: passes when at least one gap is named", () => {
  const report = reportWith({
    evidenceCheck: { userProvidedFacts: [], assumptions: [], missingEvidence: ["Current response time"] },
  });
  const [check] = checkMissingEvidenceIdentified(report, scenarioWith({}));
  assert.equal(check.status, "pass");
});

test("checkMissingEvidenceIdentified: fails when no gaps are named", () => {
  const report = reportWith({
    evidenceCheck: { userProvidedFacts: [], assumptions: [], missingEvidence: [] },
  });
  const [check] = checkMissingEvidenceIdentified(report, scenarioWith({}));
  assert.equal(check.status, "fail");
});

// --- checkNonAiAlternativeConsidered ---

test("checkNonAiAlternativeConsidered: skipped when scenario has no obvious alternative", () => {
  const scenario = scenarioWith({ obviousNonAiAlternative: false });
  const [check] = checkNonAiAlternativeConsidered(validReport, scenario);
  assert.equal(check.status, "skipped");
});

test("checkNonAiAlternativeConsidered: fails when rating stays 'strong' despite an obvious alternative", () => {
  const scenario = scenarioWith({ obviousNonAiAlternative: true });
  const report = reportWith({ aiSuitability: { rating: "strong", rationale: "x" } });
  const [check] = checkNonAiAlternativeConsidered(report, scenario);
  assert.equal(check.status, "fail");
});

test("checkNonAiAlternativeConsidered: fails when rating is pulled down but the rationale doesn't name the alternative", () => {
  const scenario = scenarioWith({ obviousNonAiAlternative: true });
  const report = reportWith({
    aiSuitability: { rating: "conditional", rationale: "Not enough evidence was given to size the benefit." },
  });
  const [check] = checkNonAiAlternativeConsidered(report, scenario);
  assert.equal(check.status, "fail");
});

test("checkNonAiAlternativeConsidered: passes when rating is pulled down and the rationale names the alternative", () => {
  const scenario = scenarioWith({ obviousNonAiAlternative: true });
  const report = reportWith({
    aiSuitability: {
      rating: "conditional",
      rationale: "The underlying problem is broken intranet search - fixing the search index directly is a cheaper fix than building an AI chatbot around it.",
    },
  });
  const [check] = checkNonAiAlternativeConsidered(report, scenario);
  assert.equal(check.status, "pass");
});

test("checkNonAiAlternativeConsidered: passes on a repair verb + target noun even when it doesn't match the fixed phrases (demonstrated false negative)", () => {
  const scenario = scenarioWith({ obviousNonAiAlternative: true });
  const report = reportWith({
    aiSuitability: {
      rating: "conditional",
      // Real text that a live run produced and the check used to wrongly fail:
      // no "fix the search/index/tool" phrase, no "root cause"/"underlying
      // issue" phrase - just "fixing" + "taxonomy"/"search indexing".
      rationale: "Fixing the source taxonomy and search indexing is a cleaner upstream solution.",
    },
  });
  const [check] = checkNonAiAlternativeConsidered(report, scenario);
  assert.equal(check.status, "pass");
});

// --- checkActionableHumanReview ---

test("checkActionableHumanReview: fails on vague boilerplate", () => {
  const report = reportWith({
    risks: [{ risk: "x", severity: "medium", safeguard: "y", humanReview: "Monitor closely." }],
  });
  const [check] = checkActionableHumanReview(report, scenarioWith({}));
  assert.equal(check.status, "fail");
});

test("checkActionableHumanReview: fails when too short", () => {
  const report = reportWith({
    risks: [{ risk: "x", severity: "medium", safeguard: "y", humanReview: "Weekly." }],
  });
  const [check] = checkActionableHumanReview(report, scenarioWith({}));
  assert.equal(check.status, "fail");
});

test("checkActionableHumanReview: passes with a substantive cadence", () => {
  const report = reportWith({
    risks: [
      {
        risk: "x",
        severity: "medium",
        safeguard: "y",
        humanReview: "Support lead reviews all flagged replies weekly before they go out.",
      },
    ],
  });
  const [check] = checkActionableHumanReview(report, scenarioWith({}));
  assert.equal(check.status, "pass");
});

test("checkActionableHumanReview: passes on a defined threshold trigger, not just a recurring cadence", () => {
  const report = reportWith({
    risks: [
      {
        risk: "x",
        severity: "medium",
        safeguard: "y",
        humanReview: "AP lead reviews every invoice above a $10,000 threshold before it is paid.",
      },
    ],
  });
  const [check] = checkActionableHumanReview(report, scenarioWith({}));
  assert.equal(check.status, "pass");
});

test("checkActionableHumanReview: still fails an unscheduled spot-check with no cadence or threshold", () => {
  const report = reportWith({
    risks: [{ risk: "x", severity: "medium", safeguard: "y", humanReview: "Spot-check 10% of decisions." }],
  });
  const [check] = checkActionableHumanReview(report, scenarioWith({}));
  assert.equal(check.status, "fail");
});

test("checkActionableHumanReview: still fails 'monitor closely' even after the threshold-recognition change", () => {
  const report = reportWith({
    risks: [{ risk: "x", severity: "medium", safeguard: "y", humanReview: "Monitor closely." }],
  });
  const [check] = checkActionableHumanReview(report, scenarioWith({}));
  assert.equal(check.status, "fail");
});

// --- checkEvidenceCalibratedSuitability ---

test("checkEvidenceCalibratedSuitability: fails when rating is outside acceptable ratings", () => {
  const scenario = scenarioWith({ acceptableRatings: ["poor"], scoreRange: [0, 100] });
  const report = reportWith({ aiSuitability: { rating: "strong", rationale: "x" }, readinessScore: { score: 50, explanation: "x", factorsReducingScore: [] } });
  const [ratingCheck] = checkEvidenceCalibratedSuitability(report, scenario);
  assert.equal(ratingCheck.status, "fail");
});

test("checkEvidenceCalibratedSuitability: fails when score is out of range", () => {
  const scenario = scenarioWith({ acceptableRatings: ["poor"], scoreRange: [0, 40] });
  const report = reportWith({ aiSuitability: { rating: "poor", rationale: "x" }, readinessScore: { score: 80, explanation: "x", factorsReducingScore: [] } });
  const [, scoreCheck] = checkEvidenceCalibratedSuitability(report, scenario);
  assert.equal(scoreCheck.status, "fail");
});

test("checkEvidenceCalibratedSuitability: passes when both rating and score are calibrated", () => {
  const scenario = scenarioWith({ acceptableRatings: ["conditional"], scoreRange: [40, 60] });
  const report = reportWith({ aiSuitability: { rating: "conditional", rationale: "x" }, readinessScore: { score: 50, explanation: "x", factorsReducingScore: [] } });
  const [ratingCheck, scoreCheck] = checkEvidenceCalibratedSuitability(report, scenario);
  assert.equal(ratingCheck.status, "pass");
  assert.equal(scoreCheck.status, "pass");
});

// --- checkSensitiveDataFlagged ---

test("checkSensitiveDataFlagged: skipped when scenario has no sensitive data", () => {
  const [check] = checkSensitiveDataFlagged(validReport, scenarioWith({ involvesSensitiveData: false }));
  assert.equal(check.status, "skipped");
});

test("checkSensitiveDataFlagged: fails when no risk mentions sensitive data", () => {
  const scenario = scenarioWith({ involvesSensitiveData: true });
  const report = reportWith({
    risks: [{ risk: "Message routed to the wrong department", severity: "low", safeguard: "Spot check", humanReview: "Weekly spot check of routed messages by a supervisor." }],
  });
  const [check] = checkSensitiveDataFlagged(report, scenario);
  assert.equal(check.status, "fail");
});

test("checkSensitiveDataFlagged: passes when a risk names the sensitive data exposure", () => {
  const scenario = scenarioWith({ involvesSensitiveData: true });
  const report = reportWith({
    risks: [
      {
        risk: "Exposure of patient health information to the wrong department",
        severity: "high",
        safeguard: "Redact medical details before routing",
        humanReview: "Privacy officer audits routed messages weekly.",
      },
    ],
  });
  const [check] = checkSensitiveDataFlagged(report, scenario);
  assert.equal(check.status, "pass");
});

// --- checkUnsupportedRoiNotParroted ---

test("checkUnsupportedRoiNotParroted: skipped when scenario asserts no ROI claim", () => {
  const [check] = checkUnsupportedRoiNotParroted(validReport, scenarioWith({ unsupportedRoiClaim: false }));
  assert.equal(check.status, "skipped");
});

test("checkUnsupportedRoiNotParroted: fails when the ROI claim isn't surfaced as unverified", () => {
  const scenario = scenarioWith({ unsupportedRoiClaim: true });
  const report = reportWith({
    evidenceCheck: { userProvidedFacts: [], assumptions: [], missingEvidence: ["Team headcount"] },
  });
  const [check] = checkUnsupportedRoiNotParroted(report, scenario);
  assert.equal(check.status, "fail");
});

test("checkUnsupportedRoiNotParroted: passes when the ROI figure is flagged as unverified", () => {
  const scenario = scenarioWith({ unsupportedRoiClaim: true });
  const report = reportWith({
    evidenceCheck: {
      userProvidedFacts: [],
      assumptions: ["The claimed 80% cost savings has not been independently verified"],
      missingEvidence: [],
    },
  });
  const [check] = checkUnsupportedRoiNotParroted(report, scenario);
  assert.equal(check.status, "pass");
});

test("checkUnsupportedRoiNotParroted: fails when an entry mentions ROI/savings but repeats it as fact instead of hedging it", () => {
  const scenario = scenarioWith({ unsupportedRoiClaim: true });
  const report = reportWith({
    evidenceCheck: {
      userProvidedFacts: [],
      // Mentions "%" and "$" (the old regex's whole bar) but asserts the
      // figures ARE true rather than flagging them as unverified - this is
      // the exact bug the stronger check now catches.
      assumptions: ["The 80%/$2M figures are achievable as stated"],
      missingEvidence: [],
    },
  });
  const [check] = checkUnsupportedRoiNotParroted(report, scenario);
  assert.equal(check.status, "fail");
});

// --- Integration: canned fixture responses against the real scenarios ---
// These 9 responses were deliberately authored so 4 pass every applicable
// check and 5 each violate at least one specific check - this proves the
// evaluator actually discriminates good reports from bad ones, rather than
// rubber-stamping everything.

const EXPECTED_ALL_PASS = new Set([
  "strong-faq-triage",
  "strong-invoice-routing",
  "poor-legal-judgment",
  "conditional-financial-data",
]);

test("canned fixtures: every scenario has a corresponding response and checks run without throwing", () => {
  for (const scenario of EVAL_SCENARIOS) {
    const canned = CANNED_RESPONSES[scenario.id];
    assert.ok(canned, `missing canned response for scenario "${scenario.id}"`);
    assert.doesNotThrow(() => runAllChecks(canned, scenario));
  }
});

test("canned fixtures: scenarios expected to fully comply pass every applicable check", () => {
  for (const scenario of EVAL_SCENARIOS) {
    if (!EXPECTED_ALL_PASS.has(scenario.id)) continue;
    const results = runAllChecks(CANNED_RESPONSES[scenario.id], scenario);
    const failures = results.filter((r) => r.status === "fail");
    assert.deepEqual(failures, [], `expected "${scenario.id}" to pass every check, but got failures: ${JSON.stringify(failures)}`);
  }
});

test("canned fixtures: scenarios with a deliberate violation fail at least one applicable check", () => {
  for (const scenario of EVAL_SCENARIOS) {
    if (EXPECTED_ALL_PASS.has(scenario.id)) continue;
    const results = runAllChecks(CANNED_RESPONSES[scenario.id], scenario);
    const failures = results.filter((r) => r.status === "fail");
    assert.ok(failures.length > 0, `expected "${scenario.id}" to have a deliberate check failure, but everything passed`);
  }
});
