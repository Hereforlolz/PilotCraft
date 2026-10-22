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

// Regression test for a bypass an independent audit found: with "trust
// proxy" unconditionally enabled, a directly connected caller could choose
// a fresh req.ip (and therefore a fresh rate-limit identity) per request by
// supplying its own X-Forwarded-For header. By default (no trustProxy
// option), that header must be ignored.
test("forwarded headers do not bypass the rate limiter on a direct connection", async () => {
  await withServer(neverCalled, async (base) => {
    let lastStatus = 0;
    for (let i = 0; i < 9; i++) {
      const res = await fetch(`${base}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.0.0.${i}` },
        body: JSON.stringify({}),
      });
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429, "a spoofed X-Forwarded-For must not grant a fresh rate-limit identity");
  });
});

test("trustProxy option, when explicitly set, does make req.ip follow X-Forwarded-For", async () => {
  await withServer(
    neverCalled,
    async (base) => {
      let lastStatus = 0;
      for (let i = 0; i < 9; i++) {
        const res = await fetch(`${base}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.0.0.${i}` },
          body: JSON.stringify({}),
        });
        lastStatus = res.status;
      }
      // Documents the opt-in trade-off: once a deployment explicitly says it
      // sits behind one proxy hop, each distinct forwarded address is
      // treated as a distinct client (same as Express's own semantics), so
      // the rate limiter never trips here - every request instead reaches
      // the (later) scenario validation and gets its own clean 400.
      assert.equal(lastStatus, 400);
    },
    { trustProxy: 1 }
  );
});
