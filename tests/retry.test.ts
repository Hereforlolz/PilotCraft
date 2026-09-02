import { test } from "node:test";
import assert from "node:assert/strict";
import { isRetryable } from "../retry";

for (const status of [429, 500, 502, 503, 504]) {
  test(`status ${status} is retryable`, () => {
    assert.equal(isRetryable({ status, message: "upstream error" }), true);
  });
}

test("status 400 is not retryable", () => {
  assert.equal(isRetryable({ status: 400, message: "bad request" }), false);
});

test("an AbortError is retryable", () => {
  assert.equal(isRetryable({ name: "AbortError", message: "aborted" }), true);
});

test("a validation failure after repair is retryable (falls back to the other model)", () => {
  assert.equal(isRetryable({ message: "Gemini response failed validation after repair attempt: ..." }), true);
});
