#!/usr/bin/env -S npx tsx
/**
 * PilotCraft evaluation harness.
 *
 * Runs every scenario in ./scenarios.ts through the real /api/analyze
 * pipeline (via app.ts's createApp(), same code that ships to production),
 * evaluates each report against the deterministic checks in ./checks.ts,
 * and writes results to evals/results/latest.json and evals/results.md.
 *
 * Usage:
 *   npm run eval              # live mode - requires GEMINI_API_KEY, calls real Gemini
 *   npm run eval -- --fixtures # demo mode - canned responses, no key, no network, reproducible
 *   npm run eval -- --strict   # exit 1 if any check fails (either mode)
 *
 * See README.md's "Evaluation harness" section for details.
 */
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { createApp } from "../app";
import type { GenerateContentFn } from "../runAnalysisRoute";
import { EVAL_SCENARIOS, type EvalScenario } from "./scenarios";
import { CANNED_RESPONSES } from "./fixtures";
import { runAllChecks, type CheckResult } from "./checks";
import type { AnalysisReport } from "../src/types";

const args = process.argv.slice(2);
const useFixtures = args.includes("--fixtures") || !process.env.GEMINI_API_KEY;
const strict = args.includes("--strict");

if (!args.includes("--fixtures") && !process.env.GEMINI_API_KEY) {
  console.log("No GEMINI_API_KEY set - falling back to --fixtures (canned responses) mode.\n");
}

interface ScenarioRunResult {
  id: string;
  title: string;
  category: EvalScenario["category"];
  status: "evaluated" | "error";
  errorMessage?: string;
  checks: CheckResult[];
}

function makeFixtureGenerateContent(scenarioId: string): GenerateContentFn {
  return async () => {
    const canned = CANNED_RESPONSES[scenarioId];
    if (!canned) {
      throw new Error(`No canned response for scenario "${scenarioId}" - add one to evals/fixtures.ts`);
    }
    return { text: JSON.stringify(canned) };
  };
}

function makeLiveGenerateContent(): GenerateContentFn {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return (params) => ai.models.generateContent(params);
}

async function runScenario(scenario: EvalScenario): Promise<ScenarioRunResult> {
  const generateContent = useFixtures ? makeFixtureGenerateContent(scenario.id) : makeLiveGenerateContent();
  const app = createApp({ generateContent });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: scenario.scenario }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text();
      return { id: scenario.id, title: scenario.title, category: scenario.category, status: "error", errorMessage: `HTTP ${res.status}: ${body}`, checks: [] };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let report: AnalysisReport | null = null;
    let errorMessage: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        if (!chunk.startsWith("event: ")) continue;
        const [eventLine, dataLine] = chunk.split("\ndata: ");
        const eventType = eventLine.replace("event: ", "");
        if (eventType === "result") {
          report = JSON.parse(dataLine);
        } else if (eventType === "error") {
          errorMessage = JSON.parse(dataLine).message;
        }
      }
    }

    if (!report) {
      return { id: scenario.id, title: scenario.title, category: scenario.category, status: "error", errorMessage: errorMessage ?? "No result event received", checks: [] };
    }

    return { id: scenario.id, title: scenario.title, category: scenario.category, status: "evaluated", checks: runAllChecks(report, scenario) };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function summarizeChecks(results: ScenarioRunResult[]) {
  const byCheckId = new Map<string, { pass: number; fail: number; skipped: number; failures: { scenarioId: string; detail: string }[] }>();
  for (const r of results) {
    for (const check of r.checks) {
      const bucketId = check.checkId.replace(/\[\d+\]$/, "[]"); // fold per-item checks (e.g. risks[0], risks[1]) together
      const bucket = byCheckId.get(bucketId) ?? { pass: 0, fail: 0, skipped: 0, failures: [] };
      bucket[check.status]++;
      if (check.status === "fail") bucket.failures.push({ scenarioId: r.id, detail: `${check.description}: ${check.detail}` });
      byCheckId.set(bucketId, bucket);
    }
  }
  return byCheckId;
}

