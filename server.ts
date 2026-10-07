import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createApp, DEFAULT_PRIMARY_MODEL_ID, DEFAULT_FALLBACK_MODEL_ID, DEFAULT_EXTRA_MODEL_IDS } from "./app";

dotenv.config();

const numberFromEnv = (name: string): number | undefined => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

// TRUST_PROXY: a hop count ("1"), "true"/"false", or an Express subnet list.
const parseTrustProxy = (raw: string | undefined): boolean | number | string => {
  if (raw === undefined || raw.trim() === "") return 1;
  const v = raw.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  return /^\d+$/.test(v) ? Number(v) : v;
};

// Hosts like Render/Railway/Cloud Run tell the app which port to bind via PORT.
const PORT = numberFromEnv("PORT") ?? 3000;

// Shared Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
if (!apiKeyConfigured) {
  console.warn("WARNING: GEMINI_API_KEY is not set (or is still the .env.example placeholder). Analyses will fail until it is.");
}

const app = createApp({
  generateContent: (params) => ai.models.generateContent(params),
  primaryModelId: process.env.GEMINI_PRIMARY_MODEL || DEFAULT_PRIMARY_MODEL_ID,
  fallbackModelId: process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL_ID,
  extraModelIds: (process.env.GEMINI_EXTRA_MODELS || DEFAULT_EXTRA_MODEL_IDS.join(","))
    .split(",").map((m) => m.trim()).filter(Boolean),
  apiKeyConfigured,
  perAttemptTimeoutMs: numberFromEnv("GEMINI_ATTEMPT_TIMEOUT_MS"),
  totalTimeoutMs: numberFromEnv("GEMINI_TOTAL_TIMEOUT_MS"),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  // Protects the API key's quota on a public deploy. Set DAILY_REQUEST_CAP
  // higher (or to a billing-backed key's comfort level) to change it.
  dailyRequestCap: numberFromEnv("DAILY_REQUEST_CAP") ?? 200,
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
    // Express 5 (path-to-regexp v8) no longer accepts a bare "*" - it needs
    // a named wildcard segment.
    app.get("/*splat", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
  });
}

startServer();
