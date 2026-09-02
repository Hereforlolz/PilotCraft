// Minimal structural type so this can be tested against a plain
// EventEmitter-based fake without pulling in express's Response type.
export interface CloseableResponse {
  writableEnded: boolean;
  destroyed: boolean;
  on(event: "close", listener: () => void): unknown;
}

/**
 * Aborts the in-flight request's controller if the underlying connection
 * closes before the response finished. Node's `res` "close" event fires both
 * on premature disconnect AND after a completed response, so this only acts
 * when writableEnded is still false - otherwise every normal request would
 * abort its own (already-successful) Gemini call right after finishing.
 *
 * (Deliberately listens on the *response*, not the request: `req`'s "close"
 * event fires once the request body has been fully read, which happens well
 * before the response completes - listening there aborted nearly every call.)
 *
 * `onDisconnect` is invoked before the abort, so callers can record that the
 * client is gone - the resulting AbortError still classifies as retryable
 * (it's indistinguishable from a timeout abort at that level), so anything
 * that would otherwise retry needs this signal to know not to bother.
 */
export function abortOnPrematureClose(
  res: CloseableResponse,
  getActiveController: () => AbortController | null | undefined,
  onDisconnect?: () => void
): void {
  res.on("close", () => {
    if (res.writableEnded) return;
    onDisconnect?.();
    getActiveController()?.abort();
  });
}
