import { test } from "node:test";
import assert from "node:assert/strict";
import { Type } from "@google/genai";
import { responseSchema, SYSTEM_INSTRUCTION } from "../app";

// Regression coverage for the model contract itself (the Gemini response
// schema and system instruction), not just runtime validation of what comes
// back. The live eval run surfaced readinessScore values of 7, 8, and 6 for
// scenarios expecting 0-100 - the model was treating the field as a 0-10
// scale. These tests pin the fix in the contract so it can't silently regress.

test("responseSchema.readinessScore.score is typed as an integer 0-100, not a bare number", () => {
  const scoreSchema = (responseSchema.properties.readinessScore as any).properties.score;
  assert.equal(scoreSchema.type, Type.INTEGER);
  assert.equal(scoreSchema.minimum, 0);
  assert.equal(scoreSchema.maximum, 100);
});

test("responseSchema.readinessScore.score description states the percentage scale and the 7/10 -> 70 conversion", () => {
  const description: string = (responseSchema.properties.readinessScore as any).properties.score.description;
  assert.match(description, /0 through 100|0-100|0 to 100/i);
  assert.match(description, /not a 0-10 scale/i);
  assert.match(description, /7\/10.*70/);
  assert.match(description, /calibrated to the evidence/i);
});

test("SYSTEM_INSTRUCTION states readinessScore.score is an integer 0-100 percentage-style heuristic, not 0-10", () => {
  assert.match(SYSTEM_INSTRUCTION, /readinessScore\.score is an integer from 0 through 100/);
  assert.match(SYSTEM_INSTRUCTION, /not a 0-10 scale/i);
  assert.match(SYSTEM_INSTRUCTION, /7\/10 must be written as 70, not 7/);
});

test("SYSTEM_INSTRUCTION requires a 'strong' rating to be backed by actual evidence, not just an easy-looking task", () => {
  assert.match(SYSTEM_INSTRUCTION, /"strong" suitability rating requires actual evidence/);
  assert.match(SYSTEM_INSTRUCTION, /default to "conditional" until that evidence is collected/);
});

test("SYSTEM_INSTRUCTION requires unsupported ROI/savings/replacement/productivity claims to be recorded as unverified claims", () => {
  assert.match(SYSTEM_INSTRUCTION, /ROI, savings, cost-reduction, replacement, or productivity figure/);
  assert.match(SYSTEM_INSTRUCTION, /record it in evidenceCheck\.userProvidedFacts as a claim the user made, not as an established fact/);
  assert.match(SYSTEM_INSTRUCTION, /explicitly says the figure is unverified and needs validation/);
  assert.match(SYSTEM_INSTRUCTION, /Never treat an unverified claim like this as proven evidence/);
});

test("SYSTEM_INSTRUCTION's non-AI-alternative guidance covers indexing/taxonomy/workflow/tool fixes", () => {
  assert.match(SYSTEM_INSTRUCTION, /a process or workflow change, fixing an existing tool, search, or taxonomy/);
});

test("SYSTEM_INSTRUCTION allows a defined threshold, not just a cadence, as an actionable human-review trigger", () => {
  assert.match(SYSTEM_INSTRUCTION, /a recurring cadence.*or a clearly defined trigger\/threshold/);
  assert.match(SYSTEM_INSTRUCTION, /not a vague "monitor closely" or an unscheduled "spot-check some of them"/);
});

test("responseSchema constrains stakeholders[].impact to low/medium/high so it can't come back as prose", () => {
  const impact = (responseSchema.properties.stakeholders as any).items.properties.impact;
  assert.equal(impact.type, Type.STRING);
  assert.deepEqual(impact.enum, ["low", "medium", "high"]);
  assert.match(impact.description, /involvement/i);
});

test("SYSTEM_INSTRUCTION says stakeholder impact is a level and explanations belong in involvement", () => {
  assert.match(SYSTEM_INSTRUCTION, /stakeholders\[\]\.impact must be exactly one of "low", "medium", or "high"/);
  assert.match(SYSTEM_INSTRUCTION, /stakeholders\[\]\.involvement, never in impact/);
});

