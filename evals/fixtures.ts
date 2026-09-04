import type { AnalysisReport } from "../src/types";

/**
 * Hand-authored canned responses for demo/fixture mode, keyed by scenario
 * id. These stand in for what Gemini would return, so the harness can run
 * (and be reviewed) without a live API key.
 *
 * Deliberately mixed: most are compliant with the rubric, but a few contain
 * specific, intentional violations (marked below) so a run against these
 * fixtures proves the checks actually catch problems - not just that they
 * pass everything.
 */
export const CANNED_RESPONSES: Record<string, AnalysisReport> = {
  // --- Compliant ---
  "strong-faq-triage": {
    problemStatement: "Support agents spend significant time manually answering repetitive order-status and return-policy questions.",
    clarifyingQuestions: ["Is the 62% figure from ticket tagging or an estimate?", "How often is the knowledge base updated?"],
    aiSuitability: { rating: "strong", rationale: "High ticket volume, well-documented repetitive categories, and an existing knowledge base to ground responses make this a strong AI-drafting candidate with human review." },
    futureWorkflow: [{ step: "Ticket arrives", humanRole: "Reviews AI draft before sending", aiRole: "Drafts a first-pass response from the knowledge base" }],
    responsibilitySplit: { human: ["Approve or edit every draft before sending", "Handle escalations and exceptions"], ai: ["Draft first-pass responses for repetitive categories"] },
    stakeholders: [{ role: "Support agents", impact: "high", involvement: "Review and edit AI drafts daily" }],
    adoptionBarriers: [{ barrier: "Agent distrust of AI accuracy", mitigation: "Shadow mode for two weeks with full review before any auto-send" }],
    trainingAndCommunication: { trainingActions: ["Train agents on the review workflow"], communicationActions: ["Announce the pilot and its shadow-mode safeguards to the team"] },
    risks: [
      { risk: "AI drafts an incorrect return-policy answer", severity: "medium", safeguard: "All drafts reviewed by an agent before sending during the pilot", humanReview: "Support lead spot-checks 10% of sent replies weekly and reviews any customer complaint within 24 hours" },
    ],
    pilotPlan: [{ period: "Weeks 1-2", actions: ["Shadow mode: draft but do not send"], suggestedOwner: "Support lead", evidenceToCollect: ["Draft acceptance rate"] }],
    successMetrics: [
      { metric: "First response time", baseline: "18 minutes", proposedTarget: "12 minutes", collectionMethod: "Helpdesk analytics export" },
      { metric: "Draft acceptance rate", baseline: "Not provided - to be measured in pilot", proposedTarget: "85%", collectionMethod: "Manual tagging during shadow mode" },
    ],
    decisionCriteria: { stop: ["Draft acceptance below 60% after two weeks"], revise: ["Acceptance 60-85%"], scale: ["Acceptance above 85% for two consecutive weeks"] },
    evidenceCheck: {
      userProvidedFacts: ["1,200 tickets/week", "62% repetitive", "4 minutes per ticket", "18 minute avg first response"],
      assumptions: ["The 62% figure reflects a stable ticket mix"],
      missingEvidence: ["Current customer satisfaction baseline", "Knowledge base accuracy/freshness"],
    },
    readinessScore: { score: 72, explanation: "Strong evidence base with a clear baseline and repetitive, well-scoped task.", factorsReducingScore: ["No CSAT baseline given"] },
  },

  "strong-invoice-routing": {
    problemStatement: "Accounts payable manually classifies vendor invoices into cost centers with a measurable error rate.",
    clarifyingQuestions: ["Are the classification rules documented in a form a model could reference?"],
    aiSuitability: { rating: "strong", rationale: "Stable, well-documented classification rules and a measured baseline error rate make this a strong automation candidate." },
    futureWorkflow: [{ step: "Invoice received", humanRole: "Reviews low-confidence classifications", aiRole: "Classifies invoice to a cost center" }],
    responsibilitySplit: { human: ["Review low-confidence classifications", "Handle exceptions"], ai: ["Classify high-confidence invoices"] },
    stakeholders: [{ role: "AP team", impact: "high", involvement: "Reviews flagged invoices" }],
    adoptionBarriers: [{ barrier: "Fear of job displacement", mitigation: "Frame as reducing tracing/correction work, not headcount" }],
    trainingAndCommunication: { trainingActions: ["Train AP staff on reviewing flagged invoices"], communicationActions: ["Communicate the goal is reducing correction time, not headcount"] },
    risks: [
      { risk: "Invoice misrouted to the wrong cost center", severity: "medium", safeguard: "Low-confidence classifications routed to a human for review", humanReview: "AP lead reviews all low-confidence flags each morning before batch posting" },
    ],
    pilotPlan: [{ period: "Weeks 1-4", actions: ["Run in parallel with manual classification"], suggestedOwner: "AP lead", evidenceToCollect: ["Agreement rate with manual classification"] }],
    successMetrics: [
      { metric: "Misrouting rate", baseline: "6%", proposedTarget: "Below 3%", collectionMethod: "Quarterly audit, same methodology as baseline" },
    ],
    decisionCriteria: { stop: ["Agreement rate below 80%"], revise: ["Agreement 80-95%"], scale: ["Agreement above 95% for a month"] },
    evidenceCheck: {
      userProvidedFacts: ["300 invoices/day", "6% misrouting rate", "40 cost centers", "rules unchanged in two years"],
      assumptions: ["Vendor/line-item text is consistently formatted enough to classify"],
      missingEvidence: ["Current average time to trace and correct a misroute end-to-end"],
    },
    readinessScore: { score: 78, explanation: "Clear baseline, stable rules, well-scoped task.", factorsReducingScore: ["No data on how consistently invoices are formatted"] },
  },

  // --- VIOLATION: rating defaults to "strong" despite an obvious non-AI alternative ---
  "conditional-broken-search": {
    problemStatement: "Employees can't find internal documents due to broken intranet search and resort to asking coworkers.",
    clarifyingQuestions: ["What search platform is currently used?"],
    aiSuitability: { rating: "strong", rationale: "An AI chatbot would let employees ask questions naturally instead of using search." },
    futureWorkflow: [{ step: "Employee asks a question", humanRole: "None", aiRole: "Answers from indexed documents" }],
    responsibilitySplit: { human: ["Maintain document repository"], ai: ["Answer employee questions"] },
    stakeholders: [{ role: "All employees", impact: "medium", involvement: "Use the chatbot" }],
    adoptionBarriers: [{ barrier: "Employees may not trust chatbot answers", mitigation: "Show source documents alongside answers" }],
    trainingAndCommunication: { trainingActions: ["Announce the chatbot"], communicationActions: ["Send a company-wide email"] },
    risks: [
      { risk: "Chatbot gives an outdated policy answer", severity: "medium", safeguard: "Link to the source document", humanReview: "IT reviews chatbot accuracy weekly against a sample set" },
    ],
    pilotPlan: [{ period: "Weeks 1-2", actions: ["Launch to a pilot group"], suggestedOwner: "IT lead", evidenceToCollect: ["Usage rate"] }],
    successMetrics: [{ metric: "Questions answered without escalation", baseline: "Not provided - to be measured in pilot", proposedTarget: "70%", collectionMethod: "Chatbot logs" }],
    decisionCriteria: { stop: ["Usage below 10%"], revise: ["Usage 10-40%"], scale: ["Usage above 40%"] },
    evidenceCheck: {
      userProvidedFacts: ["Employees email/Slack coworkers for document locations", "Search indexing is known to be broken"],
      assumptions: ["Employees would adopt a chatbot over asking coworkers"],
      missingEvidence: ["Volume of these requests", "Cost of fixing the search index directly"],
    },
    readinessScore: { score: 55, explanation: "Some evidence of the problem but no baseline volume.", factorsReducingScore: ["No request volume given"] },
  },

  // --- VIOLATION: baseline fabricated despite scenario giving no numbers ---
  "conditional-missing-baseline": {
    problemStatement: "Marketing wants AI assistance drafting social media captions faster.",
    clarifyingQuestions: ["How many captions are drafted per launch?", "What does 'too long' mean in hours or days?"],
    aiSuitability: { rating: "conditional", rationale: "Plausible use case but no volume or timing data was given to size the benefit." },
    futureWorkflow: [{ step: "Draft captions", humanRole: "Reviews and edits AI drafts", aiRole: "Generates caption options" }],
    responsibilitySplit: { human: ["Final approval of all captions"], ai: ["Generate draft options"] },
    stakeholders: [{ role: "Marketing team", impact: "medium", involvement: "Reviews drafts" }],
    adoptionBarriers: [{ barrier: "Brand voice consistency concerns", mitigation: "Provide brand voice examples in the prompt" }],
    trainingAndCommunication: { trainingActions: ["Train marketing on prompting for brand voice"], communicationActions: ["Share pilot results with the team"] },
    risks: [
      { risk: "Off-brand caption tone", severity: "low", safeguard: "Human review before posting", humanReview: "Marketing lead reviews every caption before each launch" },
    ],
    pilotPlan: [{ period: "One launch cycle", actions: ["Draft captions for the next product launch"], suggestedOwner: "Marketing lead", evidenceToCollect: ["Time spent drafting vs. prior launches"] }],
    successMetrics: [
      { metric: "Time spent drafting captions", baseline: "3.5 hours per launch", proposedTarget: "1 hour per launch", collectionMethod: "Self-reported time tracking" },
    ],
    decisionCriteria: { stop: ["No time savings observed"], revise: ["Marginal time savings"], scale: ["Clear time savings with acceptable brand voice"] },
    evidenceCheck: {
      userProvidedFacts: ["Marketing drafts social captions for product launches"],
      assumptions: ["'Too long' implies a meaningful amount of time"],
      missingEvidence: ["Current time spent drafting", "Number of captions per launch"],
    },
    readinessScore: { score: 40, explanation: "No baseline data was given to size the actual problem.", factorsReducingScore: ["No baseline time or volume given"] },
  },

  "poor-legal-judgment": {
    problemStatement: "Legal wants AI to decide which contract indemnity clauses are acceptable versus need renegotiation.",
    clarifyingQuestions: ["What is the current process and who makes these calls today?"],
    aiSuitability: { rating: "poor", rationale: "This requires case-specific judgment involving negotiating leverage and relationship context that isn't documented anywhere, with uncapped liability risk if wrong - not a good fit for an AI decision-maker." },
    futureWorkflow: [{ step: "Contract review", humanRole: "Makes the acceptance decision", aiRole: "Highlights clauses that differ from standard language" }],
    responsibilitySplit: { human: ["All acceptance/renegotiation decisions"], ai: ["Flag clauses that deviate from a standard template for human attention"] },
    stakeholders: [{ role: "Legal team", impact: "high", involvement: "Makes all final decisions" }],
    adoptionBarriers: [{ barrier: "Legal team may reject any AI involvement in liability decisions", mitigation: "Limit AI to flagging, not deciding" }],
    trainingAndCommunication: { trainingActions: ["None planned beyond flagging tool orientation"], communicationActions: ["Clarify AI only flags, never decides"] },
    risks: [
      { risk: "AI-suggested acceptance exposes the company to uncapped liability", severity: "high", safeguard: "AI never makes the final call - it only flags deviations for a lawyer to assess", humanReview: "A licensed attorney reviews and signs off on every flagged clause before contract execution" },
    ],
    pilotPlan: [{ period: "Not recommended without a narrower scope", actions: ["Reconsider narrowing to clause-flagging only, not decision-making"], suggestedOwner: "General counsel", evidenceToCollect: ["N/A - scope should be redefined first"] }],
    successMetrics: [{ metric: "N/A", baseline: "Not provided - to be measured in pilot", proposedTarget: "Not applicable until scope is narrowed", collectionMethod: "N/A" }],
    decisionCriteria: { stop: ["Any proposal to let AI make binding decisions"], revise: ["Narrow scope to flagging only, with mandatory attorney sign-off"], scale: ["Not recommended for this use case"] },
    evidenceCheck: {
      userProvidedFacts: ["Wrong calls could expose uncapped liability", "Judgment depends on undocumented context"],
      assumptions: ["None - the scenario is explicit about the risk"],
      missingEvidence: ["Current volume of contracts reviewed", "Existing escalation process"],
    },
    readinessScore: { score: 12, explanation: "High-stakes, context-dependent legal judgment with no documented decision criteria is a poor AI fit.", factorsReducingScore: ["Uncapped liability exposure", "No documented decision criteria", "Judgment depends on undocumented relationship context"] },
  },

  // --- VIOLATION: vague, non-actionable human review ---
  "poor-adoption-resistance": {
    problemStatement: "Management wants real-time AI monitoring of production-line worker output, in a unionized workforce that already opposes it.",
    clarifyingQuestions: ["Has management engaged the union about this proposal?"],
    aiSuitability: { rating: "poor", rationale: "Severe, already-stated adoption resistance from the union makes this unlikely to succeed regardless of technical merit." },
    futureWorkflow: [{ step: "Output monitored", humanRole: "Supervisor reviews flags", aiRole: "Flags underperformance" }],
    responsibilitySplit: { human: ["All performance conversations with workers"], ai: ["Flag output anomalies"] },
    stakeholders: [{ role: "Union", impact: "high", involvement: "Has stated opposition in writing" }],
    adoptionBarriers: [{ barrier: "Union has stated this would trigger a grievance", mitigation: "Engage the union before any rollout, not after" }],
    trainingAndCommunication: { trainingActions: ["None until union engagement occurs"], communicationActions: ["Formal union consultation before any technical work begins"] },
    risks: [
      { risk: "Rollout triggers a walkout like the prior automation attempt", severity: "high", safeguard: "Do not deploy without union agreement", humanReview: "Monitor closely." },
    ],
    pilotPlan: [{ period: "Not recommended", actions: ["Union engagement must happen first"], suggestedOwner: "HR/Labor relations", evidenceToCollect: ["Union response to a formal proposal"] }],
    successMetrics: [{ metric: "N/A", baseline: "Not provided - to be measured in pilot", proposedTarget: "N/A", collectionMethod: "N/A" }],
    decisionCriteria: { stop: ["Union does not agree"], revise: ["Redesign with union input"], scale: ["Not recommended given current resistance"] },
    evidenceCheck: {
      userProvidedFacts: ["Workforce is unionized", "Prior automation attempt caused a one-week walkout", "Union has stated opposition in writing"],
      assumptions: ["None - resistance is explicitly documented"],
      missingEvidence: ["Whether alternative, less invasive monitoring approaches have been discussed with the union"],
    },
    readinessScore: { score: 8, explanation: "Documented, severe adoption resistance makes this a poor candidate regardless of technical merit.", factorsReducingScore: ["Union has stated formal opposition", "Prior automation attempt already caused a walkout"] },
  },

  // --- VIOLATION: sensitive health data not flagged as a risk ---
  "sensitive-health-intake": {
    problemStatement: "Clinic receptionists route incoming patient messages to the right department.",
    clarifyingQuestions: ["What department routing categories exist today?"],
    aiSuitability: { rating: "conditional", rationale: "Routing is a plausible AI task, but message content and routing accuracy need validation." },
    futureWorkflow: [{ step: "Message received", humanRole: "Confirms routing", aiRole: "Suggests a department" }],
    responsibilitySplit: { human: ["Confirms every routing suggestion"], ai: ["Suggests a department"] },
    stakeholders: [{ role: "Receptionists", impact: "medium", involvement: "Confirms AI suggestions" }],
    adoptionBarriers: [{ barrier: "Staff may not trust routing suggestions", mitigation: "Start with suggestion-only, not auto-routing" }],
    trainingAndCommunication: { trainingActions: ["Train staff on reviewing suggestions"], communicationActions: ["Explain the pilot to the front desk team"] },
    risks: [
      { risk: "Message routed to the wrong department causing a delay", severity: "medium", safeguard: "Human confirms every routing suggestion before it's acted on", humanReview: "Office manager reviews misrouted-message reports weekly" },
    ],
    pilotPlan: [{ period: "Weeks 1-2", actions: ["Suggestion-only mode"], suggestedOwner: "Office manager", evidenceToCollect: ["Suggestion accuracy rate"] }],
    successMetrics: [{ metric: "Routing accuracy", baseline: "Not provided - to be measured in pilot", proposedTarget: "90%", collectionMethod: "Manual audit of a sample of routed messages" }],
    decisionCriteria: { stop: ["Accuracy below 70%"], revise: ["Accuracy 70-90%"], scale: ["Accuracy above 90%"] },
    evidenceCheck: {
      userProvidedFacts: ["Messages include symptoms, medication names, and insurance details", "Routed to billing, nursing, or scheduling"],
      assumptions: ["Message volume is high enough to justify automation"],
      missingEvidence: ["Current routing volume and error rate"],
    },
    readinessScore: { score: 45, explanation: "Plausible task but validation needed before scaling.", factorsReducingScore: ["No baseline routing accuracy given"] },
  },

  // --- VIOLATION: unsupported ROI claim accepted at face value, rating too generous ---
  "unsupported-roi-claim": {
    problemStatement: "Replace the entire tier-1 support team with an AI agent to cut costs by 80% and save $2 million a year.",
    clarifyingQuestions: ["What is the current tier-1 team's ticket resolution rate?"],
    aiSuitability: { rating: "strong", rationale: "An 80% cost reduction and $2M in annual savings represents a compelling business case for full AI replacement of tier-1 support." },
    futureWorkflow: [{ step: "Ticket arrives", humanRole: "None for tier-1", aiRole: "Fully resolves the ticket" }],
    responsibilitySplit: { human: ["Escalations only"], ai: ["All tier-1 resolution"] },
    stakeholders: [{ role: "Tier-1 support staff", impact: "high", involvement: "Roles eliminated" }],
    adoptionBarriers: [{ barrier: "Staff resistance to job elimination", mitigation: "Communicate the transition plan early" }],
    trainingAndCommunication: { trainingActions: ["None needed for a full replacement"], communicationActions: ["Announce the transition timeline"] },
    risks: [
      { risk: "Customer satisfaction drops without human agents", severity: "medium", safeguard: "Keep an escalation path to a human", humanReview: "Support director reviews CSAT trends monthly" },
    ],
    pilotPlan: [{ period: "Full rollout", actions: ["Replace tier-1 support entirely"], suggestedOwner: "Support director", evidenceToCollect: ["Cost savings realized"] }],
    successMetrics: [{ metric: "Support cost", baseline: "$2.5 million/year", proposedTarget: "$500,000/year (80% reduction)", collectionMethod: "Finance department cost tracking" }],
    decisionCriteria: { stop: ["CSAT drops significantly"], revise: ["Partial rollout only"], scale: ["Full replacement as planned"] },
    evidenceCheck: {
      userProvidedFacts: ["Plan is to replace the entire tier-1 team"],
      assumptions: ["The 80%/$2M figures are achievable as stated"],
      missingEvidence: ["Current support cost breakdown", "Current ticket resolution rate and complexity mix"],
    },
    readinessScore: { score: 80, explanation: "Large projected savings make this a high-priority initiative.", factorsReducingScore: ["No current cost data provided"] },
  },

  "conditional-financial-data": {
    problemStatement: "Finance manually reviews expense reports, including bank details, against travel policy before approving reimbursement.",
    clarifyingQuestions: ["What is the current policy-violation rate?"],
    aiSuitability: { rating: "conditional", rationale: "A first-pass policy check is a reasonable AI task, but handling bank details requires strict access controls and a validated baseline first." },
    futureWorkflow: [{ step: "Report submitted", humanRole: "Reviews AI-flagged exceptions and approves payment", aiRole: "Checks the report against policy rules" }],
    responsibilitySplit: { human: ["All payment approvals", "Access to bank account details"], ai: ["First-pass policy compliance check"] },
    stakeholders: [{ role: "Finance team", impact: "medium", involvement: "Reviews flagged exceptions" }],
    adoptionBarriers: [{ barrier: "Concerns about AI having access to financial/bank data", mitigation: "Mask bank account fields from the AI's policy-check step entirely" }],
    trainingAndCommunication: { trainingActions: ["Train finance staff on the new review workflow"], communicationActions: ["Communicate data-handling safeguards to the team"] },
    risks: [
      { risk: "Exposure of employee bank account details to an AI system with broader access than necessary", severity: "high", safeguard: "Mask or exclude bank account fields from the data sent to the AI policy-check step entirely", humanReview: "Finance security lead audits data access logs monthly" },
    ],
    pilotPlan: [{ period: "Weeks 1-4", actions: ["Run AI policy check with bank fields masked, human reviews all flags"], suggestedOwner: "Finance lead", evidenceToCollect: ["Policy-check accuracy rate"] }],
    successMetrics: [{ metric: "Policy-check accuracy", baseline: "Not provided - to be measured in pilot", proposedTarget: "95%", collectionMethod: "Manual audit against known-good decisions" }],
    decisionCriteria: { stop: ["Bank data cannot be reliably excluded from AI access"], revise: ["Accuracy below target but access controls sound"], scale: ["Accuracy above 95% with verified data masking"] },
    evidenceCheck: {
      userProvidedFacts: ["400 reports/month", "Reports include receipts and employee bank details"],
      assumptions: ["Bank details can be technically separated from the fields the AI needs to see"],
      missingEvidence: ["Current policy-violation rate", "Current review time per report"],
    },
    readinessScore: { score: 42, explanation: "Reasonable task but sensitive data handling must be validated before proceeding.", factorsReducingScore: ["No baseline violation rate", "Data-masking approach unvalidated"] },
  },
};
