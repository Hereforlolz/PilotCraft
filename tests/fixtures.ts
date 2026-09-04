import type { AnalysisReport } from "../src/types";

// Typed against the hand-written AnalysisReport (not validation.ts's
// z.infer-derived ValidatedAnalysisReport): Zod's type inference only
// correctly marks fields as required when strictNullChecks is enabled,
// which this project's tsconfig doesn't set, so z.infer<...> types here
// come out with every field optional at the type level (runtime validation
// is unaffected - this is a TS-only gap). The two types describe the same
// shape; using the canonical one avoids tripping over that gap in fixtures.
export const validReport: AnalysisReport = {
  problemStatement: "Support team spends too much time on repetitive questions.",
  clarifyingQuestions: ["What ticket volume is repetitive?"],
  aiSuitability: { rating: "conditional", rationale: "A better FAQ might work as well." },
  futureWorkflow: [{ step: "Triage", humanRole: "Review edge cases", aiRole: "Draft first response" }],
  responsibilitySplit: { human: ["Approve refunds"], ai: ["Answer FAQ-style questions"] },
  stakeholders: [{ role: "Support lead", impact: "high", involvement: "Owns rollout" }],
  adoptionBarriers: [{ barrier: "Agent trust", mitigation: "Show AI drafts before sending" }],
  trainingAndCommunication: {
    trainingActions: ["Train agents on review workflow"],
    communicationActions: ["Announce pilot to the team"],
  },
  risks: [
    {
      risk: "Incorrect refund policy answers",
      severity: "medium",
      safeguard: "Human approval required for refund amounts",
      humanReview: "Support lead reviews all refund-related replies daily",
    },
  ],
  pilotPlan: [
    {
      period: "Weeks 1-2",
      actions: ["Shadow mode only"],
      suggestedOwner: "Support lead",
      evidenceToCollect: ["Draft accuracy rate"],
    },
  ],
  successMetrics: [
    {
      metric: "First response time",
      baseline: "Not provided - to be measured in pilot",
      proposedTarget: "20% reduction",
      collectionMethod: "Helpdesk analytics export",
    },
  ],
  decisionCriteria: {
    stop: ["Draft accuracy below 70%"],
    revise: ["Agents report drafts are unhelpful"],
    scale: ["Draft accuracy above 90% for 2 weeks"],
  },
  evidenceCheck: {
    userProvidedFacts: ["60% of tickets are repetitive"],
    assumptions: ["Existing knowledge base is accurate"],
    missingEvidence: ["Current average response time"],
  },
  readinessScore: {
    score: 55,
    explanation: "Some evidence provided, but no baseline metrics.",
    factorsReducingScore: ["No baseline response time given"],
  },
};
