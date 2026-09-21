# Case study: PilotCraft

*A personal project on how to decide whether a workplace problem deserves an AI pilot.*

> **What this is and isn't.** A prototype tested only on synthetic scenarios. It has
> no users and no measured outcomes, and it hasn't been validated in a real
> organisation. Section 8 lists what the repo evidences and what it doesn't.

## 1. The problem

Teams often go straight from "we should use AI" to "let's build it". Three things
tend to get skipped:

- separating what they know from what they are assuming
- a plan for backing out if it doesn't work
- deciding up front what would count as success or failure

PilotCraft is a structured first pass at that decision, before anyone commits
engineering time. It is decision support for a person, not a verdict.

## 2. What it produces

You describe a workplace problem in up to 4,000 characters. It returns one report:
a suitability rating (`strong`, `conditional` or `poor`), the proposed workflow,
the split between human and AI responsibility, stakeholder impact, adoption
barriers, risks (each with a severity, a safeguard and a required human-review
step), a phased pilot plan, success metrics, explicit stop, revise and scale
criteria, an evidence check, and a 0 to 100 readiness score.

The report can be exported as Markdown or printed to PDF.

## 3. Design decisions

| Decision | Why | Where it lives |
|----------|-----|----------------|
| The tool may recommend against AI | A tool that always says "use AI" is useless. The prompt tells the model to weigh non-AI fixes (documentation, process change, an existing tool) first | System instruction in `app.ts` |
| Facts, assumptions and missing evidence are separate lists | Stops a confident narrative from hiding gaps | Report schema and prompt |
| No invented baselines | If the user gave no number, the report says so | Prompt, plus an eval check |
| Every risk needs a named human-review step | "Monitor closely" is not a control. A step needs a cadence or a threshold | Schema, plus an eval check |
| The readiness score is labelled a heuristic | It is the model's own estimate and can differ between runs | UI label |
| Output is validated, not trusted | Zod checks the model's JSON, with one repair attempt before falling back to a second model | `validation.ts`, `analysisRepair.ts` |

## 4. How it is built

React and Vite front end, one Express server, Gemini through `@google/genai`
with a JSON response schema. A primary model is tried first. A second model is
tried only after a retryable failure (429/5xx, timeout, or a repair that is still
invalid). Reports stream to the browser over Server-Sent Events. There is no
database, and reports live only in the browser tab.

Guardrails: a 4,000-character input cap, a per-IP in-memory rate limit (8 per 15
minutes), per-attempt and overall timeouts, and a check that stops a wasted
fallback call when the client has already left.

## 5. How I tested it

- **Unit and route tests:** 74, all passing. They cover retry and fallback logic,
  the repair flow, schema boundaries, the real Express route, and the export.
- **CI:** lint, tests, build, and a smoke test against the production build,
  added because two bugs only existed in the production code path.
- **Evaluation harness:** 9 synthetic scenarios run through the real
  `/api/analyze` route, scored by 7 deterministic checks. The checks cover
  invented baselines, missing-evidence gaps, a named non-AI alternative,
  substantive human-review steps, calibration of rating to evidence,
  sensitive-data handling, and unsupported ROI claims flagged as unverified.
- **Live result:** one run on 4 September 2026 passed 58 of 58 applicable checks.
  The model IDs were run by the author in Google AI Studio. That run predates
  per-scenario model recording, so it does not say which model produced each
  report. Later runs record it.
- **Harness safety:** live mode refuses to run without a key instead of quietly
  using fixtures, so a missing key cannot be mistaken for a real evaluation.

## 6. What the testing can't tell you

- It is one live run over 9 scenarios that I wrote, scored by keyword and pattern
  heuristics. A correct answer phrased in an unexpected way can fail, and a weak
  one can pass.
- It doesn't establish statistical reliability. Two runs can differ.
- It doesn't show the reports are useful to a real team.
- A report can misstate or omit details from the input, so a person must compare
  its evidence check to the original scenario.

## 7. Problems found and fixed along the way

The commit history shows real defects that review caught:

- a client disconnect could still trigger a wasted fallback model call, and a
  later change reopened that race
- Express 5 broke a wildcard route, visible only in the production build
- a missing or wrongly typed request body caused a crash instead of a 400
- test isolation could delete committed evidence, and a test could leak a real
  `.env` key into a "missing key" case
- Express 4 pulled in a vulnerable dependency range, resolved by moving to Express 5
- an earlier README claimed accessibility (WCAG 2.2 AA) compliance that was never
  tested, so the claim was removed rather than fixed

## 8. What this repo does and doesn't prove

| Evidenced | Not evidenced |
|-----------|---------------|
| A working app with typed, validated output and a fallback path | Real users or a pilot run through the tool |
| 74 passing tests, CI, and a documented eval harness | Statistical reliability of the reports |
| A live eval run, with its limits stated | That the advice improves real decisions |
| An AI-assistance disclosure in the README | Accessibility, compliance, or production readiness |

## 9. How I built it

The first version came out of Google AI Studio. That is where I tried the idea and
ran the Gemini models, and the repo still carries AI Studio's app metadata. The
git history starts on 2 September 2026 with that version, in commits under my name.

Most of what followed was hardening, done with an AI coding assistant (Claude
Code) in review rounds that I directed and merged through pull requests. Roughly
half of the commits are authored by the assistant. That work covers:

- abuse protection on the endpoint
- report truthfulness
- request-cancellation and JSON-repair bugs
- the test suite and CI
- the evaluation harness
- the Express 5 upgrade

I don't have a record of each individual design decision, so I won't claim
credit for specific ones here. What the repo does show is the shape of the
process: a quick prototype, then repeated review that found real defects, each
fixed in a small pull request with tests. The README discloses the assistance so
anyone judging the project knows how it was made.

## 10. If this were used for real

- **First check:** have people who run AI pilots review the 7 checks and the
  suitability rating on a set of past decisions where the outcome is known.
- **Then:** shadow mode, where reports sit beside a human's own assessment and
  nobody acts on them, comparing where they disagree.
- **Only then:** a small supervised use, with a hard request cap, login, and a
  privacy review, since scenario text goes to a third-party model.
- **Measures to define up front:** how often a reviewer changes the rating, how
  many evidence gaps a reviewer finds that the report missed, and time to a
  first draft of a pilot plan. None were measured here.
