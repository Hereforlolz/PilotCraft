# Worked example: customer support ticket triage

This is a synthetic walkthrough of PilotCraft's report structure, built by hand
to show what a report looks like and how to read it critically. It is **not**
a captured output from a real Gemini call — no live scenario was run to
produce this file. All names, numbers, and details below are fictional.

## Scenario entered by the user

> Our customer support team spends 60% of their time answering repetitive
> questions about order status and return policies. We have a searchable
> knowledge base but customers don't always use it.

(This is one of PilotCraft's built-in sample scenarios.)

## What the report should contain

### Evidence discipline

| Category | Content |
|---|---|
| **User-provided facts** | Support team handles repetitive order-status and return-policy questions; a searchable knowledge base exists; customers under-use it; roughly 60% of time is spent on this category of question. |
| **Assumptions** | That "60% of time" was self-estimated rather than measured from ticket-tagging data. That the knowledge base's content is actually accurate and current. That ticket volume is steady rather than seasonal. |
| **Missing evidence** | Current average response time and resolution time. Total ticket volume per week. Customer satisfaction (CSAT) baseline. Why customers aren't using the knowledge base (unclear findability vs. distrust vs. habit). |

### AI-suitability conclusion

**Conditional** — repetitive, template-shaped questions (order status, return
policy) are a reasonable fit for an AI-drafted response reviewed by a human,
*but* the report should flag that a non-AI fix — making the existing
knowledge base easier to find (e.g. a link in the order-confirmation email,
a chatbot-free FAQ redesign) — might close much of the gap without
introducing a new system. PilotCraft's system prompt explicitly instructs the
model to consider this kind of alternative and let it pull the rating down
from "strong," rather than defaulting to recommending AI.

### Human/AI responsibility split

- **Stays with humans:** approving refunds and exceptions, handling escalated
  or angry customers, judgment calls not covered by policy.
- **Handled by AI (with review):** drafting first-pass replies to
  order-status and return-policy questions for a human to approve or edit
  before sending.

### Proposed pilot

- **Weeks 1–2 (shadow mode):** AI drafts replies; agents review and edit
  every draft before sending; nothing goes out unreviewed.
- **Weeks 3–4:** if draft-acceptance rate is high, allow AI to auto-send
  replies only for the narrowest, lowest-risk category (order-status lookups
  with no policy judgment involved), with a random 10% human audit sample.

### Metrics and collection methods

| Metric | Baseline | Target | Collection method |
|---|---|---|---|
| Draft acceptance rate (agent sends AI draft unedited or with minor edits) | Not provided — to be measured in pilot | ≥85% by week 4 | Manual tagging in the ticket queue during shadow mode |
| First response time | Not provided — to be measured in pilot | 20% reduction | Helpdesk analytics export |
| Customer satisfaction on AI-assisted tickets | Not provided — to be measured in pilot | No worse than current CSAT | Post-ticket survey, segmented by AI-assisted vs. not |

Note the baseline is explicitly "not provided" rather than invented — the
original scenario gave no numeric baseline for response time or CSAT, so a
credible report should say so instead of fabricating a plausible-looking
number.

### Human-review controls

- Every AI-drafted reply is reviewed by a human agent before sending during
  the pilot (no auto-send in weeks 1–2).
- Refund- or exception-adjacent replies always require human approval, even
  after auto-send is enabled for low-risk categories.
- Weekly spot-check of a random sample of auto-sent replies by the support
  lead.

### Stop / revise / scale criteria

- **Stop** if draft-acceptance rate stays below 60% after two weeks, or if
  customers report the tone as robotic/unhelpful in survey free-text.
- **Revise** if acceptance rate is 60–85% — narrow the categories the AI
  drafts for, or add more examples to the prompt, before re-testing.
- **Scale** only if acceptance rate holds ≥85% for two consecutive weeks
  *and* CSAT on AI-assisted tickets is not measurably worse than the
  baseline.

## Human critique — what not to accept blindly

A generated report like this should be treated as a **first draft for a
human to challenge**, not a decision. Specifically:

1. **The 60%-of-time figure is unverified.** It came from the user's
   scenario text, not from ticket-system data. Before committing to a pilot,
   pull actual ticket-category tagging to confirm the repetitive-question
   share is really that large.
2. **"Conditional" is a judgment call, not a measurement.** The model
   reasons from the text given; it has no visibility into how well the
   existing knowledge base actually works, how angry the affected customers
   tend to be, or whether return-policy questions carry more legal risk than
   the scenario implies (return policy exceptions can have real cost — the
   report's risk section should be checked for whether it caught this).
3. **The readiness score is a planning heuristic, not a validated
   prediction.** Two different runs of the same scenario can produce
   different scores. Use it to prioritize what to investigate next, not as
   a go/no-go number on its own.
4. **The proposed metrics still need a real baseline before the pilot
   starts.** "Not provided — to be measured in pilot" is honest, but it
   means the very first pilot task is instrumenting a baseline, not skipping
   straight to the AI rollout.
5. **Nothing here replaces checking with support agents themselves.** The
   report can't know whether agents will trust AI drafts, whether the
   knowledge base is actually stale, or whether there's a simpler process
   fix that would make this whole question moot.
