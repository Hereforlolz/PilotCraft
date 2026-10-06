import type { AnalysisReport } from './types';

/**
 * Pre-written sample report shown by the "View sample report" button, so the
 * UI can always be demonstrated even when Gemini is unreachable. It is
 * clearly labelled as a sample in the UI and is never sent anywhere.
 */
export const DEMO_SCENARIO =
  "Our customer support team handles about 1,200 tickets a week. Roughly 62% are repetitive order-status and return-policy questions that take about 4 minutes each. Average first response time is 18 minutes. We already have a searchable knowledge base.";

export const DEMO_REPORT: AnalysisReport = {
  problemStatement:
    "Support agents spend a large share of their time manually answering repetitive order-status and return-policy questions, which slows first response for every customer.",
  clarifyingQuestions: [
    "Is the 62% repetitive figure from ticket tagging or an estimate?",
    "How often is the knowledge base reviewed and corrected?",
    "Which channels (email, chat, phone) are in scope for the pilot?",
  ],
  aiSuitability: {
    rating: 'conditional',
    rationale:
      "Volume and repetition make this a good candidate for AI-drafted replies, and a baseline exists (18-minute first response). Rating stays conditional until knowledge-base accuracy is confirmed, and a simpler fix - surfacing the knowledge base inside the order-status page - should be tested first.",
  },
  futureWorkflow: [
    { step: "Ticket arrives and is categorised", humanRole: "Monitors category accuracy", aiRole: "Tags the ticket and finds relevant knowledge-base articles" },
    { step: "Draft reply", humanRole: "Reviews and edits every draft before sending", aiRole: "Drafts a first-pass reply grounded in the articles" },
    { step: "Exceptions and escalations", humanRole: "Handles anything outside policy", aiRole: "Flags low-confidence or sensitive tickets" },
  ],
  responsibilitySplit: {
    human: ["Approve or edit every draft during the pilot", "Handle escalations, refunds and exceptions", "Maintain the knowledge base"],
    ai: ["Categorise incoming tickets", "Draft first-pass replies for repetitive categories"],
  },
  stakeholders: [
    { role: "Support agents", impact: "High", involvement: "Review and edit AI drafts daily" },
    { role: "Support lead", impact: "High", involvement: "Owns the pilot and the weekly spot-checks" },
    { role: "Customers", impact: "Medium", involvement: "Receive faster replies; no direct involvement" },
  ],
  adoptionBarriers: [
    { barrier: "Agents distrust the accuracy of AI drafts", mitigation: "Two weeks of shadow mode where drafts are visible but never sent" },
    { barrier: "Fear that automation reduces headcount", mitigation: "State the pilot's goal as faster responses, and involve agents in defining success" },
  ],
  trainingAndCommunication: {
    trainingActions: ["Run a 45-minute session on reviewing and correcting AI drafts", "Share a one-page guide on what to escalate"],
    communicationActions: ["Announce the pilot, its scope and its safeguards to the whole team", "Hold a weekly 15-minute feedback check-in"],
  },
  risks: [
    { risk: "AI drafts an incorrect return-policy answer", severity: 'medium', safeguard: "Every draft is reviewed by an agent before sending during the pilot", humanReview: "Support lead spot-checks 10% of sent replies every Friday and reviews any customer complaint within 24 hours" },
    { risk: "Customer personal data appears in prompts", severity: 'high', safeguard: "Strip names and contact details before drafting; send only the question text", humanReview: "Security lead audits a sample of 20 prompts in week 1 and after any workflow change" },
  ],
  pilotPlan: [
    { period: "Weeks 1-2", actions: ["Shadow mode: generate drafts without sending", "Fix knowledge-base gaps found by the drafts"], suggestedOwner: "Support lead", evidenceToCollect: ["Draft acceptance rate", "Knowledge-base gaps found"] },
    { period: "Weeks 3-6", actions: ["Agents send reviewed drafts for order-status tickets only", "Compare handling time with a control group"], suggestedOwner: "Support lead", evidenceToCollect: ["Handling time per ticket", "First response time"] },
  ],
  successMetrics: [
    { metric: "First response time", baseline: "18 minutes", proposedTarget: "12 minutes", collectionMethod: "Helpdesk analytics export" },
    { metric: "Draft acceptance rate", baseline: "Not provided - to be measured in pilot", proposedTarget: "85%", collectionMethod: "Agent tagging during shadow mode" },
  ],
  decisionCriteria: {
    stop: ["Draft acceptance stays below 60% after two weeks", "Any confirmed privacy incident"],
    revise: ["Acceptance between 60% and 85%", "Accurate drafts but no time saved"],
    scale: ["Acceptance above 85% for two consecutive weeks with no accuracy complaints"],
  },
  evidenceCheck: {
    userProvidedFacts: ["About 1,200 tickets per week", "62% are repetitive order-status or return-policy questions", "About 4 minutes per repetitive ticket", "18-minute average first response", "A searchable knowledge base exists"],
    assumptions: ["The 62% figure reflects a stable ticket mix", "The knowledge base is accurate enough to ground replies"],
    missingEvidence: ["Customer satisfaction baseline", "Knowledge-base accuracy and freshness", "Share of tickets containing personal data"],
  },
  readinessScore: {
    score: 68,
    explanation: "A clear baseline and a repetitive, well-scoped task support the plan, but knowledge-base quality and data handling are unverified.",
    factorsReducingScore: ["No customer satisfaction baseline", "Knowledge-base accuracy unknown", "Privacy handling not yet specified"],
  },
};
