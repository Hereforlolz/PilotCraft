import { analysisReportSchema, formatZodError, type ValidatedAnalysisReport } from "./validation";

type SafeJsonResult = { success: true; data: unknown } | { success: false; error: string };

function safeJsonParse(text: string): SafeJsonResult {
  try {
    return { success: true, data: JSON.parse(text) };
  } catch (e: any) {
    return { success: false, error: e?.message || "Unknown JSON parse error" };
  }
}

/**
 * Requests a corrected response from the model, given a human-readable
 * description of what was wrong with the previous one and the previous raw
 * text. Returns the model's raw text response (or undefined if empty).
 */
export type RequestRepair = (details: string, previousRawText: string) => Promise<string | undefined>;

/**
 * Parses and validates a model response against the analysis report schema.
 * On a JSON parse failure or a schema validation failure, makes exactly one
 * repair request via `requestRepair` and validates that result. If the
 * repair attempt is itself malformed or invalid, this throws - callers
 * should treat that as a signal to fall back to a different model rather
 * than repairing indefinitely.
 */
export async function validateOrRepair(rawText: string, requestRepair: RequestRepair): Promise<ValidatedAnalysisReport> {
  const parsed = safeJsonParse(rawText);
  if (parsed.success === false) {
    return repairOnce(`Response was not valid JSON: ${parsed.error}`, rawText, requestRepair);
  }

  const validated = analysisReportSchema.safeParse(parsed.data);
  if (validated.success === false) {
    return repairOnce(formatZodError(validated.error), rawText, requestRepair);
  }
  return validated.data;
}

async function repairOnce(details: string, previousRawText: string, requestRepair: RequestRepair): Promise<ValidatedAnalysisReport> {
  const repairedText = await requestRepair(details, previousRawText);
  if (!repairedText) throw new Error("Empty response from Gemini repair attempt");

  const parsed = safeJsonParse(repairedText);
  if (parsed.success === false) {
    throw new Error(`Gemini response failed validation after repair attempt: response was not valid JSON (${parsed.error})`);
  }

  const validated = analysisReportSchema.safeParse(parsed.data);
  if (validated.success === false) {
    throw new Error(`Gemini response failed validation after repair attempt: ${formatZodError(validated.error)}`);
  }
  return validated.data;
}
