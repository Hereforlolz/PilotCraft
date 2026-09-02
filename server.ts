import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Trust the first proxy hop (Cloud Run / AI Studio hosting) so req.ip reflects
// the real client instead of the proxy, which the rate limiter below depends on.
app.set("trust proxy", 1);

// Model Configuration
const PRIMARY_MODEL_ID = "gemini-3.6-flash";
const FALLBACK_MODEL_ID = "gemini-3.5-flash";

// Simple in-memory log for debugging (not exposed to user), capped so it can't
// grow unbounded on a long-running instance.
const MAX_LOG_ENTRIES = 200;
const modelUsageLog: { timestamp: string; model: string; status: string }[] = [];
function logModelUsage(entry: { timestamp: string; model: string; status: string }) {
  modelUsageLog.push(entry);
  if (modelUsageLog.length > MAX_LOG_ENTRIES) modelUsageLog.shift();
}

// Per-IP rate limiting to keep the public endpoint from being used to run up
// the Gemini bill. Sliding window, in-memory (fine for a single instance).
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 8;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

// Periodically evict IPs with no recent requests so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestLog.entries()) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) requestLog.delete(ip);
    else requestLog.set(ip, fresh);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

// Shared Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json({ limit: "100kb" }));

// Response Schema Definition
const responseSchema = {
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
        score: { type: Type.NUMBER },
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

const MAX_SCENARIO_LENGTH = 4000;

app.post("/api/analyze", async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: `Too many requests. Please wait a bit before trying again (limit: ${RATE_LIMIT_MAX_REQUESTS} per 15 minutes).`,
    });
  }

  const { scenario } = req.body;
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
    if (res.writableEnded) return;
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const isRetryable = (error: any) => {
    const msg = error?.message?.toLowerCase() || "";
    if (error?.name === 'AbortError' || msg.includes('timeout') || msg.includes('deadline')) {
      return true;
    }
    const status = error?.code || error?.status || (error?.response?.status);
    return [429, 503].includes(status) || msg.includes("503") || msg.includes("429");
  };

  const runAnalysisWithTimeout = async (modelId: string, timeoutMs: number): Promise<any> => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Deadline Exceeded')), timeoutMs)
    );

    const analysisPromise = (async () => {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: scenario,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          systemInstruction: "You are an AI Adoption Strategist. Analyze workplace scenarios for AI suitability and provide a detailed structured report."
        },
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");
      return JSON.parse(text);
    })();

    return Promise.race([analysisPromise, timeoutPromise]);
  };

  const totalTimeoutId = setTimeout(() => {
    if (!res.writableEnded) {
      sendEvent('error', { message: "Gemini is temporarily unavailable. Your information is preserved—please try again shortly." });
      res.end();
    }
  }, 55000);

  try {
    let result = null;
    
    // Attempt Primary
    try {
      sendEvent('status', 'Analyzing scenario with primary engine...');
      result = await runAnalysisWithTimeout(PRIMARY_MODEL_ID, 25000);
      logModelUsage({ timestamp: new Date().toISOString(), model: PRIMARY_MODEL_ID, status: "success" });
    } catch (error: any) {
      logModelUsage({ timestamp: new Date().toISOString(), model: PRIMARY_MODEL_ID, status: "failure" });
      
      if (isRetryable(error)) {
        sendEvent('status', 'The primary model is unavailable. Trying the backup model…');
        // Immediate fallback
        try {
          result = await runAnalysisWithTimeout(FALLBACK_MODEL_ID, 25000);
          logModelUsage({ timestamp: new Date().toISOString(), model: FALLBACK_MODEL_ID, status: "success" });
        } catch (fallbackError: any) {
          logModelUsage({ timestamp: new Date().toISOString(), model: FALLBACK_MODEL_ID, status: "failure" });
          throw new Error("Gemini is temporarily unavailable. Your information is preserved—please try again shortly.");
        }
      } else {
        throw error;
      }
    }

    if (result && !res.writableEnded) {
      sendEvent('result', result);
    }
  } catch (error: any) {
    console.error("Analysis Error:", error);
    const message = error.message.includes("preserved") 
      ? error.message 
      : "The analysis engine encountered an issue. Please refine your scenario or try again in a few moments.";
    sendEvent('error', { message });
  } finally {
    clearTimeout(totalTimeoutId);
    if (!res.writableEnded) res.end();
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
