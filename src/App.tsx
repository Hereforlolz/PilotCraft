import { useState, useEffect } from 'react';
import { AnalysisReport } from './types';
import { ReportDisplay } from './components/ReportDisplay';
import { reportToMarkdown } from './reportToMarkdown';
import { DEMO_REPORT, DEMO_SCENARIO } from './demoReport';
import { SAMPLE_SCENARIOS, type SampleScenario } from './sampleScenarios';
import { findBakedSample, type BakedSample } from './bakedSamples';
import {
  BrainCircuit,
  Send,
  RefreshCcw,
  ShieldAlert,
  AlertCircle,
  Info,
  Terminal,
  Loader2,
  Lock,
  FileDown,
  Printer,
  FlaskConical,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MAX_SCENARIO_LENGTH = 4000; // keep in sync with app.ts

const COOLDOWN_SECONDS = 20;

export default function App() {
  const [scenario, setScenario] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [loadingStep, setLoadingStep] = useState('');
  const [isSample, setIsSample] = useState(false);
  // Set while the report on screen is a cached, pre-generated Gemini report.
  const [baked, setBaked] = useState<BakedSample | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [serverProblem, setServerProblem] = useState<string | null>(null);

  // Pre-flight: warn up front if the server has no API key, instead of
  // letting the first Generate click fail in front of an audience.
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => {
        if (!h?.apiKeyConfigured) setServerProblem('The server has no Gemini API key configured, so live analysis will fail. You can still view the sample report.');
      })
      .catch(() => setServerProblem('Cannot reach the PilotCraft server. You can still view the sample report.'));
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return;
    }
    const timer = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [isLoading]);

  const showSampleReport = () => {
    setScenario(DEMO_SCENARIO);
    setReport(DEMO_REPORT);
    setIsSample(true);
    setBaked(null);
    setError(null);
  };

  // Sample buttons show a pre-generated report instantly (no API call, no
  // rate-limit or daily-cap use) when one exists for exactly this text;
  // otherwise they fall back to a live analysis.
  const handleSampleClick = (sample: SampleScenario) => {
    const cached = findBakedSample(sample.id, sample.text);
    setScenario(sample.text);
    if (cached) {
      setReport(cached.report);
      setBaked(cached);
      setIsSample(false);
      setError(null);
    } else {
      handleAnalyze(sample.text);
    }
  };

  useEffect(() => {
    let timer: number;
    if (cooldown > 0) {
      timer = window.setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleAnalyze = async (scenarioToAnalyze: string = scenario) => {
    if (!scenarioToAnalyze.trim() || isLoading || cooldown > 0) return;

    setIsLoading(true);
    setError(null);
    setLoadingStep('Sending your scenario…');
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioToAnalyze }),
      });

      if (!response.ok) {
        let message = 'The analysis engine encountered an unexpected error.';
        try {
          const errorBody = await response.json();
          if (errorBody?.error) message = errorBody.error;
        } catch {
          // Response wasn't JSON; fall back to the generic message above.
        }
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const [eventPart, dataPart] = line.split('\ndata: ');
              if (dataPart === undefined) continue;
              const eventType = eventPart.replace('event: ', '');
              const eventData = JSON.parse(dataPart);

              if (eventType === 'status') {
                setLoadingStep(eventData);
              } else if (eventType === 'result') {
                setReport(eventData);
                setIsSample(false);
                setBaked(null);
                setCooldown(COOLDOWN_SECONDS);
              } else if (eventType === 'error') {
                throw new Error(eventData.message);
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const blob = new Blob([reportToMarkdown(report)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pilotcraft-adoption-strategy-report.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-800">Pilot<span className="text-indigo-600">Craft</span></h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <Lock className="w-3 h-3" />
              <span>Session Only Memory</span>
            </div>
          </div>
        </div>
      </header>

      {serverProblem && (
        <div role="alert" className="bg-amber-50 border-b border-amber-200 print:hidden">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 text-sm text-amber-900">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span className="flex-1">{serverProblem}</span>
            <button onClick={showSampleReport} className="font-bold underline underline-offset-2 hover:text-amber-700">View sample report</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Input Section */}
          <section className="lg:col-span-4 space-y-8 print:hidden">
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Define Your Scenario</h2>
              <p className="text-slate-500 leading-relaxed">
                Describe a workplace problem, workflow, or process you're considering for AI automation.
              </p>
            </div>

            <div className="relative group">
              <textarea
                id="scenario-input"
                className="w-full h-64 p-6 bg-white border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all resize-none shadow-sm group-hover:border-slate-300 text-slate-700 leading-relaxed"
                placeholder="Type your scenario here..."
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnalyze();
                }}
                maxLength={MAX_SCENARIO_LENGTH}
                disabled={isLoading}
                aria-label="Workplace scenario"
              />
              <span className={`absolute bottom-6 left-6 text-xs ${scenario.length > MAX_SCENARIO_LENGTH * 0.9 ? 'text-amber-600' : 'text-slate-400'}`}>
                {scenario.length}/{MAX_SCENARIO_LENGTH}
              </span>
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  onClick={() => handleAnalyze()}
                  disabled={!scenario.trim() || isLoading || cooldown > 0}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:shadow-none"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : cooldown > 0 ? (
                    <span>Wait {cooldown}s</span>
                  ) : (
                    <>
                      <span>Generate</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 -mt-4 px-1">Tip: press Ctrl/⌘ + Enter to generate.</p>

            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-3 items-start">
              <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-800 leading-relaxed">
                <strong>Privacy Warning:</strong> Do not enter credentials, names, protected health information, or confidential data. Reports are kept in memory for this session only.
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Try a sample scenario</p>
              <div className="space-y-2">
                {SAMPLE_SCENARIOS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => handleSampleClick(s)}
                    disabled={isLoading || (cooldown > 0 && !findBakedSample(s.id, s.text))}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 transition-all disabled:opacity-50 disabled:hover:bg-white"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      {s.title}
                      {findBakedSample(s.id, s.text) && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Instant</span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{s.text}</span>
                  </button>
                ))}
                <button
                  onClick={showSampleReport}
                  disabled={isLoading}
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-all disabled:opacity-50"
                >
                  <FlaskConical className="w-4 h-4" />
                  View a pre-built sample report (no AI call)
                </button>
              </div>
            </div>
          </section>

          {/* Result Section */}
          <section className="lg:col-span-8 print:col-span-12 min-h-[600px] relative">
            <AnimatePresence mode="wait">
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-50/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-12 print:hidden"
                >
                  <div className="relative mb-8">
                    <div className="w-20 h-20 border-4 border-indigo-100 rounded-full animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BrainCircuit className="w-10 h-10 text-indigo-600 animate-bounce" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{loadingStep}</h3>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Gemini is building your adoption plan. This usually takes 15-30 seconds.
                  </p>
                  <p className="text-slate-400 text-xs mt-3 tabular-nums">{elapsed}s elapsed</p>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="mb-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-2xl flex gap-4 items-start shadow-sm animate-in slide-in-from-top-4 duration-500 print:hidden">
                <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-rose-900">Analysis Failed</h3>
                  <p className="text-sm text-rose-800 mt-1 mb-4">{error}</p>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <button
                      onClick={() => handleAnalyze()}
                      className="flex items-center gap-2 text-rose-700 text-sm font-bold hover:underline"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Retry Assessment
                    </button>
                    <button
                      onClick={showSampleReport}
                      className="flex items-center gap-2 text-slate-700 text-sm font-bold hover:underline"
                    >
                      <FlaskConical className="w-3 h-3" />
                      View sample report instead
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!report && !isLoading && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-200 print:hidden">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6">
                  <Terminal className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-500 mb-2">No Active Assessment</h3>
                <p className="text-slate-500 text-sm max-w-sm">
                  Enter a workplace scenario on the left to generate a comprehensive AI adoption strategy.
                </p>
              </div>
            )}

            {report && (
              <div className={`${isLoading ? 'opacity-40 grayscale pointer-events-none' : ''} transition-all duration-500`}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    Adoption Strategy Report
                    {isSample ? (
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Sample - not generated by AI
                      </span>
                    ) : baked ? (
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Pre-generated by Gemini ({baked.model}) on {baked.generatedAt.slice(0, 10)} - cached, no live call
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        Draft v1.0
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-4 print:hidden">
                    <button
                      onClick={handleDownloadMarkdown}
                      className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-bold transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      Markdown
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-bold transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Print / Save as PDF
                    </button>
                    <button
                      onClick={() => handleAnalyze()}
                      disabled={isLoading || cooldown > 0}
                      className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>
                  </div>
                </div>
                <ReportDisplay report={report} />
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="bg-slate-100 py-12 mt-20 border-t border-slate-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="flex items-center gap-3 text-slate-400 grayscale">
            <BrainCircuit className="w-6 h-6" />
            <p className="text-xs font-bold uppercase tracking-widest">Powered by Gemini Flash</p>
          </div>
          <div className="flex items-center md:justify-end gap-6 text-slate-400 text-xs">
            <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> No Scenario Persistence</span>
            <span className="flex items-center gap-1.5"><Info className="w-3 h-3" /> Scenarios Sent to Gemini API</span>
          </div>
        </div>
        <p className="max-w-7xl mx-auto px-4 mt-8 text-xs text-slate-500 leading-relaxed">
          Data use: your scenario text, and the report Gemini generates from it, are processed by Google's Gemini API. If
          this demo runs on an unpaid (free-tier) API key, Google may use both to improve its products, and human
          reviewers may read them. Don't enter anything confidential. See the{' '}
          <a
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-indigo-600"
          >
            Gemini API terms
          </a>.
        </p>
      </footer>
    </div>
  );
}
