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

// TRUST_PROXY configures Express's "trust proxy" setting - only set this
// when actually deployed behind a reverse proxy you control (e.g. "1" for
// one hop on Cloud Run). Left unset, no proxy is trusted and req.ip is the
// real socket address, so a directly reachable instance can't have its
// rate-limit identity spoofed via a forged X-Forwarded-For header.
function parseTrustProxy(value: string | undefined): boolean | number | string | undefined {
  if (value === undefined || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? value : asNumber;
}

const app = createApp({
  generateContent: (params) => ai.models.generateContent(params),
  primaryModelId: DEFAULT_PRIMARY_MODEL_ID,
  fallbackModelId: DEFAULT_FALLBACK_MODEL_ID,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
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
