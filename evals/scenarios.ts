/**
 * Synthetic workplace scenarios for PilotCraft's evaluation harness.
 *
 * Each scenario carries a `rubric` describing ground truth about the
 * scenario itself (what evidence it does/doesn't provide, whether an
 * obvious non-AI alternative exists, etc.) - the deterministic checks in
 * ./checks.ts use this to judge whether the generated report responded
 * appropriately, not just whether it's well-formed.
 */

export type SuitabilityRating = "strong" | "conditional" | "poor";

export interface EvalScenarioRubric {
  /** Did the scenario text give a numeric baseline for its metrics? */
  baselineProvided: boolean;
  /** Does an obvious, cheaper non-AI fix exist for this problem? */
  obviousNonAiAlternative: boolean;
  /** Does the scenario involve PII, health, or financial data? */
  involvesSensitiveData: boolean;
  /** Does the scenario itself assert an unverified/inflated ROI figure? */
  unsupportedRoiClaim: boolean;
  /** Ratings considered evidence-calibrated for this scenario. */
  acceptableRatings: SuitabilityRating[];
  /** Inclusive readiness-score bounds considered evidence-calibrated. */
  scoreRange: [number, number];
}

export interface EvalScenario {
  id: string;
  title: string;
  category: SuitabilityRating;
  scenario: string;
  rubric: EvalScenarioRubric;
}

export const EVAL_SCENARIOS: EvalScenario[] = [
  {
    id: "strong-faq-triage",
    title: "Strong: repetitive support ticket triage",
    category: "strong",
    scenario:
      "Our customer support team handles about 1,200 tickets a week. We measured that 62% are repetitive order-status or return-policy questions, each currently taking an agent about 4 minutes to answer using our internal knowledge base. Average first response time is currently 18 minutes. We want AI to draft first-pass responses to these repetitive categories for an agent to review before sending.",
    rubric: {
      baselineProvided: true,
      obviousNonAiAlternative: false,
      involvesSensitiveData: false,
      unsupportedRoiClaim: false,
      acceptableRatings: ["strong", "conditional"],
      scoreRange: [50, 100],
    },
  },
  {
    id: "strong-invoice-routing",
    title: "Strong: invoice cost-center classification",
    category: "strong",
    scenario:
      "Our accounts payable team manually reads about 300 vendor invoices a day and assigns each to one of 40 cost centers based on the vendor and line-item descriptions. Our current manual misrouting rate, measured over the last quarter, is 6%, each misroute taking about 20 minutes to trace and correct. The classification rules are well documented and haven't changed in two years.",
    rubric: {
      baselineProvided: true,
      obviousNonAiAlternative: false,
      involvesSensitiveData: false,
      unsupportedRoiClaim: false,
      acceptableRatings: ["strong", "conditional"],
      scoreRange: [50, 100],
    },
  },
  {
    id: "conditional-broken-search",
    title: "Conditional: obvious non-AI alternative (broken internal search)",
    category: "conditional",
    scenario:
      "Employees keep emailing coworkers or posting in Slack asking where to find internal policy documents, because our intranet search almost never returns useful results - it's a known, longstanding problem with the search indexing, not a lack of documentation. We're considering building an AI chatbot that employees can ask instead.",
    rubric: {
      baselineProvided: false,
      obviousNonAiAlternative: true,
      involvesSensitiveData: false,
      unsupportedRoiClaim: false,
      acceptableRatings: ["conditional", "poor"],
      scoreRange: [0, 65],
    },
  },
  {
    id: "conditional-missing-baseline",
    title: "Conditional: no baseline evidence given at all",
    category: "conditional",
    scenario:
      "Our marketing team wants help drafting social media captions for product launches. We think it takes too long right now and AI could speed things up.",
    rubric: {
      baselineProvided: false,
      obviousNonAiAlternative: false,
      involvesSensitiveData: false,
      unsupportedRoiClaim: false,
      acceptableRatings: ["conditional", "poor"],
      scoreRange: [0, 60],
    },
  },
  {
    id: "poor-legal-judgment",
    title: "Poor: high-stakes legal judgment calls",
    category: "poor",
    scenario:
      "Our legal team wants AI to decide which indemnity and liability clauses in vendor contracts are acceptable to sign as-is versus which need renegotiation. A wrong call here could expose the company to uncapped liability, and the judgment depends on case-specific context, negotiating leverage, and relationship history that isn't written down anywhere.",
    rubric: {
      baselineProvided: false,
      obviousNonAiAlternative: false,
      involvesSensitiveData: false,
      unsupportedRoiClaim: false,
      acceptableRatings: ["poor", "conditional"],
      scoreRange: [0, 45],
    },
  },
  {
    id: "poor-adoption-resistance",
    title: "Poor: severe adoption resistance",
    category: "poor",
    scenario:
      "Management wants to introduce an AI system that monitors production-line worker output in real time and flags underperformance to supervisors. The workforce is unionized, a previous automation rollout two years ago caused a one-week walkout, and the union has already stated in writing that any monitoring AI would be treated as a grievance trigger.",
    rubric: {
      baselineProvided: false,
      obviousNonAiAlternative: false,
      involvesSensitiveData: false,
      unsupportedRoiClaim: false,
      acceptableRatings: ["poor", "conditional"],
      scoreRange: [0, 45],
    },
  },
  {
    id: "sensitive-health-intake",
    title: "Sensitive data: patient intake message triage",
    category: "conditional",
    scenario:
      "Our clinic receptionists spend a lot of time reading incoming patient messages - which often include symptoms, medication names, and insurance details - and routing them to the right department (billing, nursing, scheduling). We want AI to read the messages and suggest which department they should go to.",
    rubric: {
      baselineProvided: false,
      obviousNonAiAlternative: false,
      involvesSensitiveData: true,
      unsupportedRoiClaim: false,
      acceptableRatings: ["conditional", "poor"],
      scoreRange: [0, 60],
    },
  },
  {
    id: "unsupported-roi-claim",
    title: "Unsupported ROI claim asserted by the user",
    category: "poor",
    scenario:
      "We're going to replace our entire tier-1 support team with an AI agent. This will definitely cut support costs by 80% and save us $2 million a year - it's a guaranteed win, we just need help planning the rollout.",
    rubric: {
      baselineProvided: false,
      obviousNonAiAlternative: false,
      involvesSensitiveData: false,
      unsupportedRoiClaim: true,
      acceptableRatings: ["conditional", "poor"],
      scoreRange: [0, 55],
    },
  },
  {
    id: "conditional-financial-data",
    title: "Sensitive data: expense report reimbursement approval",
    category: "conditional",
    scenario:
      "Our finance team manually reviews employee expense reports - which include receipts and employee bank account details for reimbursement - checking them against our travel policy before approving payment. We process about 400 reports a month and want AI to do a first-pass policy check before a human approves the payment.",
    rubric: {
      baselineProvided: false,
      obviousNonAiAlternative: false,
      involvesSensitiveData: true,
      unsupportedRoiClaim: false,
      acceptableRatings: ["conditional", "strong"],
      scoreRange: [30, 100],
    },
  },
];
