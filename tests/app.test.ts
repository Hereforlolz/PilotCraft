import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp, type CreateAppOptions } from "../app";
import type { GenerateContentFn } from "../runAnalysisRoute";
import { validReport } from "./fixtures";

const neverCalled: GenerateContentFn = async () => {
  throw new Error("generateContent should not have been called");
};

async function withServer(
  generateContent: GenerateContentFn,
  run: (baseUrl: string) => Promise<void>,
  overrides: Partial<CreateAppOptions> = {}
) {
  const app = createApp({
    generateContent,
    primaryModelId: "primary-model",
    fallbackModelId: "fallback-model",
    ...overrides,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// Regression test for the bug Codex flagged on PR #4: a request with no body
// (or the wrong Content-Type) left req.body undefined, and the route crashed
// destructuring it - returning a leaked stack trace instead of a clean 400.
test("POST /api/analyze with no body and no Content-Type returns a clean 400", async () => {
  await withServer(neverCalled, async (base) => {
    const res = await fetch(`${base}/api/analyze`, { method: "POST" });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Scenario is required");
  });
});

test("POST /api/analyze with the wrong Content-Type returns a clean 400, not a crash", async () => {
  await withServer(neverCalled, async (base) => {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Scenario is required");
  });
});

test("POST /api/analyze with a JSON body missing scenario returns 400", async () => {
  await withServer(neverCalled, async (base) => {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });
});

test("POST /api/analyze with a scenario over the length cap returns 400", async () => {
  await withServer(neverCalled, async (base) => {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: "x".repeat(4001) }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /too long/i);
  });
});

test("POST /api/analyze with a valid scenario streams a result event", async () => {
  const generateContent: GenerateContentFn = async () => ({ text: JSON.stringify(validReport) });

  await withServer(generateContent, async (base) => {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: "a real scenario" }),
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /event: result/);
    assert.match(text, /event: status/);
  });
});

test("rate limiting returns 429 after the per-IP limit is exceeded", async () => {
  await withServer(neverCalled, async (base) => {
    let lastStatus = 0;
    // Limit is 8 per window; invalid (empty) requests still count against it.
    for (let i = 0; i < 9; i++) {
      const res = await fetch(`${base}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429);
  });
});

const okGenerate: GenerateContentFn = async () => ({ text: JSON.stringify(validReport) });
const post = (base: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("the SSE response disables proxy buffering", async () => {
  await withServer(okGenerate, async (base) => {
    const res = await post(base, { scenario: "a real scenario" });
    assert.equal(res.headers.get("x-accel-buffering"), "no");
    await res.text();
  });
});

test("the daily cap returns 429 once reached, and invalid requests don't use it up", async () => {
  await withServer(okGenerate, async (base) => {
    // Two malformed requests must not consume the cap of 2.
    assert.equal((await post(base, {})).status, 400);
    assert.equal((await post(base, {})).status, 400);

    for (let i = 0; i < 2; i++) {
      const res = await post(base, { scenario: "a real scenario" });
      assert.equal(res.status, 200);
      await res.text();
    }
    const capped = await post(base, { scenario: "a real scenario" });
    assert.equal(capped.status, 429);
    assert.match((await capped.json()).error, /daily usage limit/i);
  }, { dailyRequestCap: 2 });
});

test("without a dailyRequestCap there is no global limit", async () => {
  await withServer(okGenerate, async (base) => {
    for (let i = 0; i < 3; i++) {
      const res = await post(base, { scenario: "a real scenario" });
      assert.equal(res.status, 200);
      await res.text();
    }
  });
});

test("trustProxy is configurable: with 2 hops, distinct clients behind two proxies get separate rate-limit buckets", async () => {
  // With the default of 1 hop every request below would be keyed on the
  // rightmost address ("10.0.0.1") and share one bucket, hitting 429.
  await withServer(neverCalled, async (base) => {
    for (let i = 1; i <= 10; i++) {
      const res = await post(base, {}, { "X-Forwarded-For": `1.2.3.${i}, 10.0.0.1` });
      assert.equal(res.status, 400, `request ${i} should be a 400, not rate limited`);
    }
  }, { trustProxy: 2 });
});

test("a report with prose in stakeholders[].impact is repaired once and then delivered with a level", async () => {
  const prose = {
    ...validReport,
    stakeholders: [{ role: "Support lead", impact: "Accountable for resource allocation and policy sign-off.", involvement: "Owns rollout" }],
  };
  const requests: string[] = [];
  const generateContent: GenerateContentFn = async (params) => {
    requests.push(params.contents);
    return { text: JSON.stringify(requests.length === 1 ? prose : validReport) };
  };

  await withServer(generateContent, async (base) => {
    const res = await post(base, { scenario: "a real scenario" });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /event: result/);
    assert.doesNotMatch(text, /Accountable for resource allocation/);
    assert.match(text, /"impact":"high"/);
  });
  assert.equal(requests.length, 2);
  assert.match(requests[1], /stakeholders\.0\.impact/);
});

test("inputFit survives validation and reaches the client in the result event", async () => {
  const report = { ...validReport, inputFit: { type: "broad_or_general", explanation: "Describe one task and who does it." } };
  const generateContent: GenerateContentFn = async () => ({ text: JSON.stringify(report) });

  await withServer(generateContent, async (base) => {
    const res = await post(base, { scenario: "what is my first 90 days" });
    const text = await res.text();
    assert.match(text, /event: result/);
    assert.match(text, /"inputFit":\{"type":"broad_or_general","explanation":"Describe one task and who does it\."\}/);
  });
});
