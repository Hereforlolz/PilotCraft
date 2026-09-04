import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { runAnalysisRoute, type GenerateContentFn } from "../runAnalysisRoute";
import { validReport } from "./fixtures";

class FakeResponse extends EventEmitter {
  writableEnded = false;
  destroyed = false;
}

function makeEvents() {
  const events: { type: string; data: unknown }[] = [];
  return { events, sendEvent: (type: string, data: unknown) => events.push({ type, data }) };
}

// Mimics generateContent hanging until its abortSignal fires, like a real
// in-flight fetch would when the request is aborted underneath it.
function hangUntilAborted(): Promise<never> {
  return new Promise((_, reject) => {});
}

test("a client disconnect aborts the active request and triggers zero fallback attempts", async () => {
  const res = new FakeResponse();
  const calls: string[] = [];
  const { events, sendEvent } = makeEvents();

  const generateContent: GenerateContentFn = ({ model, config }) => {
    calls.push(model);
    if (model === "primary-model") {
      return new Promise((_, reject) => {
        config.abortSignal.addEventListener("abort", () => {
          const err: any = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }
    // If this ever runs, the test should fail - it proves the bug is back.
    return Promise.resolve({ text: JSON.stringify(validReport) });
  };

  const routePromise = runAnalysisRoute({
    res,
    scenario: "test scenario",
    primaryModelId: "primary-model",
    fallbackModelId: "fallback-model",
    perAttemptTimeoutMs: 5000,
    totalTimeoutMs: 10000,
    systemInstruction: "test",
    responseSchema: {},
    generateContent,
    sendEvent,
    logModelUsage: () => {},
  });

  // Let the primary call actually register its abort listener before we
  // simulate the disconnect.
  await new Promise((resolve) => setImmediate(resolve));
  res.emit("close"); // client disconnected: writableEnded is still false

  await routePromise;

  assert.deepEqual(calls, ["primary-model"], "the fallback model must never be called after a client disconnect");
  assert.ok(!events.some((e) => e.type === "result"), "no result should be sent once the client is gone");
});

test("a per-attempt timeout still starts the fallback model (client is not gone)", async () => {
  const res = new FakeResponse();
  const calls: string[] = [];
  const { events, sendEvent } = makeEvents();

  const generateContent: GenerateContentFn = ({ model }) => {
    calls.push(model);
    if (model === "primary-model") {
      return hangUntilAborted(); // never resolves; the per-attempt timeout will fire
    }
    return Promise.resolve({ text: JSON.stringify(validReport) });
  };

  await runAnalysisRoute({
    res,
    scenario: "test scenario",
    primaryModelId: "primary-model",
    fallbackModelId: "fallback-model",
    perAttemptTimeoutMs: 20, // fire fast so the test stays quick
    totalTimeoutMs: 10000,
    systemInstruction: "test",
    responseSchema: {},
    generateContent,
    sendEvent,
    logModelUsage: () => {},
  });

  assert.deepEqual(calls, ["primary-model", "fallback-model"], "a timeout (no disconnect) must still fall back");
  assert.ok(events.some((e) => e.type === "result"), "the fallback's result should be sent to the client");
});

test("a client disconnect during the fallback delay prevents the fallback call", async () => {
  const res = new FakeResponse();
  const calls: string[] = [];
  const { events, sendEvent } = makeEvents();

  const generateContent: GenerateContentFn = ({ model }) => {
    calls.push(model);
    if (model === "primary-model") {
      const err: any = new Error("upstream error");
      err.status = 503; // retryable, so this enters the fallback-delay window
      return Promise.reject(err);
    }
    // Should never run - the disconnect happens before the delay elapses.
    return Promise.resolve({ text: JSON.stringify(validReport) });
  };

  const routePromise = runAnalysisRoute({
    res,
    scenario: "test scenario",
    primaryModelId: "primary-model",
    fallbackModelId: "fallback-model",
    perAttemptTimeoutMs: 5000,
    totalTimeoutMs: 10000,
    fallbackDelayMs: 30, // short so the test doesn't have to wait out the real 1s default
    systemInstruction: "test",
    responseSchema: {},
    generateContent,
    sendEvent,
    logModelUsage: () => {},
  });

  // Disconnect partway through the fallback delay window (not before it, not after it).
  setTimeout(() => res.emit("close"), 10);

  await routePromise;

  assert.deepEqual(calls, ["primary-model"], "the fallback model must not be called if the client disconnects during the fallback delay");
  assert.ok(!events.some((e) => e.type === "result"), "no result should be sent once the client is gone");
});
