#!/usr/bin/env -S npx tsx
/**
 * Generates the pre-baked sample reports shown by the sample buttons.
 *
 * Runs each scenario in src/sampleScenarios.ts through the real /api/analyze
 * pipeline (createApp - same retries, validation and repair as production)
 * using your GEMINI_API_KEY, and writes src/bakedSamples.json. Nothing is
 * written unless every sample succeeds.
 *
 *   npm run bake-samples
 *
 * Read the printed summary and skim the reports before committing: generated
 * reports can misstate the input (see README "Honest limitations").
 */
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { createApp, DEFAULT_PRIMARY_MODEL_ID, DEFAULT_FALLBACK_MODEL_ID, DEFAULT_EXTRA_MODEL_IDS } from "../app";
import type { GenerateContentFn } from "../runAnalysisRoute";
import { SAMPLE_SCENARIOS } from "../src/sampleScenarios";
import type { BakedSample } from "../src/bakedSamples";
import type { AnalysisReport } from "../src/types";

dotenv.config();

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
  console.error("GEMINI_API_KEY is not set. Put a real key in a gitignored .env (see .env.example) and re-run: npm run bake-samples");
  process.exit(1);
}

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "bakedSamples.json");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function bake(id: string, scenario: string): Promise<BakedSample> {
  // Record which model produced the accepted response (the last call made),
  // the same way evals/runEval.ts does.
  let answeredBy = "unknown";
  const generateContent: GenerateContentFn = async (params) => {
    const response = await ai.models.generateContent(params);
    answeredBy = (params as { model?: string }).model ?? "unknown";
    return response;
  };
  const app = createApp({
    generateContent,
    primaryModelId: process.env.GEMINI_PRIMARY_MODEL || DEFAULT_PRIMARY_MODEL_ID,
    fallbackModelId: process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL_ID,
    extraModelIds: (process.env.GEMINI_EXTRA_MODELS || DEFAULT_EXTRA_MODEL_IDS.join(",")).split(",").map((m) => m.trim()).filter(Boolean),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const text = await res.text();
    let report: AnalysisReport | undefined;
    let errorMessage: string | undefined;
    for (const chunk of text.split("\n\n")) {
      if (!chunk.startsWith("event: ")) continue;
      const [eventLine, dataLine] = chunk.split("\ndata: ");
      const type = eventLine.replace("event: ", "");
      if (type === "result") report = JSON.parse(dataLine);
      else if (type === "error") errorMessage = JSON.parse(dataLine).message;
    }
    if (!report) throw new Error(errorMessage ?? "No result event received");
    return { id, scenario, report, model: answeredBy, generatedAt: new Date().toISOString() };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const samples: BakedSample[] = [];
for (const s of SAMPLE_SCENARIOS) {
  process.stdout.write(`Baking "${s.title}"... `);
  try {
    const baked = await bake(s.id, s.text);
    samples.push(baked);
    console.log(`ok (${baked.model}) - suitability: ${baked.report.aiSuitability.rating}, readiness: ${baked.report.readinessScore.score}/100`);
  } catch (error: any) {
    console.log("FAILED");
    console.error(`  ${error?.message ?? error}`);
    console.error("Nothing was written. Fix the problem (try /api/health, model IDs, quota) and re-run.");
    process.exit(1);
  }
}

writeFileSync(outPath, JSON.stringify({ samples }, null, 2) + "\n");
console.log(`\nWrote ${samples.length} samples to src/bakedSamples.json. Review them, then commit.`);
