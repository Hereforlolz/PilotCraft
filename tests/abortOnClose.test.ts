import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { abortOnPrematureClose, type CloseableResponse } from "../abortOnClose";

class FakeResponse extends EventEmitter implements CloseableResponse {
  writableEnded = false;
  destroyed = false;
}

test("a normal completed response does not abort the active request", () => {
  const res = new FakeResponse();
  let aborted = false;
  const controller = { abort: () => { aborted = true; } } as unknown as AbortController;

  abortOnPrematureClose(res, () => controller);

  // Simulate the request finishing normally: the response is marked ended
  // before Node's "close" event fires (which it always eventually does,
  // even after a successful response).
  res.writableEnded = true;
  res.emit("close");

  assert.equal(aborted, false, "a completed response must not abort its own Gemini call");
});

test("a response that closes before completion aborts the active request", () => {
  const res = new FakeResponse();
  let aborted = false;
  const controller = { abort: () => { aborted = true; } } as unknown as AbortController;

  abortOnPrematureClose(res, () => controller);

  // Client disconnected mid-request: writableEnded is still false.
  res.emit("close");

  assert.equal(aborted, true, "a premature close must abort the in-flight request");
});

test("does nothing when there is no active controller", () => {
  const res = new FakeResponse();
  assert.doesNotThrow(() => {
    abortOnPrematureClose(res, () => null);
    res.emit("close");
  });
});

test("onDisconnect fires before abort on a premature close, not on a normal completion", () => {
  const res = new FakeResponse();
  const controller = { abort: () => {} } as unknown as AbortController;
  let disconnected = false;

  abortOnPrematureClose(res, () => controller, () => { disconnected = true; });

  res.writableEnded = true;
  res.emit("close");
  assert.equal(disconnected, false, "onDisconnect must not fire for a normal completion");
});

test("onDisconnect fires on a premature close", () => {
  const res = new FakeResponse();
  const controller = { abort: () => {} } as unknown as AbortController;
  let disconnected = false;

  abortOnPrematureClose(res, () => controller, () => { disconnected = true; });

  res.emit("close");
  assert.equal(disconnected, true, "onDisconnect must fire when the client disconnects before completion");
});
