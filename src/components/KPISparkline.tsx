import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { KPI } from "@/src/types";
import { evaluateKPITrafficLight } from "@/src/lib/kpiTrafficLight";
import { RBMTooltip } from "./RBMTooltip";

interface KPISparklineProps {
  kpi: KPI;
  height?: number; // SVG height in pixels, default 42
  theme?: "dark" | "light"; // dark for header/dark cards, light for white cards
  compact?: boolean;
  showLabels?: boolean;
  viewMode?: "milestone" | "sparkline";
}

export interface SparklinePoint {
  period: string; // e.g. "2025", "2026", "2030"
  sortKey: number; // numeric year or fraction for x-position
  value: number;
  isBaseline: boolean; // e.g. historical baseline or 2025 baseline
  isReported: boolean; // actual recorded verified data point
  isInterpolated?: boolean; // projected/target endpoint
  label?: string;
  ragStatus?: "on_track" | "at_risk" | "off_track" | "pending";
  ragColor?: string;
}

export const KPISparkline: React.FC<KPISparklineProps> = ({
  kpi,
  height = 42,
  theme = "light",
  compact = false,
  showLabels = true,
  viewMode: externalViewMode,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<SparklinePoint | null>(null);
  const [internalViewMode, setInternalViewMode] = useState<"milestone" | "sparkline">("milestone");
  const activeViewMode = externalViewMode || internalViewMode;

  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tlEval2026 = useMemo(() => evaluateKPITrafficLight(kpi), [kpi]);
  const activeEvalYear = tlEval2026.evaluationYear;

  const cadence = kpi?.cadence || "Annual";
  const baseline = tlEval2026.baselineValue !== null ? tlEval2026.baselineValue : 0;
  const target = tlEval2026.target2030;

  const rawUnit = kpi?.unit || "%";
  const cleanUnit = (rawUnit || "%").replace(/reduction/gi, "").trim() || "%";
  const isDark = theme === "dark";

  // Unified Traffic Light Convention Colors
  const TL_GREEN = "#16a34a";
  const TL_YELLOW = "#f59e0b";
  const TL_RED = "#dc2626";
  const TL_GRAY = "#94a3b8";

  // Check if target direction is higher-is-better or lower-is-better
  const higherIsBetter = tlEval2026.higherIsBetter;

  // Window bounds
  const baselineYear = tlEval2026.baselineYear;
  const startYear = baselineYear;
  const endYear = 2030;
  const totalYears = tlEval2026.totalYears;

  // Compute on-track expected trajectory rate (linear path from baseline to 2030 target)
  const onTrackRatePerYear = tlEval2026.requiredAnnualPace !== null ? tlEval2026.requiredAnnualPace : 0;

  // Helper to determine RAG status for any given point
  const getPointRAG = (year: number, val: number): {
    status: "on_track" | "at_risk" | "off_track" | "pending";
    color: string;
    label: string;
  } => {
    if (target === null) {
      return { status: "pending", color: TL_GRAY, label: "Pending 2030 Target" };
    }
    const elapsed = Math.max(0, year - startYear);
    const expectedAtYear = baseline + onTrackRatePerYear * elapsed;

    if (elapsed === 0) {
      const improved = higherIsBetter ? val > baseline + 0.001 : val < baseline - 0.001;
      const regressed = higherIsBetter ? val < baseline - 0.001 : val > baseline + 0.001;
      if (improved) return { status: "on_track", color: TL_GREEN, label: "On track" };
      if (regressed) return { status: "off_track", color: TL_RED, label: "Off track" };
      return { status: "at_risk", color: TL_YELLOW, label: `At risk (${startYear} Base)` };
    }

    if (higherIsBetter) {
      if (val >= expectedAtYear - 0.001) {
        return { status: "on_track", color: TL_GREEN, label: "On track" };
      }
      if (val >= baseline - 0.001) {
        return { status: "at_risk", color: TL_YELLOW, label: "At risk" };
      }
      return { status: "off_track", color: TL_RED, label: "Off track" };
    } else {
      if (val <= expectedAtYear + 0.001) {
        return { status: "on_track", color: TL_GREEN, label: "On track" };
      }
      if (val <= baseline + 0.001) {
        return { status: "at_risk", color: TL_YELLOW, label: "At risk" };
      }
      return { status: "off_track", color: TL_RED, label: "Off track" };
    }
  };

  // Extract provided reported points and chronological sorting
  const { reportedPoints, latestReportedPoint } = useMemo(() => {
    if (!kpi) {
      return { reportedPoints: [], latestReportedPoint: null };
    }

    const hasReported2026 =
      (typeof kpi.value === "number" && !isNaN(kpi.value)) ||
      (kpi.yearValues && typeof kpi.yearValues[2026] === "number" && !isNaN(kpi.yearValues[2026]));

    if (!hasReported2026 && (!kpi.yearValues || Object.keys(kpi.yearValues).length === 0)) {
      return { reportedPoints: [], latestReportedPoint: null };
    }

    const map = new Map<number, SparklinePoint>();

    // 1. Add baseline if present
    if (typeof kpi.baseline === "number" && !isNaN(kpi.baseline)) {
      const rag = getPointRAG(baselineYear, kpi.baseline);
      map.set(baselineYear, {
        period: String(baselineYear),
        sortKey: baselineYear,
        value: kpi.baseline,
        isBaseline: true,
        isReported: true,
        isInterpolated: false,
        label: `${baselineYear} Baseline`,
        ragStatus: rag.status,
        ragColor: rag.color,
      });
    }

    // 2. Add recorded values from yearValues
    if (kpi.yearValues && typeof kpi.yearValues === "object") {
      Object.entries(kpi.yearValues).forEach(([yrStr, rawVal]) => {
        const yr = parseInt(yrStr, 10);
        if (!isNaN(yr) && typeof rawVal === "number" && !isNaN(rawVal)) {
          const isBase = yr === baselineYear;
          const rag = getPointRAG(yr, rawVal);
          map.set(yr, {
            period: String(yr),
            sortKey: yr,
            value: rawVal,
            isBaseline: isBase,
            isReported: true,
            isInterpolated: false,
            label: isBase ? `${yr} Baseline` : `${yr} Reported`,
            ragStatus: rag.status,
            ragColor: rag.color,
          });
        }
      });
    }

    // 3. Ensure latest reported value is included if reported
    if (typeof kpi.value === "number" && !isNaN(kpi.value) && !map.has(activeEvalYear)) {
      const yr = activeEvalYear;
      const rag = getPointRAG(yr, kpi.value);
      map.set(yr, {
        period: String(yr),
        sortKey: yr,
        value: kpi.value,
        isBaseline: yr === baselineYear,
        isReported: true,
        isInterpolated: false,
        label: `${yr} Reported`,
        ragStatus: rag.status,
        ragColor: rag.color,
      });
    }

    const pts = Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
    const latest = pts.length > 0 ? pts[pts.length - 1] : null;

    return {
      reportedPoints: pts,
      latestReportedPoint: latest,
    };
  }, [kpi, baseline, target, baselineYear, startYear, totalYears, onTrackRatePerYear]);

  // Projected value by 2030 based on current linear pace
  const projectedVal2030 = useMemo(() => {
    if (!latestReportedPoint || latestReportedPoint.sortKey >= 2030) return null;
    const elapsed = latestReportedPoint.sortKey - startYear;
    if (elapsed <= 0) return null;
    const paceSoFar = (latestReportedPoint.value - baseline) / elapsed;
    const remainingYears = 2030 - latestReportedPoint.sortKey;
    return latestReportedPoint.value + paceSoFar * remainingYears;
  }, [latestReportedPoint, startYear, baseline]);

  // Overall latest RAG status for badge & accent
  const currentRAG = useMemo(() => {
    if (!latestReportedPoint) return { status: "on_track" as const, color: TL_GREEN, label: "On track" };
    return getPointRAG(latestReportedPoint.sortKey, latestReportedPoint.value);
  }, [latestReportedPoint]);

  // SVG Scaled Dimensions
  const svgWidth = compact ? 120 : 280;
  const svgHeight = compact ? 32 : 56;
  const padLeft = compact ? 14 : 32;
  const padRight = compact ? 14 : 26;
  const padTop = compact ? 4 : 8;
  const padBottom = compact ? 4 : 18;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Y-axis scaling range
  const { yMin, yMax, yRange } = useMemo(() => {
    const vals: number[] = [baseline];
    if (target !== null) vals.push(target);
    reportedPoints.forEach((p) => vals.push(p.value));
    if (projectedVal2030 !== null) vals.push(projectedVal2030);

    let min = Math.min(...vals);
    let max = Math.max(...vals);

    if (min === max) {
      min -= 1;
      max += 1;
    }
    const padding = (max - min) * 0.15 || 1;
    const finalMin = min - padding;
    const finalMax = max + padding;
    return {
      yMin: finalMin,
      yMax: finalMax,
      yRange: finalMax - finalMin || 1,
    };
  }, [baseline, target, reportedPoints, projectedVal2030]);

  const getX = (year: number) => {
    const fraction = totalYears > 0 ? (year - startYear) / totalYears : 0;
    return padLeft + Math.max(0, Math.min(1, fraction)) * plotWidth;
  };

  const getY = (val: number) => {
    const fraction = (yMax - val) / yRange;
    return padTop + Math.max(0, Math.min(1, fraction)) * plotHeight;
  };

  const xStart = getX(startYear);
  const xEnd = getX(endYear);
  const yBase = getY(baseline);
  const yTarg = target !== null ? getY(target) : null;

  // 1. Path 1: Dashed on-track path from baseline to 2030 target
  const onTrackPath =
    target !== null && yTarg !== null
      ? `M ${xStart.toFixed(1)},${yBase.toFixed(1)} L ${xEnd.toFixed(1)},${yTarg.toFixed(1)}`
      : "";

  // 2. Path 2: Solid data series line for reported data points
  const reportedPath = useMemo(() => {
    if (reportedPoints.length < 2) return "";
    return reportedPoints
      .map((p, idx) => {
        const x = getX(p.sortKey);
        const y = getY(p.value);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [reportedPoints, startYear, totalYears, yMin, yRange]);

  // 3. Path 3: Dotted pace line where current pace leads (latest point to 2030 projected)
  const currentPacePath = useMemo(() => {
    if (!latestReportedPoint || projectedVal2030 === null || latestReportedPoint.sortKey >= 2030) {
      return "";
    }
    const x1 = getX(latestReportedPoint.sortKey);
    const y1 = getY(latestReportedPoint.value);
    const x2 = getX(2030);
    const y2 = getY(projectedVal2030);
    return `M ${x1.toFixed(1)},${y1.toFixed(1)} L ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }, [latestReportedPoint, projectedVal2030, startYear, totalYears, yMin, yRange]);

  // Tooltip positioning
  useEffect(() => {
    if (!hoveredPoint || !containerRef.current) {
      setCoords(null);
      return;
    }
    const updateCoords = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const tooltipWidth = 224;
      const tooltipHeight = 110;
      const px = getX(hoveredPoint.sortKey);
      const anchorX = rect.left + (px / svgWidth) * rect.width;

      let left = anchorX - tooltipWidth / 2;
      if (left < 12) left = 12;
      if (left + tooltipWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - tooltipWidth - 12);
      }
      let top = rect.top - tooltipHeight - 8;
      if (top < 12) {
        top = rect.bottom + 8;
      }
      if (top + tooltipHeight > window.innerHeight - 12) {
        top = Math.max(12, window.innerHeight - tooltipHeight - 12);
      }
      setCoords({
        top,
        left,
      });
    };
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [hoveredPoint]);

  if (!kpi) return null;

  // Awaiting reporting cycle state (no reported data points)
  if (reportedPoints.length === 0) {
    if (compact) {
      return (
        <div className="w-full text-center font-mono text-[9px] text-slate-400 py-1 px-1.5 rounded bg-slate-100 border border-slate-200">
          Pending report
        </div>
      );
    }
    return (
      <div className="w-full select-none">
        <div
          className={`flex items-center justify-between text-[10px] font-mono py-1 px-2.5 rounded-lg border ${
            isDark
              ? "bg-slate-800/60 border-slate-700/60 text-slate-300"
              : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-slate-400/80" />
            Cadence: {cadence}
          </span>
          <span className="italic opacity-80 text-[9.5px]">Pending 2026 report</span>
        </div>
      </div>
    );
  }

  // Milestone Bar geometry for Option 1
  const renderMilestoneBar = () => {
    const latestVal = latestReportedPoint ? latestReportedPoint.value : baseline;
    const latestYr = latestReportedPoint ? latestReportedPoint.sortKey : activeEvalYear;
    const basePct = 18;
    const spanVal = target !== null ? Math.abs(target - baseline) || 1 : 1;
    const signedDelta = higherIsBetter ? latestVal - baseline : baseline - latestVal;
    const elapsed2026 = Math.max(0, latestYr - startYear);
    const expected2026Val = baseline + onTrackRatePerYear * elapsed2026;
    const expectedSignedDelta = higherIsBetter ? expected2026Val - baseline : baseline - expected2026Val;

    const valToPct = (delta: number) => {
      if (target === null) return 60;
      if (delta >= 0) {
        const ratio = Math.min(1, delta / spanVal);
        return basePct + ratio * (100 - basePct);
      } else {
        const regRatio = Math.min(1, Math.abs(delta) / Math.max(spanVal * 0.25, 10));
        return Math.max(3, basePct - regRatio * (basePct - 3));
      }
    };

    const actualPct = valToPct(signedDelta);
    const expectedPct = valToPct(expectedSignedDelta);

    if (compact) {
      const barAccent =
        currentRAG.status === "on_track"
          ? "green"
          : currentRAG.status === "at_risk"
          ? "amber"
          : currentRAG.status === "off_track"
          ? "red"
          : "slate";

      return (
        <RBMTooltip
          title={kpi.kpiCode ? `${kpi.kpiCode} • ${kpi.name}` : kpi.name}
          badgeText={tlEval2026.badgeLabel}
          accent={barAccent}
          widthClass="w-72"
          className="w-full block"
          content={
            <div className="space-y-1.5 text-left">
              <div className="font-mono font-bold text-white text-[10px]">
                {tlEval2026.ruleApplied}
              </div>
              <p className="text-[10px] text-blue-100/90 leading-relaxed">
                {tlEval2026.varianceSummary}
              </p>
            </div>
          }
        >
          <div className="w-full flex flex-col gap-0.5 select-none pr-1">
            <div className="relative h-3 w-full rounded bg-slate-100 border border-slate-300 overflow-hidden">
              {/* Regression Zone */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-rose-100/80"
                style={{ width: `${basePct}%` }}
              />
              {/* Traffic Light Bar */}
              {signedDelta >= 0 ? (
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${basePct}%`,
                    width: `${Math.max(3, actualPct - basePct)}%`,
                    backgroundColor: currentRAG.color,
                  }}
                />
              ) : (
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${actualPct}%`,
                    width: `${Math.max(3, basePct - actualPct)}%`,
                    backgroundColor: TL_RED,
                  }}
                />
              )}
              {/* Baseline Divider */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-700 z-10"
                style={{ left: `${basePct}%` }}
              />
              {/* 2026 Expected Milestone Tick */}
              {target !== null && elapsed2026 > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 border-l border-dashed border-[#2563eb] z-10"
                  style={{ left: `${expectedPct}%` }}
                />
              )}
              {/* 2030 Target Right Edge */}
              {target !== null && (
                <div
                  className="absolute top-0 bottom-0 right-0 w-1 z-10"
                  style={{ backgroundColor: TL_GREEN }}
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-1 text-[7.5px] font-mono text-slate-500 leading-none px-0.5">
              <span className="whitespace-nowrap">
                {startYear}: {tlEval2026.baselineValue !== null ? hoverPointFormatted(baseline) : "—"}
              </span>
              <span
                className="font-bold whitespace-nowrap"
                style={{ color: currentRAG.status === "at_risk" ? "#b45309" : currentRAG.color }}
              >
                {hoverPointFormatted(latestVal)}
                {cleanUnit === "%" ? "%" : ""}
              </span>
              <span className="whitespace-nowrap">
                {target !== null ? hoverPointFormatted(target) : "—"}
                {target !== null && cleanUnit === "%" ? "%" : ""}
              </span>
            </div>
          </div>
        </RBMTooltip>
      );
    }

    return (
      <div className="w-full space-y-1.5 pt-1">
        <div className="relative h-5 w-full rounded-md bg-slate-100 border border-slate-300 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 left-0 bg-rose-100/80"
            style={{ width: `${basePct}%` }}
          />
          {signedDelta >= 0 ? (
            <div
              className="absolute top-0 bottom-0 transition-all duration-300"
              style={{
                left: `${basePct}%`,
                width: `${Math.max(2, actualPct - basePct)}%`,
                backgroundColor: currentRAG.color,
              }}
            />
          ) : (
            <div
              className="absolute top-0 bottom-0 transition-all duration-300"
              style={{
                left: `${actualPct}%`,
                width: `${Math.max(2, basePct - actualPct)}%`,
                backgroundColor: TL_RED,
              }}
            />
          )}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-700 z-10"
            style={{ left: `${basePct}%` }}
          />
          {target !== null && elapsed2026 > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 border-l border-dashed border-[#2563eb] z-10"
              style={{ left: `${expectedPct}%` }}
            />
          )}
          {target !== null && (
            <div
              className="absolute top-0 bottom-0 right-0 w-1 z-10"
              style={{ backgroundColor: TL_GREEN }}
            />
          )}
        </div>
        {showLabels && (
          <div
            className={`flex items-center justify-between font-mono text-[8.5px] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            <span>
              {startYear} Base: {hoverPointFormatted(baseline)}
              {cleanUnit}
            </span>
            <span
              className="font-bold"
              style={{ color: currentRAG.status === "at_risk" ? "#b45309" : currentRAG.color }}
            >
              2026: {hoverPointFormatted(latestVal)}
              {cleanUnit}
            </span>
            <span>
              2030 Goal: {target !== null ? `${hoverPointFormatted(target)}${cleanUnit}` : "—"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`w-full relative select-none ${hoveredPoint ? "z-50" : ""}`}>
      {/* Header Info & View Switcher (when not compact) */}
      {!compact && (
        <div
          className={`flex items-center justify-between text-[9.5px] font-mono mb-1.5 flex-wrap gap-1 ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-[9px] border ${
                currentRAG.status === "on_track"
                  ? isDark
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : currentRAG.status === "at_risk"
                  ? isDark
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                  : isDark
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: currentRAG.color }}
              />
              <span>{currentRAG.label}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {!externalViewMode && (
              <div className="inline-flex items-center rounded bg-slate-200/70 dark:bg-slate-800 p-0.5 text-[8.5px] font-mono">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInternalViewMode("milestone");
                  }}
                  className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    activeViewMode === "milestone"
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Milestone Bar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInternalViewMode("sparkline");
                  }}
                  className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    activeViewMode === "sparkline"
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sparkline View
                </button>
              </div>
            )}

            {target !== null && (
              <span
                className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  isDark
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                Target: {target}
                {cleanUnit}
              </span>
            )}
          </div>
        </div>
      )}

      {activeViewMode === "milestone" ? (
        renderMilestoneBar()
      ) : (
        <>
          {/* Dark RBM Blue Floating Tooltip */}
          {hoveredPoint &&
            mounted &&
            coords &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed pointer-events-none w-56 max-w-[calc(100vw-24px)] rounded-lg bg-[#152243] text-white border border-[#2a437e] shadow-[0_14px_34px_-6px_rgba(9,16,36,0.55)] text-[11px] font-sans overflow-hidden transition-all"
                style={{
                  top: coords.top !== undefined ? `${coords.top}px` : undefined,
                  left: `${coords.left}px`,
                  borderTopWidth: "3px",
                  borderTopColor: hoveredPoint.ragColor || "#4bc2e7",
                  zIndex: 999999,
                }}
              >
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#1c2d57] border-b border-white/10 font-sans font-bold text-[10px]">
                  <span className="text-white">
                    {hoveredPoint.label || `${hoveredPoint.period} Data Point`}
                  </span>
                  <span
                    className="text-[8.5px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border border-white/15"
                    style={{
                      backgroundColor: `${hoveredPoint.ragColor || "#4bc2e7"}30`,
                      color: "#ffffff",
                    }}
                  >
                    {hoveredPoint.ragStatus
                      ? hoveredPoint.ragStatus.replace("_", " ").toUpperCase()
                      : "REPORTED"}
                  </span>
                </div>

                <div className="p-2.5 space-y-1 text-[10.5px]">
                  <div className="flex justify-between gap-4">
                    <span className="text-blue-200/80">Recorded Value:</span>
                    <span
                      className="font-mono font-bold"
                      style={{
                        color:
                          hoveredPoint.ragStatus === "at_risk"
                            ? "#fde68a"
                            : hoveredPoint.ragColor || "#ffffff",
                      }}
                    >
                      {hoverPointFormatted(hoveredPoint.value)} {cleanUnit}
                    </span>
                  </div>

                  {target !== null && (
                    <div className="flex justify-between gap-4 text-blue-200/80 text-[10px]">
                      <span>2030 Target:</span>
                      <span className="font-mono text-[#86efac] font-bold">
                        {target} {cleanUnit}
                      </span>
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}

          {/* SVG Trajectory Chart (Sparkline View) */}
          <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-hidden select-none"
              preserveAspectRatio="none"
            >
              <line
                x1={padLeft}
                y1={yBase}
                x2={padLeft + plotWidth}
                y2={yBase}
                stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
                strokeWidth="1"
              />

              {onTrackPath && (
                <path
                  d={onTrackPath}
                  fill="none"
                  stroke={isDark ? "rgba(148, 163, 184, 0.45)" : "rgba(100, 116, 139, 0.45)"}
                  strokeWidth="1.25"
                  strokeDasharray="3,3"
                />
              )}

              {currentPacePath && (
                <path
                  d={currentPacePath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="2,3"
                />
              )}

              {reportedPath && (
                <path
                  d={reportedPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={compact ? "1.5" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {target !== null && yTarg !== null && (
                <circle
                  cx={xEnd}
                  cy={yTarg}
                  r={compact ? 2.5 : 3.5}
                  fill={isDark ? "#02182b" : "#ffffff"}
                  stroke={TL_GREEN}
                  strokeWidth="1.5"
                />
              )}

              {projectedVal2030 !== null && (
                <circle
                  cx={xEnd}
                  cy={getY(projectedVal2030)}
                  r={compact ? 2.2 : 3}
                  fill={isDark ? "#02182b" : "#ffffff"}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
              )}

              {reportedPoints.map((p) => {
                const x = getX(p.sortKey);
                const y = getY(p.value);
                const isHovered = hoveredPoint?.period === p.period;
                const dotColor = p.ragColor || "#38bdf8";

                return (
                  <g key={`pt-${p.period}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : compact ? 4 : 4.5}
                      fill={dotColor}
                      opacity={isHovered ? 0.35 : 0.2}
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={compact ? 2.5 : 3.5}
                      fill={dotColor}
                      stroke={isDark ? "#02182b" : "#ffffff"}
                      strokeWidth="1.5"
                      className="transition-all"
                    />
                  </g>
                );
              })}

              {reportedPoints.map((p) => {
                const x = getX(p.sortKey);
                const hitWidth = 18;
                const left = Math.max(0, x - hitWidth / 2);

                return (
                  <rect
                    key={`hit-${p.period}`}
                    x={left}
                    y={0}
                    width={hitWidth}
                    height={svgHeight}
                    fill="#ffffff"
                    fillOpacity={0.001}
                    style={{ pointerEvents: "all" }}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>
          </div>

          {showLabels && !compact && (
            <div
              className={`flex items-center justify-between font-mono mt-1 pt-0.5 border-t text-[8.5px] ${
                isDark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500"
              }`}
            >
              <span className="flex items-center gap-0.5">
                <span className="font-semibold text-slate-500">{startYear}</span>
                <span className="text-[7.5px] opacity-75">(Base)</span>
              </span>

              {latestReportedPoint && latestReportedPoint.sortKey > startYear && latestReportedPoint.sortKey < endYear && (
                <span className="flex items-center gap-1 font-bold" style={{ color: currentRAG.color }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: currentRAG.color }} />
                  <span>{latestReportedPoint.sortKey}</span>
                  <span className="text-[7.5px] font-normal opacity-90">({currentRAG.label})</span>
                </span>
              )}

              <span className="flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <span>2030</span>
                <span className="text-[7.5px] opacity-75">(Target)</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function hoverPointFormatted(v: number): string {
  if (Math.abs(v) >= 100 && Number.isInteger(v)) return v.toFixed(0);
  if (Math.abs(v) >= 10) return Number(v.toFixed(1)).toString();
  return Number(v.toFixed(2)).toString();
}

export default KPISparkline;
