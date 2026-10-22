import type { AnalysisReport } from './types';
import raw from './bakedSamples.json';

/**
 * A report generated once by the real Gemini pipeline (scripts/bakeSamples.ts)
 * for one of the sample scenarios, so the sample buttons can show it instantly
 * with no API call. Empty until someone runs `npm run bake-samples`.
 */
export interface BakedSample {
  id: string;
  /** Exact scenario text the report was generated from. */
  scenario: string;
  report: AnalysisReport;
  /** Model that produced the accepted response. */
  model: string;
  /** ISO timestamp of generation. */
  generatedAt: string;
}

export const BAKED_SAMPLES = (raw as { samples: BakedSample[] }).samples;

/**
 * Returns the baked report for a sample only if it was generated from exactly
 * the scenario text currently shown, so an edited sample can never display a
 * report that answers a different question.
 */
export function findBakedSample(
  id: string,
  scenarioText: string,
  samples: BakedSample[] = BAKED_SAMPLES
): BakedSample | undefined {
  return samples.find((s) => s.id === id && s.scenario === scenarioText);
}
