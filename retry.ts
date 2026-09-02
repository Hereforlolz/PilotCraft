// Status codes worth retrying against the fallback model: rate limiting and
// upstream/gateway failures that are likely transient rather than something
// wrong with the request itself.
export const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

export function isRetryable(error: any): boolean {
  const msg = error?.message?.toLowerCase() || "";
  if (error?.name === "AbortError" || msg.includes("timeout") || msg.includes("deadline") || msg.includes("failed validation")) {
    return true;
  }
  const status = error?.code || error?.status || error?.response?.status;
  if (RETRYABLE_STATUS_CODES.includes(status)) return true;
  return RETRYABLE_STATUS_CODES.some((code) => msg.includes(String(code)));
}
