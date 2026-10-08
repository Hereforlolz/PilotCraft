import { z } from "zod";

// Mirrors the shape of AnalysisReport (src/types.ts) and the Gemini
// responseSchema in server.ts. Gemini's structured-output mode guides the
// model but doesn't guarantee enum values or numeric ranges are honored, so
// this is the actual runtime check before a report reaches the client.

const nonEmptyString = z.string().min(1);
const stringArray = z.array(z.string());

export const analysisReportSchema = z.object({
  problemStatement: nonEmptyString,
  clarifyingQuestions: stringArray,
  aiSuitability: z.object({
    rating: z.enum(["strong", "conditional", "poor"]),
    rationale: nonEmptyString,
  }),
  futureWorkflow: z.array(
    z.object({
      step: nonEmptyString,
      humanRole: nonEmptyString,
      aiRole: nonEmptyString,
    })
  ),
  responsibilitySplit: z.object({
    human: stringArray,
    ai: stringArray,
  }),
  stakeholders: z.array(
    z.object({
      role: nonEmptyString,
      // The UI renders this as a "<level> impact" pill, so it must be a level,
      // not prose. Case/whitespace are normalized (the model may say "High").
      impact: z.preprocess(
        (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
        z.enum(["low", "medium", "high"])
      ),
      involvement: nonEmptyString,
    })
  ),
  adoptionBarriers: z.array(
    z.object({
      barrier: nonEmptyString,
      mitigation: nonEmptyString,
    })
  ),
  trainingAndCommunication: z.object({
    trainingActions: stringArray,
    communicationActions: stringArray,
  }),
  risks: z.array(
    z.object({
      risk: nonEmptyString,
      severity: z.enum(["low", "medium", "high"]),
      safeguard: nonEmptyString,
      humanReview: nonEmptyString,
    })
  ),
  pilotPlan: z.array(
    z.object({
      period: nonEmptyString,
      actions: stringArray,
      suggestedOwner: nonEmptyString,
      evidenceToCollect: stringArray,
    })
  ),
  successMetrics: z.array(
    z.object({
      metric: nonEmptyString,
      baseline: nonEmptyString,
      proposedTarget: nonEmptyString,
      collectionMethod: nonEmptyString,
    })
  ),
  decisionCriteria: z.object({
    stop: stringArray,
    revise: stringArray,
    scale: stringArray,
  }),
  evidenceCheck: z.object({
    userProvidedFacts: stringArray,
    assumptions: stringArray,
    missingEvidence: stringArray,
  }),
  // Optional so reports without it (older data, sample/eval fixtures) stay
  // valid; z.object strips unknown keys, so it must be declared to survive.
  inputFit: z
    .object({
      type: z.enum(["specific_workflow", "broad_or_general"]),
      explanation: nonEmptyString,
    })
    .optional(),
  readinessScore: z.object({
    score: z.number().int().min(0).max(100),
    explanation: nonEmptyString,
    factorsReducingScore: stringArray,
  }),
});

export type ValidatedAnalysisReport = z.infer<typeof analysisReportSchema>;

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}
