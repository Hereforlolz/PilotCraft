import { isRetryable } from "./retry";
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
  systemInstruction: string;
  responseSchema: unknown;
  generateContent: GenerateContentFn;
  sendEvent: (type: string, data: unknown) => void;
  logModelUsage: (model: string, status: "success" | "failure") => void;
}

const UNAVAILABLE_MESSAGE = "Gemini is temporarily unavailable. Your information is preserved—please try again shortly.";

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
    sendEvent("error", { message: UNAVAILABLE_MESSAGE });
  }, totalTimeoutMs);

  try {
    let result: ValidatedAnalysisReport | null = null;

    try {
      sendEvent("status", "Analyzing scenario with primary engine...");
      result = await runModel(primaryModelId, perAttemptTimeoutMs);
      logModelUsage(primaryModelId, "success");
    } catch (error: any) {
      logModelUsage(primaryModelId, "failure");

      if (isRetryable(error)) {
        // The client is gone - a second model call would just be spent
        // computing a report nobody will ever read.
        if (clientDisconnected || res.destroyed) {
          return;
        }

        sendEvent("status", "The primary model is unavailable. Trying the backup model…");

        // Small delay to let transient capacity spikes settle. The client
        // can disconnect during this window, so re-check before spending a
        // second model call on a request nobody's listening for anymore.
        await new Promise((resolve) => setTimeout(resolve, fallbackDelayMs));
        if (clientDisconnected || res.destroyed) {
          return;
        }

        try {
          result = await runModel(fallbackModelId, perAttemptTimeoutMs);
          logModelUsage(fallbackModelId, "success");
        } catch (fallbackError: any) {
          logModelUsage(fallbackModelId, "failure");
          console.error(`Fallback model (${fallbackModelId}) failed:`, fallbackError);
          throw new Error(UNAVAILABLE_MESSAGE);
        }
      } else {
        console.error(`Primary model (${primaryModelId}) failed with non-retryable error:`, error);
        throw error;
      }
    }

    if (result) {
      sendEvent("result", result);
    }
  } catch (error: any) {
    console.error("Analysis Error:", error);
    const message = error.message?.includes("preserved")
      ? error.message
      : "The analysis engine encountered an issue. Please refine your scenario or try again in a few moments.";
    sendEvent("error", { message });
  } finally {
    clearTimeout(totalTimeoutId);
  }
}