test("responseSchema requires inputFit with a constrained type and an explanation", () => {
  const inputFit = (responseSchema.properties as any).inputFit;
  assert.equal(inputFit.type, Type.OBJECT);
  assert.deepEqual(inputFit.properties.type.enum, ["specific_workflow", "broad_or_general"]);
  assert.equal(inputFit.properties.explanation.type, Type.STRING);
  assert.deepEqual(inputFit.required, ["type", "explanation"]);
  assert.ok((responseSchema.required as string[]).includes("inputFit"));
});

test("SYSTEM_INSTRUCTION requires invented thresholds to be labelled proposals and consistent with the stated baseline", () => {
  // Live run: a stop threshold of 95% accuracy against a stated 97% human baseline.
  assert.match(SYSTEM_INSTRUCTION, /proposed starting value to calibrate against the pilot baseline/);
  assert.match(SYSTEM_INSTRUCTION, /begin the entry with "Proposed:"/);
  assert.match(SYSTEM_INSTRUCTION, /must be consistent with any baseline the user did state/);
  assert.match(SYSTEM_INSTRUCTION, /stop threshold must not allow performance worse than the stated current human performance/);
});

test("SYSTEM_INSTRUCTION forbids recommending training on or retaining sensitive data unless required, and asks for a risk entry", () => {
  // Live run: a clinic routing plan logged patient-message decisions "to train and calibrate routing models".
  assert.match(SYSTEM_INSTRUCTION, /Do not recommend training, fine-tuning, or retaining sensitive data/);
  assert.match(SYSTEM_INSTRUCTION, /list that as a risk with a concrete safeguard and a human review step/);
});

test("rule 2 exempts clearly labelled proposed targets and thresholds, but not baselines or ROI figures", () => {
  // Codex review: rule 2 ("do not fabricate numbers") and rule 11 (emit "Proposed:" thresholds) could conflict.
  assert.match(SYSTEM_INSTRUCTION, /does not apply to clearly labeled proposed targets or thresholds \(see rule 11\)/);
  assert.match(SYSTEM_INSTRUCTION, /never invent baselines, current performance, or ROI figures/);
  // The original rule 2 wording must remain.
  assert.match(SYSTEM_INSTRUCTION, /Do not fabricate numbers\./);
});


test("rule 10 requires a positive condition for specific_workflow and defaults everything else to broad_or_general", () => {
  // Codex reviews, rounds 1-5: listing the broad cases and defaulting to specific left a new gap each time
  // (team-only, goal-only, "advice", general strategy that names a team). The default is now broad.
  assert.match(SYSTEM_INSTRUCTION, /Set inputFit\.type to "specific_workflow" only if the input names a concrete task or process that people do, or a concrete change to a named team's or function's work/);
  assert.match(SYSTEM_INSTRUCTION, /Everything else is "broad_or_general"/);
  assert.match(SYSTEM_INSTRUCTION, /thin evidence is handled by missingEvidence entries and a low readinessScore, not by this flag/);
  const description: string = (responseSchema.properties as any).inputFit.properties.type.description;
  assert.match(description, /specific_workflow only if the input names a concrete task or process people do/);
  assert.match(description, /Everything else is broad_or_general/);
});

test("rule 10 classifies the borderline inputs Codex raised through worked examples", () => {
  const broad = ["our support team", "reduce costs", "give our support team a general AI strategy to reduce costs", "what is my first 90 days"];
  const specific = ["replace our tier-1 support team with an AI agent", "advise our AP team on using AI to detect duplicate invoices"];
  const [, broadPart, specificPart] = SYSTEM_INSTRUCTION.match(/Examples - broad_or_general: (.*?) specific_workflow: (.*?)\. In inputFit/s) ?? [];
  assert.ok(broadPart && specificPart, "rule 10 must contain broad_or_general and specific_workflow examples");
  for (const example of broad) assert.ok(broadPart.includes(`"${example}"`), `broad example missing: ${example}`);
  for (const example of specific) assert.ok(specificPart.includes(`"${example}"`), `specific example missing: ${example}`);
});

test("rule 10 still tells the model not to invent a workflow for broad inputs", () => {
  assert.match(SYSTEM_INSTRUCTION, /personal or career question/);
  assert.match(SYSTEM_INSTRUCTION, /do not invent a specific workflow/);
});
