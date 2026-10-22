import { z } from "zod";

// Mirrors the shape of AnalysisReport (src/types.ts) and the Gemini
// responseSchema in server.ts. Gemini's structured-output mode guides the
// model but doesn't guarantee enum values or numeric ranges are honored, so
// this is the actual runtime check before a report reaches the client.

const nonEmptyString = z.string().trim().min(1);
// Blank entries (e.g. "") carry no information and would otherwise pass
// validation while rendering as an empty bullet.
const stringArray = z.array(z.string().trim().min(1));
// For sections where "nothing here" is itself a meaningful finding rather
// than a sign the model skipped the section, require at least one entry.
const nonEmptyArray = <T extends z.ZodTypeAny>(schema: T) => z.array(schema).min(1);

export const analysisReportSchema = z.object({
  problemStatement: nonEmptyString,
  clarifyingQuestions: nonEmptyArray(z.string().trim().min(1)),
  aiSuitability: z.object({
    rating: z.enum(["strong", "conditional", "poor"]),
    rationale: nonEmptyString,
  }),
  futureWorkflow: nonEmptyArray(
    z.object({
      step: nonEmptyString,
      humanRole: nonEmptyString,
      aiRole: nonEmptyString,
    })
  ),
  responsibilitySplit: z.object({
    human: nonEmptyArray(z.string().trim().min(1)),
    ai: nonEmptyArray(z.string().trim().min(1)),
  }),
  stakeholders: nonEmptyArray(
    z.object({
      role: nonEmptyString,
      impact: nonEmptyString,
      involvement: nonEmptyString,
    })
  ),
  adoptionBarriers: nonEmptyArray(
    z.object({
      barrier: nonEmptyString,
      mitigation: nonEmptyString,
    })
  ),
  trainingAndCommunication: z.object({
    trainingActions: nonEmptyArray(z.string().trim().min(1)),
    communicationActions: nonEmptyArray(z.string().trim().min(1)),
  }),
  risks: nonEmptyArray(
    z.object({
      risk: nonEmptyString,
      severity: z.enum(["low", "medium", "high"]),
      safeguard: nonEmptyString,
      humanReview: nonEmptyString,
    })
  ),
  pilotPlan: nonEmptyArray(
    z.object({
      period: nonEmptyString,
      actions: nonEmptyArray(z.string().trim().min(1)),
      suggestedOwner: nonEmptyString,
      evidenceToCollect: nonEmptyArray(z.string().trim().min(1)),
    })
  ),
  successMetrics: nonEmptyArray(
    z.object({
      metric: nonEmptyString,
      baseline: nonEmptyString,
      proposedTarget: nonEmptyString,
      collectionMethod: nonEmptyString,
    })
  ),
  decisionCriteria: z.object({
    stop: nonEmptyArray(z.string().trim().min(1)),
    revise: nonEmptyArray(z.string().trim().min(1)),
    scale: nonEmptyArray(z.string().trim().min(1)),
  }),
  evidenceCheck: z.object({
    // Legitimately empty when the scenario is fully specified or the model
    // inferred nothing - unlike the sections above, "none" is a valid
    // outcome here, not a sign the model skipped the section.
    userProvidedFacts: stringArray,
    assumptions: stringArray,
    missingEvidence: nonEmptyArray(z.string().trim().min(1)),
  }),
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
