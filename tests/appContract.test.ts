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
