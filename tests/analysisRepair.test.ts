import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOrRepair } from "../analysisRepair";
import { validReport } from "./fixtures";

test("valid JSON on the first try never calls requestRepair", async () => {
  let repairCalls = 0;
  const result = await validateOrRepair(JSON.stringify(validReport), async () => {
    repairCalls++;
    return JSON.stringify(validReport);
  });

  assert.equal(repairCalls, 0);
  assert.deepEqual(result, validReport);
});

test("malformed JSON triggers exactly one repair call and succeeds if the repair is valid", async () => {
  let repairCalls = 0;
  const result = await validateOrRepair("{this is not json", async (details) => {
    repairCalls++;
    assert.match(details, /not valid JSON/i);
    return JSON.stringify(validReport);
  });

  assert.equal(repairCalls, 1);
  assert.deepEqual(result, validReport);
});

test("malformed JSON that is still malformed after repair throws (so the caller can fall back to another model)", async () => {
  let repairCalls = 0;
  await assert.rejects(
    () =>
      validateOrRepair("{this is not json", async () => {
        repairCalls++;
        return "{still not json";
      }),
    /failed validation after repair attempt/i
  );

  assert.equal(repairCalls, 1, "must not repair more than once");
});

test("a schema-invalid response triggers exactly one repair call and succeeds if the repair is valid", async () => {
  const invalid = { ...validReport, aiSuitability: { rating: "amazing", rationale: "x" } };
  let repairCalls = 0;

  const result = await validateOrRepair(JSON.stringify(invalid), async (details) => {
    repairCalls++;
    assert.match(details, /aiSuitability/);
    return JSON.stringify(validReport);
  });

  assert.equal(repairCalls, 1);
  assert.deepEqual(result, validReport);
});

test("a schema-invalid repair result throws rather than repairing again", async () => {
  const invalid = { ...validReport, aiSuitability: { rating: "amazing", rationale: "x" } };
  let repairCalls = 0;

  await assert.rejects(
    () =>
      validateOrRepair(JSON.stringify(invalid), async () => {
        repairCalls++;
        return JSON.stringify({ ...validReport, aiSuitability: { rating: "still-bad", rationale: "x" } });
      }),
    /failed validation after repair attempt/i
  );

  assert.equal(repairCalls, 1);
});

test("an empty repair response throws", async () => {
  await assert.rejects(
    () => validateOrRepair("{not json", async () => undefined),
    /empty response from gemini repair attempt/i
  );
});
