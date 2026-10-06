import test from "node:test";
import assert from "node:assert/strict";
import { classifyFailure } from "../geminiErrors";

test("classifies common Gemini failures into user-facing codes", () => {
  assert.equal(classifyFailure({ status: 429, message: "RESOURCE_EXHAUSTED" }).code, "quota");
  assert.equal(classifyFailure({ status: 503, message: "The model is overloaded" }).code, "overloaded");
  assert.equal(classifyFailure({ status: 404, message: "models/x is not found" }).code, "model_not_found");
  assert.equal(classifyFailure({ status: 400, message: "API key not valid" }).code, "missing_key");
  assert.equal(classifyFailure({ name: "AbortError", message: "aborted" }).code, "timeout");
  assert.equal(classifyFailure(new Error("Deadline Exceeded")).code, "timeout");
  assert.equal(classifyFailure(new Error("response failed validation")).code, "invalid_output");
  assert.equal(classifyFailure(new Error("???")).code, "unknown");
});
