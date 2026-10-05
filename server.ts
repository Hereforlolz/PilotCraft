import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createApp, DEFAULT_PRIMARY_MODEL_ID, DEFAULT_FALLBACK_MODEL_ID } from "./app";

dotenv.config();

const PORT = 3000;

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

const numberFromEnv = (name: string): number | undefined => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const app = createApp({
  generateContent: (params) => ai.models.generateContent(params),
  primaryModelId: process.env.GEMINI_PRIMARY_MODEL || DEFAULT_PRIMARY_MODEL_ID,
  fallbackModelId: process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL_ID,
  apiKeyConfigured,
  perAttemptTimeoutMs: numberFromEnv("GEMINI_ATTEMPT_TIMEOUT_MS"),
  totalTimeoutMs: numberFromEnv("GEMINI_TOTAL_TIMEOUT_MS"),
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
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
