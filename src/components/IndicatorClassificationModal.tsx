import React from "react";
import { KPI } from "@/src/types";
import {
  evaluateKPITrafficLight,
  formatWithUnit,
  formatMetricNum,
} from "@/src/lib/kpiTrafficLight";

interface IndicatorClassificationModalProps {
  kpi: KPI | null;
  isOpen: boolean;
  onClose: () => void;
}

export const IndicatorClassificationModal: React.FC<IndicatorClassificationModalProps> = ({
  kpi,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !kpi) return null;

  const tlEval = evaluateKPITrafficLight(kpi);
  const evalYr = tlEval.evaluationYear;
  const diffUnitLabel =
    tlEval.unit === "%" ? "% pts" : tlEval.unit === "#" ? "units" : tlEval.unit;

  const statusBannerStyle =
    tlEval.status === "green"
      ? "bg-emerald-50 border-emerald-300 text-emerald-950"
      : tlEval.status === "amber"
      ? "bg-amber-50 border-amber-300 text-amber-950"
      : tlEval.status === "red"
      ? "bg-rose-50 border-rose-300 text-rose-950"
      : "bg-slate-100 border-slate-300 text-slate-800";

  const statusPillStyle =
    tlEval.status === "green"
      ? "bg-emerald-600 text-white"
      : tlEval.status === "amber"
      ? "bg-amber-400 text-slate-950"
      : tlEval.status === "red"
      ? "bg-rose-600 text-white"
      : "bg-slate-500 text-white";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 text-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150 relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="classification-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {kpi.kpiCode && (
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-mono font-bold">
                  {kpi.kpiCode}
                </span>
              )}
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                {kpi.unityStep || "Strategic Framework"}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${statusPillStyle}`}
              >
                <span
                  className="w-2 h-2 rounded-full bg-white/90 inline-block"
                />
                {tlEval.badgeLabel}
              </span>
            </div>
            <h3
              id="classification-title"
              className="text-base font-bold uppercase text-slate-900 mt-1.5 font-display leading-snug"
            >
              {kpi.name}
            </h3>
            {kpi.definition && (
              <div className="mt-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">
                  Indicator Definition:
                </span>
                <p className="text-xs text-slate-700 mt-0.5 font-sans leading-relaxed">
                  {kpi.definition}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* 1. Traffic-Light Status & Calculation Rationale (Columns J, K, L, M, N) */}
        <div className={`p-4 rounded-xl border space-y-3 ${statusBannerStyle}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-black/15"
                style={{ backgroundColor: tlEval.color }}
              />
              <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider">
                Traffic-Light Status &amp; Milestone Rationale
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white/80 border border-black/10 text-slate-700">
              {tlEval.indicatorTypeLabel}
            </span>
          </div>

          {/* Rule Triggered & Plain-Language Variance Explanation */}
          <div className="bg-white/90 rounded-lg p-3 border border-black/10 space-y-1.5 text-xs">
            <div className="font-mono font-bold text-slate-900 text-[11px]">
              {tlEval.ruleApplied}
            </div>
            <p className="text-slate-700 font-sans leading-relaxed text-xs">
              {tlEval.varianceSummary}
            </p>
          </div>

          {/* Metrics Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono text-xs">
            <div className="bg-white/90 p-2 rounded-lg border border-black/10">
              <div className="text-[9px] text-slate-500 uppercase font-bold">
                Base Year
              </div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                {tlEval.baselineYear}
              </div>
            </div>
            <div className="bg-white/90 p-2 rounded-lg border border-black/10">
              <div className="text-[9px] text-slate-500 uppercase font-bold">
                Baseline
              </div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                {formatWithUnit(tlEval.baselineValue, tlEval.unit)}
              </div>
            </div>
            <div className="bg-white/90 p-2 rounded-lg border border-black/10">
              <div className="text-[9px] text-slate-500 uppercase font-bold">
                {evalYr} Reported
              </div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                {formatWithUnit(tlEval.reported2026, tlEval.unit)}
              </div>
            </div>
            <div className="bg-white/90 p-2 rounded-lg border border-black/10">
              <div className="text-[9px] text-slate-500 uppercase font-bold">
                {evalYr} Milestone
              </div>
              <div className="font-extrabold text-blue-800 text-sm mt-0.5">
                {tlEval.expected2026 !== null
                  ? formatWithUnit(tlEval.expected2026, tlEval.unit)
                  : "—"}
              </div>
            </div>
            <div className="bg-white/90 p-2 rounded-lg border border-black/10 col-span-2 sm:col-span-1">
              <div className="text-[9px] text-slate-500 uppercase font-bold">
                2030 Target
              </div>
              <div className="font-extrabold text-emerald-700 text-sm mt-0.5">
                {tlEval.target2030 !== null
                  ? formatWithUnit(tlEval.target2030, tlEval.unit)
                  : "Not set"}
              </div>
            </div>
          </div>

          {/* Mathematical Formula & Quantitative Deltas (Light RBM Ice Surface) */}
          <div className="bg-[#F2F8FF] border border-blue-200 text-[#111827] rounded-lg p-2.5 font-mono text-[10.5px] space-y-1 leading-relaxed">
            <div className="text-[#2563eb] font-bold">
              Formula: {tlEval.milestoneFormulaText}
            </div>
            {tlEval.deltaVsBaseline !== null && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600 pt-1 border-t border-blue-200/70">
                <span>
                  vs. {tlEval.baselineYear} Baseline:{" "}
                  <strong className="text-[#111827]">
                    {tlEval.deltaVsBaseline >= 0 ? "+" : ""}
                    {formatMetricNum(tlEval.deltaVsBaseline)} {diffUnitLabel}
                  </strong>
                </span>
                {tlEval.deltaVsExpected2026 !== null && (
                  <span>
                    vs. {evalYr} Milestone:{" "}
                    <strong className="text-[#111827]">
                      {tlEval.deltaVsExpected2026 >= 0 ? "+" : ""}
                      {formatMetricNum(tlEval.deltaVsExpected2026)} {diffUnitLabel}
                      {tlEval.pctBelowOrAboveMilestone !== null
                        ? ` (${tlEval.pctBelowOrAboveMilestone >= 0 ? "+" : ""}${formatMetricNum(
                            tlEval.pctBelowOrAboveMilestone
                          )}%)`
                        : ""}
                    </strong>
                  </span>
                )}
                {tlEval.completionPct !== null && (
                  <span>
                    2030 Goal Progress:{" "}
                    <strong className="text-emerald-700">
                      {formatMetricNum(tlEval.completionPct)}%
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. Official User Classification Matrix */}
        <div className="space-y-3">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
            Official Indicator Classification
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Strategic Tier
              </div>
              <div className="font-bold text-slate-800 mt-0.5">
                {kpi.group || "Unity 30"}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Unity 30 Step
              </div>
              <div className="font-bold text-slate-800 mt-0.5">
                {kpi.unityStep || "—"}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Archetype Owner
              </div>
              <div className="font-bold text-slate-800 mt-0.5">
                {kpi.archetypeOwner || kpi.owner || "RBM Partnership"}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Reporting Lead
              </div>
              <div className="font-bold text-slate-800 mt-0.5">
                {kpi.reporter || "Programs / Data"}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Reporting Cadence
              </div>
              <div className="font-bold text-slate-800 mt-0.5">
                {kpi.cadence || "Annual"}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Primary Data Source
              </div>
              <div
                className="font-bold text-slate-800 mt-0.5 truncate"
                title={kpi.source}
              >
                {kpi.source || "RBM Reporting System"}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Data Quality & Data Availability Section */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Data Quality &amp; Data Availability
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Quality Cell */}
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[9.5px] font-mono text-slate-400 uppercase font-bold">
                  Data Quality
                </div>
                <div className="font-bold text-slate-800 text-xs mt-0.5 capitalize">
                  {kpi.qualityTrafficLight === "green"
                    ? "High (Verified)"
                    : kpi.qualityTrafficLight === "yellow"
                    ? "Moderate"
                    : kpi.qualityTrafficLight === "red"
                    ? "Under Review / Limitations"
                    : "Not Rated / Pending"}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs inline-block ${
                    kpi.qualityTrafficLight === "green"
                      ? "status-dot-green"
                      : kpi.qualityTrafficLight === "yellow"
                      ? "status-dot-yellow"
                      : kpi.qualityTrafficLight === "red"
                      ? "status-dot-red"
                      : "status-dot-unrated"
                  }`}
                  style={
                    kpi.qualityColor ? { backgroundColor: kpi.qualityColor } : undefined
                  }
                />
              </div>
            </div>

            {/* Availability Cell */}
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[9.5px] font-mono text-slate-400 uppercase font-bold">
                  Data Availability
                </div>
                <div className="font-bold text-slate-800 text-xs mt-0.5 capitalize">
                  {kpi.accessTrafficLight === "green"
                    ? "Available"
                    : kpi.accessTrafficLight === "yellow"
                    ? "Manual"
                    : kpi.accessTrafficLight === "red"
                    ? "Restricted / Manual PDF"
                    : "Not Rated"}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs inline-block ${
                    kpi.accessTrafficLight === "green"
                      ? "status-dot-green"
                      : kpi.accessTrafficLight === "red"
                      ? "status-dot-red"
                      : "status-dot-yellow"
                  }`}
                  style={
                    kpi.accessColor ? { backgroundColor: kpi.accessColor } : undefined
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Working Group Technical Note */}
        {kpi.comments && (
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs space-y-1">
            <div className="font-mono text-[10px] font-bold text-amber-900 uppercase">
              Working Group Technical Note
            </div>
            <p className="text-slate-700 italic text-[11px] leading-relaxed">
              &ldquo;{kpi.comments}&rdquo;
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-[#2563eb] hover:bg-blue-700 text-white font-sans text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default IndicatorClassificationModal;
