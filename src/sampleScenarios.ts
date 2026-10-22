// Single source of truth for the one-click sample scenarios, shared by the UI
// and by scripts/bakeSamples.ts. A baked report is only shown while its
// stored scenario text still matches the text here exactly, so editing a
// sample without re-baking falls back to a live call instead of showing a
// report for a different scenario.
export interface SampleScenario {
  id: string;
  title: string;
  text: string;
}

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  { id: "support-triage", title: "Support ticket triage", text: "Our customer support team spends 60% of their time answering repetitive questions about order status and return policies. We have a searchable knowledge base but customers don't always use it." },
  { id: "weekly-status", title: "Weekly status reporting", text: "Project managers in our engineering firm spend hours each week manually collating status updates from JIRA, email, and Slack to create weekly executive summaries. This often leads to transcription errors." },
  { id: "contract-review", title: "Contract clause review", text: "Our legal department needs to review thousands of standard service contracts for specific indemnity clauses during our annual audit. This process currently takes two paralegals three weeks to complete." },
];
