import type { AnalysisReport } from "../src/types";
import type { EvalScenario } from "./scenarios";

export type CheckStatus = "pass" | "fail" | "skipped";

export interface CheckResult {
  checkId: string;
  description: string;
  status: CheckStatus;
  detail: string;
}

function result(checkId: string, description: string, status: CheckStatus, detail: string): CheckResult {
  return { checkId, description, status, detail };
}

const NOT_PROVIDED_PATTERN = /not\s+(yet\s+)?(provided|available|measured)|to be measured|no baseline|unknown/i;
const HAS_SPECIFIC_NUMBER = /\d/;
const CADENCE_KEYWORDS = /\b(daily|weekly|monthly|quarterly|biweekly|each|every|before|after|prior to|periodic(ally)?|upon|within \d)\b/i;
const VAGUE_REVIEW_BOILERPLATE = /^(monitor closely|review regularly|keep an eye on|check periodically|periodic review)\.?$/i;
const SENSITIVE_DATA_KEYWORDS = /\b(PII|personal(ly)? identifiable|health|medical|HIPAA|financial|bank(ing)?|SSN|social security|privacy|confidential)\b/i;
const ROI_TOPIC_KEYWORDS = /\broi\b|\bsavings?\b|cost reduction|\$|percent|%/i;
const UNVERIFIED_HEDGE_KEYWORDS =
  /\b(unverified|unsupported|unconfirmed|unsubstantiated|unproven|not\s+(?:yet\s+)?(?:verified|validated|confirmed|substantiated|independently\s+verified)|hasn'?t\s+been\s+(?:independently\s+)?(?:verified|validated|confirmed)|has\s+not\s+been\s+(?:independently\s+)?(?:verified|validated|confirmed)|assum(?:ed|es|ption)|requires?\s+validation|needs?\s+validation|needs?\s+to\s+be\s+validated|to\s+be\s+validated|remains?\s+to\s+be\s+(?:verified|validated|confirmed))\b/i;
const NON_AI_ALTERNATIVE_KEYWORDS =
  /\b(non-ai|without ai|instead of (?:ai|building an ai|an ai)|cheaper (?:fix|alternative|solution|option)|simpler (?:fix|solution|option)|existing tool|process (?:change|fix)|fix(?:ing)? the (?:underlying|root|actual|broken)|root cause|underlying (?:issue|problem|cause)|fix (?:the )?(?:broken )?(?:search|index|tool|process)|reindex(?:ing)?|manual (?:fix|process)|documentation (?:fix|update|gap)|address(?:ing)? (?:the )?(?:root cause|underlying)|non[- ]ai (?:fix|alternative|solution|option)|better (?:documentation|search|tooling|process))\b/i;

/**
 * Check 1: No fabricated baselines. When the scenario gave no numeric
 * baseline, every success metric's baseline field must say so explicitly
 * rather than presenting an invented number as fact.
 */
export function checkNoFabricatedBaselines(report: AnalysisReport, scenario: EvalScenario): CheckResult[] {
  if (scenario.rubric.baselineProvided) {
    return [
      result(
        "no-fabricated-baselines",
        "Baselines are not fabricated when none was given",
        "skipped",
        "Scenario provided a baseline; this check only applies when none was given."
      ),
    ];
  }

  return report.successMetrics.map((metric, i) => {
    const hedged = NOT_PROVIDED_PATTERN.test(metric.baseline);
    const looksInvented = !hedged && HAS_SPECIFIC_NUMBER.test(metric.baseline);
    return result(
      `no-fabricated-baselines[${i}]`,
      `successMetrics[${i}] ("${metric.metric}") baseline is honestly hedged, not invented`,
      looksInvented ? "fail" : "pass",
      `baseline text: "${metric.baseline}"`
    );
  });
}

/**
 * Check 2: Missing evidence is identified. Every report should name at
 * least one concrete evidence gap - a report with an empty list is either
 * evaluating a fully-specified scenario (none of ours are) or skipping the
 * exercise.
 */
export function checkMissingEvidenceIdentified(report: AnalysisReport, _scenario: EvalScenario): CheckResult[] {
  const count = report.evidenceCheck.missingEvidence.length;
  return [
    result(
      "missing-evidence-identified",
      "At least one concrete evidence gap is named",
      count > 0 ? "pass" : "fail",
      `missingEvidence has ${count} entr${count === 1 ? "y" : "ies"}`
    ),
  ];
}

/**
 * Check 3: Non-AI alternative considered. When the scenario has an obvious
 * cheaper non-AI fix, the suitability rating should not default to
 * "strong" - the system prompt explicitly instructs weighing alternatives
 * and letting that pull the rating down. A lower rating alone isn't
 * enough, though: the rationale must actually name the non-AI alternative
 * it weighed, not just land on a lower score for unrelated reasons.
 */
export function checkNonAiAlternativeConsidered(report: AnalysisReport, scenario: EvalScenario): CheckResult[] {
  if (!scenario.rubric.obviousNonAiAlternative) {
    return [
      result(
        "non-ai-alternative-considered",
        "Rating reflects an obvious non-AI alternative, named in the rationale",
        "skipped",
        "Scenario has no obvious non-AI alternative; this check only applies when one exists."
      ),
    ];
  }

  const pulledDown = report.aiSuitability.rating !== "strong";
  const namesAlternative = NON_AI_ALTERNATIVE_KEYWORDS.test(report.aiSuitability.rationale);
  const passed = pulledDown && namesAlternative;
  return [
    result(
      "non-ai-alternative-considered",
      "Rating reflects an obvious non-AI alternative, named in the rationale",
      passed ? "pass" : "fail",
      `aiSuitability.rating: "${report.aiSuitability.rating}" (expected not "strong"); rationale: "${report.aiSuitability.rationale}"`
    ),
  ];
}

/**
 * Check 4: Actionable human review for every risk. Each risk's humanReview
 * field must be substantive (not one-line boilerplate) and name a cadence
 * or trigger - "who checks what, and when," per the system prompt.
 *
 * This is a heuristic proxy, not a semantic judgment: it can produce false
 * negatives if the model phrases a real cadence in an unrecognized way.
 */
export function checkActionableHumanReview(report: AnalysisReport, _scenario: EvalScenario): CheckResult[] {
  return report.risks.map((risk, i) => {
    const trimmed = risk.humanReview.trim();
    const isVagueBoilerplate = VAGUE_REVIEW_BOILERPLATE.test(trimmed);
    const hasCadence = CADENCE_KEYWORDS.test(trimmed);
    const isSubstantive = trimmed.length >= 15;
    const passed = isSubstantive && hasCadence && !isVagueBoilerplate;
    return result(
      `actionable-human-review[${i}]`,
      `risks[${i}] ("${risk.risk}") has an actionable human-review step`,
      passed ? "pass" : "fail",
      `humanReview: "${risk.humanReview}"`
    );
  });
}

/**
 * Check 5: Evidence-calibrated suitability. The rating and readiness score
 * should land within the bounds the scenario's ground truth considers
 * calibrated to the evidence actually available.
 */
export function checkEvidenceCalibratedSuitability(report: AnalysisReport, scenario: EvalScenario): CheckResult[] {
  const [min, max] = scenario.rubric.scoreRange;
  const ratingOk = scenario.rubric.acceptableRatings.includes(report.aiSuitability.rating);
  const scoreOk = report.readinessScore.score >= min && report.readinessScore.score <= max;

  return [
    result(
      "evidence-calibrated-rating",
      "Suitability rating matches the scenario's evidence profile",
      ratingOk ? "pass" : "fail",
      `rating: "${report.aiSuitability.rating}" (acceptable: ${scenario.rubric.acceptableRatings.join(", ")})`
    ),
    result(
      "evidence-calibrated-score",
      "Readiness score falls in the range the evidence supports",
      scoreOk ? "pass" : "fail",
      `score: ${report.readinessScore.score} (expected ${min}-${max})`
    ),
  ];
}

/**
 * Check 6: Sensitive data is flagged as a risk. When the scenario involves
 * PII, health, or financial data, at least one risk entry should name that
 * exposure with a concrete safeguard.
 */
export function checkSensitiveDataFlagged(report: AnalysisReport, scenario: EvalScenario): CheckResult[] {
  if (!scenario.rubric.involvesSensitiveData) {
    return [
      result(
        "sensitive-data-flagged",
        "Sensitive data handling is flagged as a risk",
        "skipped",
        "Scenario doesn't involve sensitive data; this check only applies when it does."
      ),
    ];
  }

  const flagged = report.risks.some(
    (r) => SENSITIVE_DATA_KEYWORDS.test(r.risk) || SENSITIVE_DATA_KEYWORDS.test(r.safeguard)
  );
  return [
    result(
      "sensitive-data-flagged",
      "Sensitive data handling is flagged as a risk",
      flagged ? "pass" : "fail",
      flagged
        ? "found a risk entry naming sensitive-data handling"
        : `no risk entry mentions sensitive data; risks were: ${report.risks.map((r) => r.risk).join("; ") || "(none)"}`
    ),
  ];
}

/**
 * Check 7: An unsupported ROI claim asserted by the user isn't parroted
 * back as an established fact - it should surface as an assumption or a
 * piece of missing evidence to validate. Merely mentioning "ROI" or
 * "savings" isn't enough - an entry that repeats the figure as if it were
 * confirmed (e.g. "the claimed savings are achievable") would match on
 * topic alone, so the same entry must also carry explicit hedging
 * language (unverified, unsupported, assumed, requires validation, etc.).
 */
export function checkUnsupportedRoiNotParroted(report: AnalysisReport, scenario: EvalScenario): CheckResult[] {
  if (!scenario.rubric.unsupportedRoiClaim) {
    return [
      result(
        "unsupported-roi-not-parroted",
        "An unsupported ROI claim is surfaced as unverified, not treated as fact",
        "skipped",
        "Scenario doesn't assert an unsupported ROI claim; this check only applies when it does."
      ),
    ];
  }

  const flaggedAsUnverified = [...report.evidenceCheck.assumptions, ...report.evidenceCheck.missingEvidence].some(
    (entry) => ROI_TOPIC_KEYWORDS.test(entry) && UNVERIFIED_HEDGE_KEYWORDS.test(entry)
  );
  return [
    result(
      "unsupported-roi-not-parroted",
      "An unsupported ROI claim is surfaced as unverified, not treated as fact",
      flaggedAsUnverified ? "pass" : "fail",
      flaggedAsUnverified
        ? "found an ROI/savings-related entry that also hedges it as unverified/unsupported/assumed/needing validation"
        : "no assumptions/missingEvidence entry both addresses the ROI claim and hedges it as unverified"
    ),
  ];
}

export const ALL_CHECKS = [
  checkNoFabricatedBaselines,
  checkMissingEvidenceIdentified,
  checkNonAiAlternativeConsidered,
  checkActionableHumanReview,
  checkEvidenceCalibratedSuitability,
  checkSensitiveDataFlagged,
  checkUnsupportedRoiNotParroted,
] as const;

export function runAllChecks(report: AnalysisReport, scenario: EvalScenario): CheckResult[] {
  return ALL_CHECKS.flatMap((check) => check(report, scenario));
}
