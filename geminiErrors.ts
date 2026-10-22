// Turns raw @google/genai / network errors into a short, honest message the
// UI can show. The raw error is always logged server-side; this only decides
// what the person at the keyboard (or in the interview) gets told.

export type FailureCode =
  | "missing_key"
  | "quota"
  | "overloaded"
  | "model_not_found"
  | "timeout"
  | "invalid_output"
  | "unknown";

export interface ClassifiedFailure {
  code: FailureCode;
  message: string;
}

function statusOf(error: any): number | undefined {
  const status = error?.status ?? error?.code ?? error?.response?.status;
  return typeof status === "number" ? status : undefined;
}

export function classifyFailure(error: any): ClassifiedFailure {
  const msg = String(error?.message ?? "").toLowerCase();
  const status = statusOf(error);

  if (status === 401 || status === 403 || msg.includes("api key") || msg.includes("api_key") || msg.includes("permission_denied")) {
    return {
      code: "missing_key",
      message: "The server's Gemini API key is missing, invalid, or not allowed to use this model. Check GEMINI_API_KEY in the server environment.",
    };
  }
  if (status === 404 || msg.includes("not found") || msg.includes("is not supported")) {
    return {
      code: "model_not_found",
      message: "The configured Gemini model ID isn't available to this API key. Set GEMINI_PRIMARY_MODEL / GEMINI_FALLBACK_MODEL to a model your key can use.",
    };
  }
  if (status === 429 || msg.includes("resource_exhausted") || msg.includes("quota") || msg.includes("429")) {
    return {
      code: "quota",
      message: "Gemini's rate limit or quota was hit. Wait a minute and retry, or check the quota on your API key.",
    };
  }
  if (error?.name === "AbortError" || msg.includes("deadline") || msg.includes("timeout")) {
    return {
      code: "timeout",
      message: "Gemini took too long to respond. Retry in a moment - shorter scenarios finish faster.",
    };
  }
  if (msg.includes("failed validation") || msg.includes("empty response")) {
    return {
      code: "invalid_output",
      message: "Gemini returned a report that didn't match the required structure. Retrying usually fixes this.",
    };
  }
  if (status === 500 || status === 502 || status === 503 || status === 504 || msg.includes("unavailable") || msg.includes("overloaded") || msg.includes("503")) {
    return {
      code: "overloaded",
      message: "Gemini is overloaded right now. Your scenario is preserved - retry in a few seconds.",
    };
  }
  return {
    code: "unknown",
    message: "The analysis engine hit an unexpected problem. Your scenario is preserved - please retry.",
  };
}
