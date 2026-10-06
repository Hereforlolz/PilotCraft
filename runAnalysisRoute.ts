import { isRetryable } from "./retry";
import { classifyFailure } from "./geminiErrors";
import { validateOrRepair, type RequestRepair } from "./analysisRepair";
import { abortOnPrematureClose, type CloseableResponse } from "./abortOnClose";
import type { ValidatedAnalysisReport } from "./validation";

export interface GenerateContentResult {
  text?: string;
}

export type GenerateContentFn = (params: {
  model: string;
  contents: string;
  config: {
    responseMimeType: string;
    responseSchema: unknown;
    systemInstruction: string;
    abortSignal: AbortSignal;
  };
}) => Promise<GenerateContentResult>;

export interface RunAnalysisRouteOptions {
  res: CloseableResponse;
  scenario: string;
  primaryModelId: string;
  fallbackModelId: string;
  perAttemptTimeoutMs: number;
  totalTimeoutMs: number;
  /** Delay before starting the fallback model, to let transient capacity
   * spikes settle. Defaults to 1000ms; overridable so tests don't have to
   * actually wait a second. */
  fallbackDelayMs?: number;
  /** Extra last-resort models tried, in order, after the fallback model. */
  extraModelIds?: string[];
  /** Extra attempts on the *same* model after a 429/503, before moving on. */
  sameModelRetries?: number;
  /** Base backoff between same-model retries (multiplied by attempt number). */
  retryDelayMs?: number;
  systemInstruction: string;
  responseSchema: unknown;
  generateContent: GenerateContentFn;
  sendEvent: (type: string, data: unknown) => void;
  logModelUsage: (model: string, status: "success" | "failure") => void;
}

const UNAVAILABLE_MESSAGE = "Gemini is temporarily unavailable. Your information is preserved—please try again shortly.";

/** Thrown to the outer catch when the failure should be reported verbatim. */
class ReportableFailure extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

/**
 * Runs the primary/fallback Gemini analysis dance for one request and pushes
 * SSE events via `sendEvent`. Does not call res.end() - that's the caller's
 * job, since it also owns the initial SSE header setup.
 */
export async function runAnalysisRoute(opts: RunAnalysisRouteOptions): Promise<void> {
  const {
    res,
    scenario,
    primaryModelId,
    fallbackModelId,
    perAttemptTimeoutMs,
    totalTimeoutMs,
    fallbackDelayMs = 1000,
    extraModelIds = [],
    sameModelRetries = 0,
    retryDelayMs = 1500,
    systemInstruction,
    responseSchema,
    generateContent,
    sendEvent,
    logModelUsage,
  } = opts;

  // Set once the client disconnects prematurely. An abort triggered by that
  // disconnect produces the same AbortError as a timeout-triggered abort, and
  // isRetryable correctly treats both as retryable in isolation - this flag
  // is what actually distinguishes them, so a disconnect can veto starting a
  // second (pointless) model call that nobody will ever see the result of.
  let clientDisconnected = false;
  let currentAbortController: AbortController | null = null;
  abortOnPrematureClose(
    res,
    () => currentAbortController,
    () => {
      clientDisconnected = true;
    }
  );

  const requestRepair = (modelId: string, signal: AbortSignal): RequestRepair => async (details, previousRawText) => {
    const repairResponse = await generateContent({
      model: modelId,
      contents: `Your previous JSON response did not match the required schema.\n\nValidation errors: ${details}\n\nYour previous response:\n${previousRawText}\n\nReturn a corrected JSON response that fixes these issues and fully matches the schema. Respond with only the corrected JSON, no commentary.`,
      config: {
        responseMimeType: "application/json",
        responseSchema,
        systemInstruction,
        abortSignal: signal,
      },
    });
    return repairResponse.text;
  };

  const runModel = async (modelId: string, timeoutMs: number): Promise<ValidatedAnalysisReport> => {
    const controller = new AbortController();
    currentAbortController = controller;

    let timeoutId!: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("Deadline Exceeded"));
      }, timeoutMs);
    });

    const analysisPromise = (async () => {
      const response = await generateContent({
        model: modelId,
        contents: scenario,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          systemInstruction,
          abortSignal: controller.signal,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");
      return validateOrRepair(text, requestRepair(modelId, controller.signal));
    })();
    // Prevent an unhandled rejection warning if the timeout wins the race
    // and this promise later rejects (e.g. once the aborted fetch settles).
    analysisPromise.catch(() => {});

    try {
      return await Promise.race([analysisPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
      if (currentAbortController === controller) {
        currentAbortController = null;
      }
    }
  };

  const totalTimeoutId = setTimeout(() => {
    currentAbortController?.abort();
    sendEvent("error", { message: UNAVAILABLE_MESSAGE, code: "timeout" });
  }, totalTimeoutMs);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const clientGone = () => clientDisconnected || res.destroyed;
  const modelChain = [primaryModelId, fallbackModelId, ...extraModelIds];

  try {
    let result: ValidatedAnalysisReport | null = null;
    let configFailure: ReturnType<typeof classifyFailure> | null = null;
    let lastError: unknown;

    chain: for (let i = 0; i < modelChain.length; i++) {
      const modelId = modelChain[i];

      if (i === 0) {
        sendEvent("status", "Analyzing scenario with primary engine...");
      } else {
        // The client can disconnect while we wait, and a model call for
        // someone who left is wasted spend - so check before every hop.
        if (clientGone()) return;
        sendEvent("status", i === 1 ? "The primary model is unavailable. Trying the backup model…" : "Backup model also unavailable. Trying one last model…");
        await sleep(fallbackDelayMs);
        if (clientGone()) return;
      }

      for (let attempt = 0; attempt <= sameModelRetries; attempt++) {
        try {
          result = await runModel(modelId, perAttemptTimeoutMs);
          logModelUsage(modelId, "success");
          break chain;
        } catch (error: any) {
          logModelUsage(modelId, "failure");
          lastError = error;
          const failure = classifyFailure(error);
          if (failure.code === "missing_key" || failure.code === "model_not_found") configFailure ??= failure;

          // A model ID this key can't see (404) is a config problem a later
          // model can still rescue, so it counts as moving-on material.
          const canMoveOn = isRetryable(error) || failure.code === "model_not_found";
          if (!canMoveOn) {
            if (i === 0) {
              console.error(`Primary model (${modelId}) failed with non-retryable error:`, error);
              throw new ReportableFailure(failure.message, failure.code);
            }
            break; // a later model's odd error: just try the next one
          }

          console.error(`Model ${modelId} failed (attempt ${attempt + 1}):`, error);
          // Only brief capacity blips are worth retrying on the same model;
          // a timeout already burned its whole budget, and a bad key or
          // model ID won't fix itself.
          const worthRetrying = failure.code === "overloaded" || failure.code === "quota";
          if (!worthRetrying || attempt >= sameModelRetries) break;
          if (clientGone()) return;
          sendEvent("status", "Gemini is busy. Retrying…");
          await sleep(retryDelayMs * (attempt + 1));
          if (clientGone()) return;
        }
      }
    }

    if (!result) {
      // Every model failed. A config problem (bad key / unknown model) is
      // more useful to report than whichever transient error came last.
      const diagnosed = configFailure ?? classifyFailure(lastError);
      throw new ReportableFailure(diagnosed.message, diagnosed.code);
    }
    sendEvent("result", result);
  } catch (error: any) {
    console.error("Analysis Error:", error);
    const failure = error instanceof ReportableFailure ? error : classifyFailure(error);
    sendEvent("error", { message: failure.message, code: failure.code });
  } finally {
    clearTimeout(totalTimeoutId);
  }
}
