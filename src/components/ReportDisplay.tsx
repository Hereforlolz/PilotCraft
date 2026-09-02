import { AnalysisReport } from "../types";
import { CheckCircle2, AlertTriangle, XCircle, Users, BarChart3, ShieldAlert, Rocket, Info, FileText, HelpCircle, Activity, SplitSquareHorizontal, Ban, GraduationCap, Milestone } from "lucide-react";
import { motion } from "motion/react";

interface ReportDisplayProps {
  report: AnalysisReport;
}

export function ReportDisplay({ report }: ReportDisplayProps) {
  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'strong': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      case 'conditional': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'poor': return <XCircle className="w-6 h-6 text-rose-500" />;
      default: return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: 'bg-emerald-100 text-emerald-700',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-rose-100 text-rose-700'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${colors[severity as keyof typeof colors]}`}>
        {severity}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Executive Summary & Readiness */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Scenario Assessment</h2>
          </div>
          <p className="text-slate-600 leading-relaxed mb-6">
            {report.problemStatement}
          </p>
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            {getRatingIcon(report.aiSuitability.rating)}
            <div>
              <p className="font-semibold text-slate-900 capitalize">AI Suitability: {report.aiSuitability.rating}</p>
              <p className="text-sm text-slate-600 mt-1">{report.aiSuitability.rationale}</p>
            </div>
          </div>
        </div>

        <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium uppercase tracking-wider">Readiness Score</span>
            </div>
            <div className="text-6xl font-bold mb-4">{report.readinessScore.score}%</div>
            <p className="text-indigo-100 text-sm leading-relaxed italic">
              "{report.readinessScore.explanation}"
            </p>
          </div>
          {report.readinessScore.factorsReducingScore.length > 0 && (
            <div className="mt-6 pt-6 border-t border-indigo-500/30">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200 mb-2">Priority Gaps</p>
              <ul className="space-y-1">
                {report.readinessScore.factorsReducingScore.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-xs text-indigo-100 flex items-start gap-2">
                    <span className="mt-1 w-1 h-1 bg-indigo-300 rounded-full shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Clarifying Questions & Evidence */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Clarifying Questions</h3>
          </div>
          <ul className="space-y-3">
            {report.clarifyingQuestions.map((q, i) => (
              <li key={i} className="flex gap-3 text-slate-600 text-sm">
                <span className="text-amber-500 font-bold">Q{i + 1}.</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Info className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Evidence Check</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">User-Provided Facts</p>
              <p className="text-sm text-slate-600">{report.evidenceCheck.userProvidedFacts.join(", ") || "No facts extracted from the scenario."}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Assumptions</p>
              <p className="text-sm text-slate-600">{report.evidenceCheck.assumptions.join(", ") || "No major assumptions identified."}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Missing Evidence</p>
              <p className="text-sm text-slate-600">{report.evidenceCheck.missingEvidence.join(", ") || "Information complete."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow & Responsibilities */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
            <Rocket className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Future Workflow</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Step</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Human Role</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">AI Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.futureWorkflow.map((w, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{w.step}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{w.humanRole}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{w.aiRole}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Responsibility Split */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <SplitSquareHorizontal className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Human / AI Responsibility Split</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Stays With Humans</p>
            <ul className="space-y-2">
              {report.responsibilitySplit.human.map((item, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                  <Users className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Handled By AI</p>
            <ul className="space-y-2">
              {report.responsibilitySplit.ai.map((item, i) => (
                <li key={i} className="text-sm text-indigo-900 flex items-start gap-2 bg-indigo-50 rounded-lg p-2.5 border border-indigo-100">
                  <Activity className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Risks & Stakeholders */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Risk Assessment</h3>
          </div>
          <div className="space-y-6">
            {report.risks.map((r, i) => (
              <div key={i} className="relative pl-4 border-l-2 border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-slate-900">{r.risk}</h4>
                  {getSeverityBadge(r.severity)}
                </div>
                <p className="text-xs text-slate-500 mb-2 italic">Review: {r.humanReview}</p>
                <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-100/50">
                  <p className="text-xs text-rose-700 font-medium">Safeguard: {r.safeguard}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-cyan-50 rounded-lg text-cyan-600">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Stakeholder Impact</h3>
          </div>
          <div className="space-y-4">
            {report.stakeholders.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-900">{s.role}</p>
                  <p className="text-xs text-slate-500">{s.involvement}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-widest block mb-0.5">Impact</span>
                  <p className="text-xs font-bold text-cyan-600 uppercase">{s.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Adoption Barriers & Training */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <Ban className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Adoption Barriers</h3>
          </div>
          <div className="space-y-4">
            {report.adoptionBarriers.map((b, i) => (
              <div key={i} className="relative pl-4 border-l-2 border-slate-100">
                <p className="text-sm font-bold text-slate-900 mb-1">{b.barrier}</p>
                <p className="text-xs text-slate-500">Mitigation: {b.mitigation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Training &amp; Communication</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Training Actions</p>
              <ul className="space-y-1.5">
                {report.trainingAndCommunication.trainingActions.map((a, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-1 text-teal-400 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Communication Actions</p>
              <ul className="space-y-1.5">
                {report.trainingAndCommunication.communicationActions.map((a, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-1 text-teal-400 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pilot Plan & Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Rocket className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Pilot Implementation Plan</h3>
          </div>
          <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {report.pilotPlan.map((p, i) => (
              <div key={i} className="relative pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-emerald-600">{i + 1}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <h4 className="text-sm font-bold text-slate-900">{p.period}</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Owner: {p.suggestedOwner}</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mb-3">
                  {p.actions.map((a, j) => (
                    <li key={j} className="text-xs text-slate-600 flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400 shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-slate-400 italic">Collect: {p.evidenceToCollect.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/10 rounded-lg text-white">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold">Success Metrics</h3>
          </div>
          <div className="space-y-6">
            {report.successMetrics.map((m, i) => (
              <div key={i} className="space-y-2">
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">{m.metric}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-2 rounded-lg">
                    <p className="text-[10px] text-slate-400 uppercase">Baseline</p>
                    <p className="text-sm font-bold">{m.baseline}</p>
                  </div>
                  <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
                    <p className="text-[10px] text-indigo-300 uppercase">Target</p>
                    <p className="text-sm font-bold text-indigo-100">{m.proposedTarget}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">Collection method: {m.collectionMethod}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decision Criteria */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
            <Milestone className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Go / No-Go Criteria</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
            <p className="text-xs font-bold text-rose-700 uppercase tracking-widest mb-2">Stop</p>
            <ul className="space-y-1.5">
              {report.decisionCriteria.stop.map((c, i) => (
                <li key={i} className="text-sm text-rose-900">{c}</li>
              ))}
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Revise</p>
            <ul className="space-y-1.5">
              {report.decisionCriteria.revise.map((c, i) => (
                <li key={i} className="text-sm text-amber-900">{c}</li>
              ))}
            </ul>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Scale</p>
            <ul className="space-y-1.5">
              {report.decisionCriteria.scale.map((c, i) => (
                <li key={i} className="text-sm text-emerald-900">{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
