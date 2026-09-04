import express, { type Express } from "express";
import { Type } from "@google/genai";
import { runAnalysisRoute, type GenerateContentFn } from "./runAnalysisRoute";

export const DEFAULT_PRIMARY_MODEL_ID = "gemini-3.8-flash";
export const DEFAULT_FALLBACK_MODEL_ID = "gemini-3.1-flash-lite";

const MAX_SCENARIO_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 8;
const MAX_LOG_ENTRIES = 200;

// Response Schema Definition
// Exported (alongside SYSTEM_INSTRUCTION below) so tests can assert on the
// actual model contract sent to Gemini, not a duplicated copy of it.
export const responseSchema = {
  // ... (keeping existing schema)
  type: Type.OBJECT,
  properties: {
    problemStatement: { type: Type.STRING },
    clarifyingQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    aiSuitability: {
      type: Type.OBJECT,
      properties: {
        rating: { type: Type.STRING, description: "strong | conditional | poor" },
        rationale: { type: Type.STRING }
      },
      required: ["rating", "rationale"]
    },
    futureWorkflow: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.STRING },
          humanRole: { type: Type.STRING },
          aiRole: { type: Type.STRING }
        },
        required: ["step", "humanRole", "aiRole"]
      }
    },
    responsibilitySplit: {
      type: Type.OBJECT,
      properties: {
        human: { type: Type.ARRAY, items: { type: Type.STRING } },
        ai: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["human", "ai"]
    },
    stakeholders: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          impact: { type: Type.STRING },
          involvement: { type: Type.STRING }
        },
        required: ["role", "impact", "involvement"]
      }
    },
    adoptionBarriers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          barrier: { type: Type.STRING },
          mitigation: { type: Type.STRING }
        },
        required: ["barrier", "mitigation"]
      }
    },
    trainingAndCommunication: {
      type: Type.OBJECT,
      properties: {
        trainingActions: { type: Type.ARRAY, items: { type: Type.STRING } },
        communicationActions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["trainingActions", "communicationActions"]
    },
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          risk: { type: Type.STRING },
          severity: { type: Type.STRING, description: "low | medium | high" },
          safeguard: { type: Type.STRING },
          humanReview: { type: Type.STRING }
        },
        required: ["risk", "severity", "safeguard", "humanReview"]
      }
    },
    pilotPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          period: { type: Type.STRING },
          actions: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedOwner: { type: Type.STRING },
          evidenceToCollect: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["period", "actions", "suggestedOwner", "evidenceToCollect"]
      }
    },
    successMetrics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          metric: { type: Type.STRING },
          baseline: { type: Type.STRING },
          proposedTarget: { type: Type.STRING },
          collectionMethod: { type: Type.STRING }
        },
        required: ["metric", "baseline", "proposedTarget", "collectionMethod"]
      }
    },
    decisionCriteria: {
      type: Type.OBJECT,
      properties: {
        stop: { type: Type.ARRAY, items: { type: Type.STRING } },
        revise: { type: Type.ARRAY, items: { type: Type.STRING } },
        scale: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["stop", "revise", "scale"]
    },
    evidenceCheck: {
      type: Type.OBJECT,
      properties: {
        userProvidedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        missingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["userProvidedFacts", "assumptions", "missingEvidence"]
    },
    readinessScore: {
      type: Type.OBJECT,
      properties: {
        score: {
          type: Type.INTEGER,
          minimum: 0,
          maximum: 100,
          description:
            "Integer from 0 through 100 - a percentage-style planning-readiness heuristic, NOT a 0-10 scale. " +
            "Convert any intuitive \"out of 10\" sense before writing it down: 7/10 must be written as 70, not 7. " +
            "Must be calibrated to the evidence actually available - lower when key evidence is missing."
        },
        explanation: { type: Type.STRING },
        factorsReducingScore: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["score", "explanation", "factorsReducingScore"]
    }
  },
  required: [
    "problemStatement", "clarifyingQuestions", "aiSuitability", "futureWorkflow",
    "responsibilitySplit", "stakeholders", "adoptionBarriers", "trainingAndCommunication",
    "risks", "pilotPlan", "successMetrics", "decisionCriteria", "evidenceCheck", "readinessScore"
  ]
};

export const SYSTEM_INSTRUCTION = `You are an AI Adoption Strategist. Analyze the workplace scenario the user describes and produce a structured adoption assessment, following these rules strictly:

1. Evidence discipline: only treat a fact as established if the user actually stated it. Populate evidenceCheck.userProvidedFacts with facts taken directly from the scenario, evidenceCheck.assumptions with anything you inferred or assumed to fill gaps, and evidenceCheck.missingEvidence with concrete information that would be needed to validate the plan (e.g. current error rate, current cycle time, headcount) but was not given.
2. Do not fabricate numbers. If the scenario doesn't state a metric, baseline, or ROI figure, do not invent one. successMetrics.baseline must say "Not provided - to be measured in pilot" (or similar) rather than a made-up figure when the user gave no baseline.
3. Unsupported claims stay claims. If the user asserts an ROI, savings, cost-reduction, replacement, or productivity figure (e.g. "this will cut costs by 80%"), record it in evidenceCheck.userProvidedFacts as a claim the user made, not as an established fact, and add a matching entry to evidenceCheck.assumptions or evidenceCheck.missingEvidence that explicitly says the figure is unverified and needs validation. Never treat an unverified claim like this as proven evidence when setting aiSuitability, pilotPlan, or decisionCriteria.
4. A "strong" suitability rating requires actual evidence: a stated baseline, workflow detail, articulated success criteria, or a validated user need. If none of these were given, do not rate "strong" just because the task looks easy to automate - default to "conditional" until that evidence is collected, even for an apparently simple task.
5. Consider non-AI alternatives before recommending AI. If a simpler fix (better documentation, a process or workflow change, fixing an existing tool, search, or taxonomy) would address the problem as well or better, say so explicitly in aiSuitability.rationale and let that pull the rating toward "conditional" or "poor" rather than defaulting to "strong".
6. Privacy: do not suggest collecting more personal or sensitive data than the scenario requires. If the scenario implies handling PII, health, financial, or other sensitive data, flag that explicitly as a risk with a concrete safeguard and required human review step.
7. Calibrate certainty. readinessScore.score is an integer from 0 through 100 - a percentage-style planning heuristic, NOT a 0-10 scale. Convert any intuitive "out of 10" sense before writing it down: 7/10 must be written as 70, not 7. The score and readinessScore.explanation must be grounded in what evidence actually supports - if key evidence is missing, the score should be lower and factorsReducingScore must name the specific gaps, not generic caveats.
8. Every entry in risks must have a specific, actionable humanReview step naming who checks what, and when - either a recurring cadence (e.g. "weekly") or a clearly defined trigger/threshold (e.g. "any invoice over $10,000") - not a vague "monitor closely" or an unscheduled "spot-check some of them".`;

export interface CreateAppOptions {
  generateContent: GenerateContentFn;
  primaryModelId?: string;
  fallbackModelId?: string;
}

/**
 * Builds the Express app with all routes and middleware configured, but
 * without calling listen() or setting up dev/prod static serving - that's
 * server.ts's job. Has no import-time side effects (no client construction,
 * no env loading), so it's safe to import directly in tests.
 */
export function createApp(options: CreateAppOptions): Express {
  const {
    generateContent,
    primaryModelId = DEFAULT_PRIMARY_MODEL_ID,
    fallbackModelId = DEFAULT_FALLBACK_MODEL_ID,
  } = options;

  const app = express();

  // Trust the first proxy hop (Cloud Run / AI Studio hosting) so req.ip
  // reflects the real client instead of the proxy, which the rate limiter
  // below depends on.
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "100kb" }));

  // Simple in-memory log for debugging (not exposed to user), capped so it
  // can't grow unbounded on a long-running instance. Scoped per-app so
  // multiple createApp() instances (e.g. in tests) don't share state.
  const modelUsageLog: { timestamp: string; model: string; status: string }[] = [];
  function logModelUsage(entry: { timestamp: string; model: string; status: string }) {
    modelUsageLog.push(entry);
    if (modelUsageLog.length > MAX_LOG_ENTRIES) modelUsageLog.shift();
  }

  // Per-IP rate limiting to keep the public endpoint from being used to run
  // up the Gemini bill. Sliding window, in-memory (fine for a single
  // instance), scoped per-app for the same reason as the log above.
  const requestLog = new Map<string, number[]>();

  function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    timestamps.push(now);
    requestLog.set(ip, timestamps);
    return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
  }

  // Periodically evict IPs with no recent requests so the map doesn't grow
  // forever.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requestLog.entries()) {
      const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (fresh.length === 0) requestLog.delete(ip);
      else requestLog.set(ip, fresh);
    }
  }, RATE_LIMIT_WINDOW_MS).unref();

  app.post("/api/analyze", async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        error: `Too many requests. Please wait a bit before trying again (limit: ${RATE_LIMIT_MAX_REQUESTS} per 15 minutes).`,
      });
    }

    const { scenario } = req.body ?? {};
    if (typeof scenario !== "string" || !scenario.trim()) {
      return res.status(400).json({ error: "Scenario is required" });
    }
    if (scenario.length > MAX_SCENARIO_LENGTH) {
      return res.status(400).json({ error: `Scenario is too long (max ${MAX_SCENARIO_LENGTH} characters).` });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type: string, data: any) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await runAnalysisRoute({
        res,
        scenario,
        primaryModelId,
        fallbackModelId,
        perAttemptTimeoutMs: 25000,
        totalTimeoutMs: 55000,
        systemInstruction: SYSTEM_INSTRUCTION,
        responseSchema,
        // Note: per the SDK's own docs, aborting is a client-only operation -
        // it stops us from waiting on the response, but Gemini may still
        // bill for work already in progress server-side.
        generateContent,
        sendEvent,
        logModelUsage: (model, status) => logModelUsage({ timestamp: new Date().toISOString(), model, status }),
      });
    } finally {
      if (!res.writableEnded && !res.destroyed) res.end();
    }
  });

  return app;
}