function toMarkdown(results: ScenarioRunResult[], mode: string, generatedAt: string): string {
  const lines: string[] = [];
  lines.push("# PilotCraft evaluation results");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Mode: **${mode}**${mode === "fixtures" ? " (canned responses - demonstrates the harness itself, not live Gemini quality)" : ""}`);
  lines.push("");

  const evaluated = results.filter((r) => r.status === "evaluated");
  const errored = results.filter((r) => r.status === "error");
  const totalChecks = evaluated.flatMap((r) => r.checks).filter((c) => c.status !== "skipped");
  const totalPass = totalChecks.filter((c) => c.status === "pass").length;

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Scenarios evaluated: ${evaluated.length}/${results.length}${errored.length ? ` (${errored.length} errored - see below)` : ""}`);
  lines.push(`- Checks passed: ${totalPass}/${totalChecks.length}${totalChecks.length ? ` (${Math.round((totalPass / totalChecks.length) * 100)}%)` : ""}`);
  lines.push("");

  lines.push("## Per-scenario results");
  lines.push("");
  lines.push("| Scenario | Category | Status | Checks passed |");
  lines.push("|---|---|---|---|");
  for (const r of results) {
    if (r.status === "error") {
      lines.push(`| ${r.title} | ${r.category} | ⚠️ error | - |`);
      continue;
    }
    const applicable = r.checks.filter((c) => c.status !== "skipped");
    const passed = applicable.filter((c) => c.status === "pass").length;
    const marker = passed === applicable.length ? "✅" : "❌";
    lines.push(`| ${r.title} | ${r.category} | ${marker} | ${passed}/${applicable.length} |`);
  }
  lines.push("");

  if (errored.length) {
    lines.push("## Errored scenarios");
    lines.push("");
    for (const r of errored) {
      lines.push(`- **${r.title}**: ${r.errorMessage}`);
    }
    lines.push("");
  }

  lines.push("## Pass rate by check");
  lines.push("");
  lines.push("| Check | Pass | Fail | Skipped | Pass rate (of applicable) |");
  lines.push("|---|---|---|---|---|");
  const byCheck = summarizeChecks(evaluated);
  for (const [checkId, stats] of [...byCheck.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const applicable = stats.pass + stats.fail;
    const rate = applicable ? `${Math.round((stats.pass / applicable) * 100)}%` : "n/a";
    lines.push(`| ${checkId} | ${stats.pass} | ${stats.fail} | ${stats.skipped} | ${rate} |`);
  }
  lines.push("");

  const anyFailures = [...byCheck.values()].some((s) => s.failures.length > 0);
  if (anyFailures) {
    lines.push("## Failure patterns");
    lines.push("");
    for (const [checkId, stats] of byCheck.entries()) {
      if (stats.failures.length === 0) continue;
      lines.push(`### ${checkId}`);
      lines.push("");
      for (const f of stats.failures) {
        lines.push(`- **${f.scenarioId}**: ${f.detail}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("_Generated by `evals/runEval.ts` - see README.md's \"Evaluation harness\" section for how to run this yourself._");

  return lines.join("\n") + "\n";
}

async function main() {
  const mode = useFixtures ? "fixtures" : "live";
  console.log(`Running ${EVAL_SCENARIOS.length} scenarios in ${mode} mode...\n`);

  const results: ScenarioRunResult[] = [];
  for (const scenario of EVAL_SCENARIOS) {
    process.stdout.write(`  ${scenario.id}... `);
    const result = await runScenario(scenario);
    results.push(result);
    if (result.status === "error") {
      console.log(`ERROR (${result.errorMessage})`);
    } else {
      const applicable = result.checks.filter((c) => c.status !== "skipped");
      const passed = applicable.filter((c) => c.status === "pass").length;
      console.log(`${passed}/${applicable.length} checks passed`);
    }
  }

  const generatedAt = new Date().toISOString();
  const evalsDir = path.dirname(fileURLToPath(import.meta.url));
  const resultsDir = path.join(evalsDir, "results");
  mkdirSync(resultsDir, { recursive: true });

  const jsonPath = path.join(resultsDir, "latest.json");
  writeFileSync(jsonPath, JSON.stringify({ mode, generatedAt, results }, null, 2) + "\n");

  const mdPath = path.join(evalsDir, "results.md");
  writeFileSync(mdPath, toMarkdown(results, mode, generatedAt));

  console.log(`\nWrote ${path.relative(process.cwd(), jsonPath)} and ${path.relative(process.cwd(), mdPath)}`);

  const totalFail = results.flatMap((r) => r.checks).filter((c) => c.status === "fail").length;
  const totalErrors = results.filter((r) => r.status === "error").length;
  if (strict && (totalFail > 0 || totalErrors > 0)) {
    console.error(`\n--strict: ${totalFail} check failure(s), ${totalErrors} scenario error(s).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
