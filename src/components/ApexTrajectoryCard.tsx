import React, { useState, useMemo } from "react";
import { AlertTriangle, TrendingUp, ArrowDown, ArrowUp, CheckCircle2, Clock } from "lucide-react";
import { KPI } from "@/src/types";
import {
  evaluateKPITrafficLight,
  formatWithUnit,
  formatMetricNum,
} from "@/src/lib/kpiTrafficLight";
import { InfoIconButton, RBMTooltip } from "./RBMTooltip";

interface ApexTrajectoryCardProps {
  kpi: KPI;
  type?: "mortality" | "incidence" | "general";
  title?: string;
  theme?: "dark" | "light";
}

export const ApexTrajectoryCard: React.FC<ApexTrajectoryCardProps> = ({
  kpi,
  type = "general",
  title,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"milestone" | "sparkline">("milestone");
  const [showRationale, setShowRationale] = useState<boolean>(false);

  const tlEval = useMemo(() => evaluateKPITrafficLight(kpi), [kpi]);

  // Determine indicator type from kpi metadata
  const isMortality =
    type === "mortality" ||
    kpi.id === "kpi-19" ||
    kpi.id === "save-lives-mortality" ||
    kpi.kpiCode === "KPI.19";
  const isIncidence =
    type === "incidence" ||
    kpi.id === "kpi-20" ||
    kpi.id === "save-lives-morbidity" ||
    kpi.kpiCode === "KPI.20";
  const isApex = isMortality || isIncidence;

  // Dynamic time milestones from Google Sheet (Column J = baselineYear; latest reported column = reportedYear)
  const baselineYear = tlEval.baselineYear;
  const reportedYear = tlEval.evaluationYear;
  const targetYear = 2030;

  // Real numerical values from Google Sheet (no fabricated overrides)
  const hasReportedValue = tlEval.reported2026 !== null;
  const baselineVal = tlEval.baselineValue !== null ? tlEval.baselineValue : 0;
  const targetVal = tlEval.target2030 !== null ? tlEval.target2030 : 0;
  const reportedVal = tlEval.reported2026 !== null ? tlEval.reported2026 : baselineVal;

  const hasValidTarget = tlEval.target2030 !== null;

  const unit = tlEval.unit || "%";
  const cleanUnit = unit === "%" ? "%" : unit ? ` ${unit}` : "";
  const formatNum = (n: number) => {
    if (Math.abs(n) >= 100 && Number.isInteger(n)) return String(n);
    return Number(n.toFixed(1)).toString();
  };

  // Whether higher values represent better performance
  const higherIsBetter = tlEval.higherIsBetter;

  // Chronology math
  const totalYears = tlEval.totalYears;
  const elapsedYears = tlEval.elapsedYears;
  const remainingYears = Math.max(1, targetYear - reportedYear);

  // On-track expected path (linear progression from baselineYear to 2030 target)
  const onTrackRatePerYear = tlEval.requiredAnnualPace !== null ? tlEval.requiredAnnualPace : 0;
  const expectedVal2026 = tlEval.expected2026 !== null ? tlEval.expected2026 : baselineVal;

  // Gap to expected 2026 milestone (positive means behind schedule, <= 0 means on/ahead of schedule)
  const gapToExpected = higherIsBetter
    ? expectedVal2026 - reportedVal
    : reportedVal - expectedVal2026;

  // Current pace (baseline to reportedYear)
  const paceSoFar = elapsedYears > 0 ? (reportedVal - baselineVal) / elapsedYears : 0;
  const projectedVal2030 = reportedVal + paceSoFar * remainingYears;

  // Required pace (reportedYear to 2030)
  const paceNeeded = hasValidTarget ? (targetVal - reportedVal) / remainingYears : 0;

  // Years to reach 2030 target from reportedYear at current pace
  const targetAlreadyReached =
    hasReportedValue &&
    hasValidTarget &&
    (higherIsBetter ? reportedVal >= targetVal - 0.0001 : reportedVal <= targetVal + 0.0001);
  const isMovingTowardTarget =
    elapsedYears > 0 &&
    (higherIsBetter ? paceSoFar > 0.0001 : paceSoFar < -0.0001);
  const isMovingAwayFromTarget =
    elapsedYears > 0 &&
    (higherIsBetter ? paceSoFar < -0.0001 : paceSoFar > 0.0001);
  const yearsToReachTarget =
    targetAlreadyReached
      ? 0
      : isMovingTowardTarget && hasValidTarget
      ? Math.abs(targetVal - reportedVal) / Math.abs(paceSoFar)
      : null;
  const projectedTargetYear =
    yearsToReachTarget !== null ? Math.round(reportedYear + yearsToReachTarget) : null;

  // Card Title & In-Card Definition
  const cardTitle = title || kpi.name.toUpperCase();
  const cardDefinition =
    kpi.definition ||
    kpi.description ||
    "Strategic indicator monitored under the RBM Partnership Unity 30 & Big Push Framework.";

  // Direction vs baseline in plain language
  const diffFromBaseline = reportedVal - baselineVal;
  const absDiff = formatNum(Math.abs(diffFromBaseline));
  const absReported = formatNum(Math.abs(reportedVal));

  let directionText = "";
  if (!hasReportedValue) {
    directionText = `Pending ${reportedYear} data reporting`;
  } else if (!hasValidTarget) {
    directionText = `${formatWithUnit(reportedVal, unit)} reported in ${reportedYear} (${baselineYear} baseline: ${formatWithUnit(baselineVal, unit)}; 2030 target pending)`;
  } else if (isMortality) {
    directionText =
      reportedVal >= 0
        ? `${absReported}% lower mortality rate than in 2015`
        : `${absReported}% higher mortality rate than in 2015`;
  } else if (isIncidence) {
    directionText =
      reportedVal >= 0
        ? `${absReported}% lower case incidence than in 2015`
        : `${absReported}% higher case incidence than in 2015`;
  } else if (baselineYear === reportedYear && Math.abs(diffFromBaseline) < 0.001) {
    directionText = `${formatWithUnit(reportedVal, unit)} (${baselineYear} baseline established; target ${formatWithUnit(targetVal, unit)} by 2030)`;
  } else if (Math.abs(diffFromBaseline) < 0.001) {
    directionText = `${formatWithUnit(reportedVal, unit)} (unchanged vs ${baselineYear} baseline)`;
  } else if (diffFromBaseline > 0) {
    directionText = `${formatWithUnit(reportedVal, unit)} (+${absDiff}${cleanUnit} vs ${baselineYear} baseline of ${formatWithUnit(baselineVal, unit)})`;
  } else {
    directionText = `${formatWithUnit(reportedVal, unit)} (-${absDiff}${cleanUnit} vs ${baselineYear} baseline of ${formatWithUnit(baselineVal, unit)})`;
  }

  // Traffic Light Status determination grounded in evaluateKPITrafficLight
  const TL_GREEN = "#16a34a"; // On track (meets/exceeds milestone)
  const TL_YELLOW = "#f59e0b"; // At risk (unified Amber #f59e0b across badge & bar)
  const TL_RED = "#dc2626"; // Off track (worse than baseline)

  const ragStatus = tlEval.ragStatus;
  const ragLabel =
    ragStatus === "on_track"
      ? "On track"
      : ragStatus === "at_risk"
      ? baselineYear === reportedYear
        ? `At risk (${baselineYear} Baseline)`
        : "At risk"
      : ragStatus === "off_track"
      ? isIncidence
        ? "Off track (rising incidence)"
        : "Off track (below baseline)"
      : !hasReportedValue
      ? `Pending ${reportedYear} data`
      : "Pending 2030 target";
  const ragDotColor =
    ragStatus === "on_track"
      ? TL_GREEN
      : ragStatus === "at_risk"
      ? TL_YELLOW
      : ragStatus === "off_track"
      ? TL_RED
      : "#94a3b8";
  const ragDotGlow =
    ragStatus === "on_track"
      ? "rgba(22, 163, 74, 0.22)"
      : ragStatus === "at_risk"
      ? "rgba(245, 158, 11, 0.25)"
      : ragStatus === "off_track"
      ? "rgba(220, 38, 38, 0.22)"
      : "rgba(148, 163, 184, 0.25)";
  const ragBadgeClass =
    ragStatus === "on_track"
      ? "bg-emerald-50 text-[#15803d] border border-[#16a34a]/40"
      : ragStatus === "at_risk"
      ? "bg-amber-50 text-[#b45309] border border-[#f59e0b]/60"
      : ragStatus === "off_track"
      ? "bg-rose-50 text-[#b91c1c] border border-[#dc2626]/40"
      : "bg-slate-100 text-slate-600 border border-slate-200";

  const tooltipAccent =
    ragStatus === "on_track"
      ? "green"
      : ragStatus === "at_risk"
      ? "amber"
      : ragStatus === "off_track"
      ? "red"
      : "slate";

  const rationaleTooltipContent = (
    <div className="space-y-2">
      <div className="font-mono font-bold text-white text-[10.5px] leading-snug">
        {tlEval.ruleApplied}
      </div>
      <p className="text-blue-100/90 text-[10.5px] leading-relaxed">{tlEval.varianceSummary}</p>
      <div className="grid grid-cols-3 gap-1.5 pt-1 font-mono text-[9.5px] text-center">
        <div className="bg-[#1c2d57] p-1.5 rounded border border-white/10">
          <div className="text-[8px] text-blue-200/80 uppercase">{tlEval.baselineYear} Base</div>
          <div className="font-bold text-white mt-0.5">
            {formatWithUnit(tlEval.baselineValue, tlEval.unit)}
          </div>
        </div>
        <div className="bg-[#1c2d57] p-1.5 rounded border border-white/10">
          <div className="text-[8px] text-blue-200/80 uppercase">{reportedYear} Rep / Exp</div>
          <div className="font-bold text-[#4bc2e7] mt-0.5">
            {formatWithUnit(tlEval.reported2026, tlEval.unit)} /{" "}
            {tlEval.expected2026 !== null
              ? formatWithUnit(tlEval.expected2026, tlEval.unit)
              : "—"}
          </div>
        </div>
        <div className="bg-[#1c2d57] p-1.5 rounded border border-white/10">
          <div className="text-[8px] text-blue-200/80 uppercase">2030 Target</div>
          <div className="font-bold text-[#86efac] mt-0.5">
            {tlEval.target2030 !== null
              ? formatWithUnit(tlEval.target2030, tlEval.unit)
              : "Pending"}
          </div>
        </div>
      </div>
      <div className="text-[9.5px] font-mono text-blue-100 bg-[#1c2d57] px-2 py-1 rounded border border-white/10">
        <span className="text-[#4bc2e7] font-bold">Formula: </span>
        {tlEval.milestoneFormulaText}
      </div>
    </div>
  );

  const statusBadge = (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs ${ragBadgeClass}`}
    >
      <span
        className="w-2 h-2 rounded-full inline-block shrink-0"
        style={{ backgroundColor: ragDotColor }}
      />
      {ragStatus === "on_track" ? (
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
          <span>{ragLabel}</span>
        </span>
      ) : ragStatus === "at_risk" ? (
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>At risk</span>
        </span>
      ) : ragStatus === "off_track" ? (
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-[#dc2626]" />
          <span>{ragLabel}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{ragLabel}</span>
        </span>
      )}
    </span>
  );

  // SVG Scaled Axis Dimensions for Sparkline View
  const svgWidth = 580;
  const svgHeight = 210;
  const padLeft = 88;
  const padRight = 38;
  const padTop = 24;
  const padBottom = 38;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Intermediate reported points between baselineYear and reportedYear (e.g., 2026 when 2027 is also reported)
  const historicalPoints = useMemo(() => {
    const pts: { yr: number; val: number }[] = [{ yr: baselineYear, val: baselineVal }];
    if (kpi.yearValues && typeof kpi.yearValues === "object") {
      [2024, 2025, 2026, 2027, 2028, 2029, 2030].forEach((yr) => {
        const v = kpi.yearValues?.[yr];
        if (typeof v === "number" && !isNaN(v) && yr > baselineYear && yr <= reportedYear) {
          pts.push({ yr, val: v });
        }
      });
    }
    if (!pts.some((p) => p.yr === reportedYear) && hasReportedValue) {
      pts.push({ yr: reportedYear, val: reportedVal });
    }
    return pts.sort((a, b) => a.yr - b.yr);
  }, [kpi.yearValues, baselineYear, baselineVal, reportedYear, reportedVal, hasReportedValue]);

  const { yMin, yMax, yRange } = useMemo(() => {
    if (isApex) {
      return { yMin: -20, yMax: 100, yRange: 120 };
    }
    const vals = [baselineVal, reportedVal, ...historicalPoints.map((p) => p.val)];
    if (hasValidTarget) {
      vals.push(targetVal, expectedVal2026);
      if (elapsedYears > 0) vals.push(projectedVal2030);
    }
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const span = maxVal - minVal || 10;
    const padding = span * 0.18;
    const finalMin = Math.floor((minVal - padding) * 10) / 10;
    const finalMax = Math.ceil((maxVal + padding) * 10) / 10;
    return {
      yMin: finalMin,
      yMax: finalMax,
      yRange: finalMax - finalMin || 1,
    };
  }, [
    isApex,
    baselineVal,
    targetVal,
    reportedVal,
    historicalPoints,
    projectedVal2030,
    expectedVal2026,
    hasValidTarget,
    elapsedYears,
  ]);

  const getX = (year: number) => {
    const fraction = (year - baselineYear) / totalYears;
    return padLeft + Math.max(0, Math.min(1, fraction)) * plotWidth;
  };

  const getY = (val: number) => {
    const fraction = (yMax - val) / yRange;
    return padTop + Math.max(0, Math.min(1, fraction)) * plotHeight;
  };

  const xBase = getX(baselineYear);
  const x2026 = getX(reportedYear);
  const x2030 = getX(2030);

  const yTarget = getY(targetVal);
  const yExpected = getY(expectedVal2026);
  const yBaseCoord = getY(baselineVal);
  const yReported = getY(reportedVal);
  const yProjected = getY(projectedVal2030);
  const yBottom = getY(yMin);
  const yTop = getY(yMax);

  const xTicks = useMemo(() => {
    if (baselineYear <= 2016) {
      const baseTicks: { yr: number; label: string; sub: string; highlight: boolean }[] = [
        { yr: 2015, label: "2015", sub: "Baseline", highlight: false },
        { yr: 2018, label: "2018", sub: "", highlight: false },
        { yr: 2020, label: "2020", sub: "", highlight: false },
        { yr: 2023, label: "2023", sub: "", highlight: false },
      ];
      if (reportedYear > 2026) {
        baseTicks.push({ yr: 2026, label: "2026", sub: "", highlight: false });
      }
      baseTicks.push({ yr: reportedYear, label: String(reportedYear), sub: "Reported", highlight: true });
      baseTicks.push({ yr: 2030, label: "2030", sub: "Target", highlight: true });
      return baseTicks;
    }
    const ticks: { yr: number; label: string; sub: string; highlight: boolean }[] = [];
    if (baselineYear === reportedYear) {
      ticks.push({ yr: reportedYear, label: String(reportedYear), sub: "Baseline", highlight: true });
    } else {
      ticks.push({ yr: baselineYear, label: String(baselineYear), sub: "Baseline", highlight: false });
      historicalPoints.forEach((pt) => {
        if (pt.yr > baselineYear && pt.yr < reportedYear) {
          ticks.push({ yr: pt.yr, label: String(pt.yr), sub: "", highlight: false });
        }
      });
      ticks.push({ yr: reportedYear, label: String(reportedYear), sub: "Reported", highlight: true });
    }
    if (reportedYear < 2028 && baselineYear < 2028) {
      ticks.push({ yr: 2028, label: "2028", sub: "", highlight: false });
    }
    ticks.push({ yr: 2030, label: "2030", sub: "Target", highlight: true });

    const seenYears = new Set<number>();
    return ticks.filter((t) => {
      if (seenYears.has(t.yr)) return false;
      seenYears.add(t.yr);
      return true;
    });
  }, [baselineYear, reportedYear, historicalPoints]);

  const shadedY = higherIsBetter ? yBaseCoord : yTop;
  const shadedHeight = higherIsBetter ? yBottom - yBaseCoord : yBaseCoord - yTop;
  const uniquePatternId = `worse-pattern-${kpi.id || type}`;

  // Render the Traffic-Light Milestone Bar (Light RBM Card Style)
  const renderMilestoneBar = () => {
    if (!hasReportedValue) {
      return (
        <div className="mt-3 rounded-lg bg-[#F2F8FF] border border-blue-100 p-5 text-center space-y-1.5">
          <div className="text-xs font-mono font-bold text-[#1e3653] uppercase tracking-wider">
            Pending {reportedYear} Data
          </div>
          <p className="text-xs text-gray-600 max-w-md mx-auto">
            No baseline or {reportedYear} value has been reported for{" "}
            <strong className="text-[#111827]">{kpi.kpiCode || kpi.name}</strong> yet.
          </p>
        </div>
      );
    }

    if (!hasValidTarget) {
      return (
        <div className="mt-3 rounded-lg bg-[#F2F8FF] border border-blue-100 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-gray-600">
              {baselineYear} Baseline:{" "}
              <strong className="text-[#111827]">{formatWithUnit(baselineVal, unit)}</strong>
            </span>
            <span className="text-[#2563eb] font-bold">
              {reportedYear} Reported: {formatWithUnit(reportedVal, unit)}
            </span>
            <span className="text-gray-500">2030 Target: Pending</span>
          </div>
          <div className="h-5 w-full rounded bg-white border border-blue-200 overflow-hidden flex items-center justify-center px-3">
            <span className="text-[10px] font-mono text-gray-600">
              Pending Target: Reported {formatWithUnit(reportedVal, unit)}, awaiting 2030 Target
            </span>
          </div>
        </div>
      );
    }

    const basePct = 15;
    const spanVal = Math.abs(targetVal - baselineVal) || 1;
    const signedDelta = higherIsBetter ? reportedVal - baselineVal : baselineVal - reportedVal;
    const expectedSignedDelta = higherIsBetter
      ? expectedVal2026 - baselineVal
      : baselineVal - expectedVal2026;

    const valToPct = (deltaFromBase: number) => {
      if (deltaFromBase >= 0) {
        const ratio = Math.min(1, deltaFromBase / spanVal);
        return basePct + ratio * (100 - basePct);
      } else {
        const regRatio = Math.min(1, Math.abs(deltaFromBase) / Math.max(spanVal * 0.25, 10));
        return Math.max(2, basePct - regRatio * (basePct - 2));
      }
    };

    const actual2026Pct = valToPct(signedDelta);
    const expected2026Pct = valToPct(expectedSignedDelta);
    const clampPinPct = (pct: number) => Math.max(10, Math.min(90, pct));

    const currentTrafficColor =
      ragStatus === "on_track" ? TL_GREEN : ragStatus === "at_risk" ? TL_YELLOW : TL_RED;

    return (
      <div className="mt-3 rounded-lg bg-[#F2F8FF]/80 border border-blue-100 p-4">
        {/* Traffic Light Convention Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 text-[10px] font-mono text-gray-600">
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: TL_GREEN }}
              />
              <span>Green (On Track)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: TL_YELLOW }}
              />
              <span>Amber (At Risk)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: TL_RED }}
              />
              <span>Red (Off Track)</span>
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-500 font-semibold">
            {baselineYear} Baseline ({formatNum(baselineVal)}
            {cleanUnit}) → 2030 Target ({formatNum(targetVal)}
            {cleanUnit})
          </span>
        </div>

        {/* Plain-Language Summary */}
        <div className="text-xs sm:text-sm font-sans text-[#111827] mb-4 leading-relaxed">
          {isMortality ? (
            <>
              Mortality rate is{" "}
              <strong className="font-bold text-amber-700">
                {formatNum(reportedVal)}% lower
              </strong>{" "}
              than in 2015,{" "}
              <strong className="font-bold text-[#1e3653]">
                {formatNum(Math.abs(gapToExpected))}% behind
              </strong>{" "}
              the{" "}
              <strong className="font-bold text-[#2563eb]">
                {formatNum(expectedVal2026)}% milestone
              </strong>{" "}
              expected in {reportedYear} to reach the{" "}
              <strong className="font-bold text-emerald-700">
                {formatNum(targetVal)}% goal
              </strong>
              .
            </>
          ) : isIncidence ? (
            <>
              Case incidence is{" "}
              <strong className="font-bold text-rose-700">
                {formatNum(Math.abs(reportedVal))}% higher (worse)
              </strong>{" "}
              than in 2015,{" "}
              <strong className="font-bold text-[#1e3653]">
                {formatNum(Math.abs(gapToExpected))}% behind
              </strong>{" "}
              the{" "}
              <strong className="font-bold text-[#2563eb]">
                {formatNum(expectedVal2026)}% milestone
              </strong>{" "}
              expected in {reportedYear} to reach the{" "}
              <strong className="font-bold text-emerald-700">
                {formatNum(targetVal)}% goal
              </strong>
              .
            </>
          ) : ragStatus === "on_track" ? (
            <>
              {reportedYear} reported value (
              <strong className="font-bold text-emerald-700">
                {formatNum(reportedVal)}
                {cleanUnit}
              </strong>
              ) is <strong className="font-bold text-emerald-700">on track</strong> against the{" "}
              {reportedYear} expected milestone (
              <strong className="font-bold text-[#2563eb]">
                {formatNum(expectedVal2026)}
                {cleanUnit}
              </strong>
              ) toward the 2030 goal of{" "}
              <strong className="font-bold text-emerald-700">
                {formatNum(targetVal)}
                {cleanUnit}
              </strong>
              .
            </>
          ) : ragStatus === "at_risk" ? (
            <>
              {reportedYear} reported value is{" "}
              <strong className="font-bold text-amber-700">
                {formatNum(reportedVal)}
                {cleanUnit}
              </strong>{" "}
              {elapsedYears > 0 ? (
                <>
                  (
                  <strong className="font-bold text-[#1e3653]">
                    {formatNum(Math.abs(gapToExpected))}
                    {cleanUnit} behind
                  </strong>{" "}
                  the {reportedYear} expected milestone of{" "}
                  <strong className="font-bold text-[#2563eb]">
                    {formatNum(expectedVal2026)}
                    {cleanUnit}
                  </strong>
                  )
                </>
              ) : (
                <>
                  ({baselineYear} baseline year; target is {formatNum(targetVal)}
                  {cleanUnit} by 2030)
                </>
              )}{" "}
              toward the 2030 goal of{" "}
              <strong className="font-bold text-emerald-700">
                {formatNum(targetVal)}
                {cleanUnit}
              </strong>
              .
            </>
          ) : (
            <>
              {reportedYear} reported value (
              <strong className="font-bold text-rose-700">
                {formatNum(reportedVal)}
                {cleanUnit}
              </strong>
              ) is{" "}
              <strong className="font-bold text-rose-700">
                worse than the {baselineYear} baseline ({formatNum(baselineVal)}
                {cleanUnit})
              </strong>{" "}
              and{" "}
              <strong className="font-bold text-[#1e3653]">
                {formatNum(Math.abs(gapToExpected))}
                {cleanUnit} behind
              </strong>{" "}
              the {reportedYear} expected milestone (
              <strong className="font-bold text-[#2563eb]">
                {formatNum(expectedVal2026)}
                {cleanUnit}
              </strong>
              ).
            </>
          )}
        </div>

        {/* Active Callout Pin Above Bar */}
        <div className="relative h-8 w-full select-none">
          <div
            className="absolute bottom-0 -translate-x-1/2 text-center z-20"
            style={{ left: `${clampPinPct(actual2026Pct)}%` }}
          >
            <div
              className="px-2.5 py-0.5 rounded text-[10px] font-mono font-extrabold shadow-sm whitespace-nowrap border"
              style={{
                backgroundColor: currentTrafficColor,
                color: "#ffffff",
                borderColor: "#ffffff",
              }}
            >
              {reportedYear} Reported: {formatNum(reportedVal)}
              {cleanUnit}
            </div>
            <div
              className="w-0 h-0 mx-auto border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent"
              style={{ borderTopColor: currentTrafficColor }}
            />
          </div>
        </div>

        {/* Horizontal Traffic-Light Progress Track (Clean Light Surface) */}
        <div className="relative h-8 w-full rounded-lg bg-white border border-slate-300 overflow-hidden shadow-2xs">
          {/* Left Regression Zone (Worse than Baseline) */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-rose-100/80"
            style={{ width: `${basePct}%` }}
            title={`Worse than ${baselineYear} Baseline (${formatNum(baselineVal)}${cleanUnit})`}
          />

          {/* Filled Bar from Baseline to Reported Value */}
          {signedDelta >= 0 ? (
            <div
              className="absolute top-0 bottom-0 transition-all duration-500"
              style={{
                left: `${basePct}%`,
                width: `${Math.max(1, actual2026Pct - basePct)}%`,
                backgroundColor: currentTrafficColor,
              }}
            />
          ) : (
            <div
              className="absolute top-0 bottom-0 transition-all duration-500"
              style={{
                left: `${actual2026Pct}%`,
                width: `${Math.max(1, basePct - actual2026Pct)}%`,
                backgroundColor: TL_RED,
              }}
            />
          )}

          {/* Shaded Gap Bracket between Actual and Expected Milestone */}
          {elapsedYears > 0 && actual2026Pct < expected2026Pct - 1 && (
            <div
              className="absolute top-1.5 bottom-1.5 border-y border-dashed border-amber-500/80 bg-amber-50/90 flex items-center justify-center"
              style={{
                left: `${Math.max(basePct, actual2026Pct)}%`,
                width: `${expected2026Pct - Math.max(basePct, actual2026Pct)}%`,
              }}
            >
              <span className="text-[9.5px] font-mono font-bold text-amber-900 px-1.5 truncate">
                ◄── {formatNum(Math.abs(gapToExpected))}
                {cleanUnit} behind {reportedYear} milestone ──►
              </span>
            </div>
          )}

          {/* Baseline Vertical Divider Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#1e3653] z-10"
            style={{ left: `${basePct}%` }}
          />

          {/* Expected Milestone Vertical Marker Line */}
          {elapsedYears > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-[#2563eb] z-10"
              style={{ left: `${expected2026Pct}%` }}
            />
          )}

          {/* 2030 Goal Right Edge Marker */}
          <div
            className="absolute top-0 bottom-0 right-0 w-1.5 z-10"
            style={{ backgroundColor: TL_GREEN }}
          />
        </div>

        {/* Reference Milestones Below Bar */}
        <div className="relative h-9 w-full mt-1.5 select-none text-[9.5px] font-mono">
          <div className="absolute top-0 left-0 text-rose-600 font-semibold">◀ Worse</div>
          <div
            className="absolute top-0 -translate-x-1/2 text-center"
            style={{ left: `${basePct}%` }}
          >
            <div className="text-[#111827] font-bold">
              {formatNum(baselineVal)}
              {cleanUnit}
            </div>
            <div className="text-[8.5px] text-gray-500">{baselineYear} Base</div>
          </div>
          {elapsedYears > 0 && (
            <div
              className="absolute top-0 -translate-x-1/2 text-center"
              style={{ left: `${Math.max(32, Math.min(84, expected2026Pct))}%` }}
            >
              <div className="text-[#2563eb] font-bold">
                {formatNum(expectedVal2026)}
                {cleanUnit}
              </div>
              <div className="text-[8.5px] text-[#2563eb]/80">{reportedYear} Milestone</div>
            </div>
          )}
          <div className="absolute top-0 right-0 text-right">
            <div className="text-emerald-700 font-extrabold">
              {formatNum(targetVal)}
              {cleanUnit}
            </div>
            <div className="text-[8.5px] text-emerald-700/80">2030 Goal</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 border-t-4 border-t-[#3365e3] hover:border-blue-300 rounded-lg p-4 sm:p-5 transition-all shadow-md flex flex-col justify-between relative hover:z-30 text-[#111827] overflow-visible">
      {/* 1. Header: Title, In-Card Definition, Target, Status Badge, and View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono font-semibold text-slate-500 mb-1">
            {kpi.kpiCode && <span className="text-[#2563eb] font-bold">{kpi.kpiCode}</span>}
            {kpi.kpiCode && hasValidTarget && <span aria-hidden="true">·</span>}
            {hasValidTarget && (
              <span>
                2030 Target:{" "}
                <strong className="text-emerald-700">
                  {formatNum(targetVal)}
                  {cleanUnit}
                </strong>
              </span>
            )}
          </div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-[#111827] leading-snug">
            {cardTitle}
          </h3>
          {cardDefinition && (
            <p className="text-xs text-slate-600 font-sans mt-1 leading-relaxed">{cardDefinition}</p>
          )}
        </div>

        {/* Status Badge + View Mode Switcher (dashboards.endmalaria.org style) */}
        <div className="shrink-0 pt-0.5 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {statusBadge}
          </div>
          <div className="inline-flex items-center rounded-md bg-[#F2F8FF] border border-blue-200 p-0.5 text-[10px] font-sans">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("milestone");
              }}
              className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                viewMode === "milestone"
                  ? "bg-[#3365e3] text-white font-semibold shadow-2xs"
                  : "text-gray-600 hover:text-[#111827]"
              }`}
            >
              Milestone Bar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("sparkline");
              }}
              className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                viewMode === "sparkline"
                  ? "bg-[#3365e3] text-white font-semibold shadow-2xs"
                  : "text-gray-600 hover:text-[#111827]"
              }`}
            >
              Line View
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Traffic-Light Status & Milestone Rationale Box */}
      {showRationale && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2.5 rounded-lg bg-[#F2F8FF] border border-blue-200 p-3.5 text-xs space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-blue-200/70 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: tlEval.color }}
              />
              <span className="font-mono text-[10.5px] font-extrabold uppercase tracking-wider text-[#1e3653]">
                Traffic-Light Calculation Rationale ({kpi.kpiCode || kpi.id})
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#2563eb] bg-white px-2 py-0.5 rounded border border-blue-200 font-semibold">
              {tlEval.indicatorTypeLabel}
            </span>
          </div>

          <div className="space-y-1">
            <div className="font-mono font-bold text-[#111827] text-[11px]">
              {tlEval.ruleApplied}
            </div>
            <p className="text-gray-700 font-sans text-xs leading-relaxed">
              {tlEval.varianceSummary}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1 font-mono text-[10px] text-center">
            <div className="bg-white p-1.5 rounded border border-blue-100">
              <div className="text-[8.5px] text-gray-500 uppercase">Base Year</div>
              <div className="font-bold text-[#111827] mt-0.5">{tlEval.baselineYear}</div>
            </div>
            <div className="bg-white p-1.5 rounded border border-blue-100">
              <div className="text-[8.5px] text-gray-500 uppercase">Baseline</div>
              <div className="font-bold text-[#111827] mt-0.5">
                {formatWithUnit(tlEval.baselineValue, tlEval.unit)}
              </div>
            </div>
            <div className="bg-white p-1.5 rounded border border-blue-100">
              <div className="text-[8.5px] text-gray-500 uppercase">{reportedYear} Reported</div>
              <div className="font-bold text-[#2563eb] mt-0.5">
                {formatWithUnit(tlEval.reported2026, tlEval.unit)}
              </div>
            </div>
            <div className="bg-white p-1.5 rounded border border-blue-100">
              <div className="text-[8.5px] text-gray-500 uppercase">{reportedYear} Milestone</div>
              <div className="font-bold text-[#2563eb] mt-0.5">
                {tlEval.expected2026 !== null
                  ? formatWithUnit(tlEval.expected2026, tlEval.unit)
                  : "—"}
              </div>
            </div>
            <div className="bg-white p-1.5 rounded border border-blue-100 col-span-2 sm:col-span-1">
              <div className="text-[8.5px] text-gray-500 uppercase">2030 Target</div>
              <div className="font-bold text-emerald-700 mt-0.5">
                {tlEval.target2030 !== null
                  ? formatWithUnit(tlEval.target2030, tlEval.unit)
                  : "Not set"}
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-gray-700 bg-white px-2.5 py-1.5 rounded border border-blue-100">
            <span className="text-[#2563eb] font-bold">Milestone Path: </span>
            {tlEval.milestoneFormulaText}
          </div>
        </div>
      )}

      {/* 2. Main Stat Readout & Space-Efficient Inline Legend */}
      <div className="mt-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              ragStatus === "on_track"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : ragStatus === "at_risk"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : ragStatus === "off_track"
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            {ragStatus === "on_track" ? (
              <ArrowUp className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
            ) : ragStatus === "at_risk" ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
            ) : ragStatus === "off_track" ? (
              <ArrowDown className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-500 stroke-[2.5]" />
            )}
          </div>
          <div className=" id-status-readout min-w-0">
            <div className="text-[9.5px] font-mono uppercase text-gray-500 tracking-wider font-semibold flex items-center gap-1.5">
              <span>Reported Status ({reportedYear})</span>
            </div>
            <div className="text-sm font-mono font-bold text-[#111827] tracking-tight leading-snug flex items-center gap-1.5 flex-wrap">
              <span>{directionText}</span>
              <InfoIconButton
                tooltipTitle={`${kpi.kpiCode || kpi.id} Status Rationale`}
                tooltipBadge={tlEval.badgeLabel}
                accent={tooltipAccent}
                tooltipContent={rationaleTooltipContent}
                onClick={() => setShowRationale((prev) => !prev)}
                active={showRationale}
                ariaLabel={`View traffic-light status rationale for ${kpi.name}`}
                widthClass="w-80"
              />
            </div>
          </div>
        </div>

        {/* Space-Efficient Compact Legend (shown in Line View) */}
        {viewMode === "sparkline" && (
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[9px] font-mono text-gray-600 bg-[#F2F8FF] px-2.5 py-1 rounded border border-blue-100 shrink-0 max-w-full">
            <div className="inline-flex items-center gap-1 shrink-0">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400 inline-block" />
              <span>On-track</span>
            </div>
            <div className="inline-flex items-center gap-1 shrink-0">
              <span className="w-3 h-0.5 bg-[#2563eb] inline-block" />
              <span className="text-[#111827] font-medium">
                {isApex ? "Reduction" : higherIsBetter ? "Progress" : "Trend"}
              </span>
            </div>
            <div className="inline-flex items-center gap-1 shrink-0">
              <span
                className="w-2 h-2 rounded-full inline-block shrink-0"
                style={{ backgroundColor: ragDotColor }}
              />
              <span className="font-semibold text-[#111827]">Reported</span>
            </div>
            <div className="inline-flex items-center gap-1 shrink-0">
              <span className="w-3 h-0.5 border-t-2 border-dotted border-[#2563eb] inline-block" />
              <span>Current pace</span>
            </div>
          </div>
        )}
      </div>

      {/* 3A. Milestone Bar View */}
      {viewMode === "milestone" && renderMilestoneBar()}

      {/* 3B. Line / Sparkline View (White RBM Chart Surface) */}
      {viewMode === "sparkline" && (
        <div className="mt-2.5 pt-1 relative bg-white rounded-lg border border-gray-100 p-2">
          {!hasReportedValue ? (
            <div className="rounded-lg bg-[#F2F8FF] border border-blue-100 p-5 text-center space-y-1.5">
              <div className="text-xs font-mono font-bold text-[#1e3653] uppercase tracking-wider">
                Pending {reportedYear} Data
              </div>
              <p className="text-xs text-gray-600 max-w-md mx-auto">
                No baseline or {reportedYear} value has been reported for{" "}
                <strong className="text-[#111827]">{kpi.kpiCode || kpi.name}</strong> yet.
              </p>
            </div>
          ) : (
            <div className="w-full">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto select-none overflow-hidden"
              >
                <defs>
                  <pattern
                    id={uniquePatternId}
                    width="8"
                    height="8"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="8"
                      stroke="rgba(225, 29, 72, 0.18)"
                      strokeWidth="2"
                    />
                  </pattern>
                </defs>

                {/* Shaded zone: Worse than baseline */}
                {shadedHeight > 0 && (
                  <>
                    <rect
                      x={padLeft}
                      y={shadedY}
                      width={plotWidth}
                      height={shadedHeight}
                      fill={`url(#${uniquePatternId})`}
                    />
                    <rect
                      x={padLeft}
                      y={shadedY}
                      width={plotWidth}
                      height={shadedHeight}
                      fill="rgba(225, 29, 72, 0.05)"
                    />
                    <text
                      x={padLeft + 8}
                      y={Math.min(padTop + plotHeight - 8, shadedY + shadedHeight - 8)}
                      fill="#be123c"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      ⚠ Shaded zone: Worse than {baselineYear} baseline
                    </text>
                  </>
                )}

                {/* Y-Axis Horizontal Reference: Target Line */}
                {hasValidTarget && (
                  <>
                    <line
                      x1={padLeft}
                      y1={yTarget}
                      x2={padLeft + plotWidth}
                      y2={yTarget}
                      stroke="rgba(22, 163, 74, 0.4)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padLeft - 6}
                      y={yTarget + 3.5}
                      textAnchor="end"
                      fill="#15803d"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {formatNum(targetVal)}
                      {cleanUnit} Target
                    </text>
                  </>
                )}

                {/* Y-Axis Horizontal Reference: Expected Milestone in 2026 */}
                {hasValidTarget && elapsedYears > 0 && (
                  <>
                    <line
                      x1={padLeft}
                      y1={yExpected}
                      x2={padLeft + plotWidth}
                      y2={yExpected}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                      strokeDasharray="2 4"
                    />
                    <text
                      x={padLeft - 6}
                      y={yExpected + 3.5}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="8.5"
                      fontFamily="monospace"
                    >
                      {formatNum(expectedVal2026)}
                      {cleanUnit} Exp.
                    </text>
                  </>
                )}

                {/* Baseline Line */}
                <line
                  x1={padLeft}
                  y1={yBaseCoord}
                  x2={padLeft + plotWidth}
                  y2={yBaseCoord}
                  stroke="#64748b"
                  strokeWidth="1.75"
                />
                <text
                  x={padLeft - 6}
                  y={yBaseCoord + 3.5}
                  textAnchor="end"
                  fill="#1e293b"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {formatNum(baselineVal)}
                  {cleanUnit} Base
                </text>

                {/* Vertical Year Gridlines & X-Axis Year Numbers */}
                {xTicks.map((tick) => {
                  const xPos = getX(tick.yr);
                  return (
                    <g key={`xtick-${tick.yr}`}>
                      <line
                        x1={xPos}
                        y1={padTop}
                        x2={xPos}
                        y2={padTop + plotHeight}
                        stroke={tick.highlight ? "#cbd5e1" : "#f1f5f9"}
                        strokeWidth={tick.highlight ? "1.5" : "1"}
                        strokeDasharray={tick.sub === "" ? "2 3" : undefined}
                      />
                      <line
                        x1={xPos}
                        y1={padTop + plotHeight}
                        x2={xPos}
                        y2={padTop + plotHeight + 4}
                        stroke={
                          tick.yr === reportedYear
                            ? "#2563eb"
                            : tick.yr === 2030
                            ? "#15803d"
                            : "#64748b"
                        }
                        strokeWidth="1.5"
                      />
                      <text
                        x={xPos}
                        y={padTop + plotHeight + 16}
                        textAnchor="middle"
                        fill={
                          tick.yr === reportedYear
                            ? "#2563eb"
                            : tick.yr === 2030
                            ? "#15803d"
                            : "#334155"
                        }
                        fontSize="11"
                        fontFamily="monospace"
                        fontWeight={tick.highlight || tick.yr === baselineYear ? "bold" : "normal"}
                      >
                        {tick.label}
                      </text>
                      {tick.sub && (
                        <text
                          x={xPos}
                          y={padTop + plotHeight + 28}
                          textAnchor="middle"
                          fill={
                            tick.yr === reportedYear
                              ? "#2563eb"
                              : tick.yr === 2030
                              ? "#15803d"
                              : "#64748b"
                          }
                          fontSize="8.5"
                          fontFamily="monospace"
                        >
                          ({tick.sub})
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* PATH 1: On-Track Path (dashed slate baseline to target) */}
                {hasValidTarget && (
                  <>
                    <line
                      x1={xBase}
                      y1={yBaseCoord}
                      x2={x2030}
                      y2={yTarget}
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="5 5"
                    />
                    <circle
                      cx={x2030}
                      cy={yTarget}
                      r="4.5"
                      fill="#16a34a"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={x2030 - 6}
                      y={yTarget - 8}
                      textAnchor="end"
                      fill="#15803d"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {formatNum(targetVal)}
                      {cleanUnit} Target
                    </text>
                  </>
                )}

                {/* Gap indicator line between 2026 expected and 2026 reported */}
                {hasValidTarget && elapsedYears > 0 && (
                  <>
                    <line
                      x1={x2026}
                      y1={yExpected}
                      x2={x2026}
                      y2={yReported}
                      stroke="rgba(217, 119, 6, 0.7)"
                      strokeWidth="2"
                      strokeDasharray="2 3"
                    />
                    <circle
                      cx={x2026}
                      cy={yExpected}
                      r="3"
                      fill="#64748b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </>
                )}

                {/* PATH 2: Dotted RBM Blue Line where Current Pace Leads (2026 to 2030) */}
                {elapsedYears > 0 && (
                  <>
                    <line
                      x1={x2026}
                      y1={yReported}
                      x2={x2030}
                      y2={yProjected}
                      stroke="#3365e3"
                      strokeWidth="2.5"
                      strokeDasharray="3 4"
                    />
                    <circle
                      cx={x2030}
                      cy={yProjected}
                      r="4"
                      fill="#ffffff"
                      stroke="#3365e3"
                      strokeWidth="2.5"
                    />
                    <text
                      x={x2030 - 6}
                      y={yProjected < yReported ? yProjected - 8 : yProjected + 14}
                      textAnchor="end"
                      fill="#2563eb"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {formatNum(projectedVal2030)}
                      {cleanUnit} Pace
                    </text>
                  </>
                )}

                {/* PATH 3: Solid RBM Blue Polyline for Reported Data (Baseline through all reported years up to reportedYear) */}
                <polyline
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  points={historicalPoints
                    .map((pt) => `${getX(pt.yr).toFixed(1)},${getY(pt.val).toFixed(1)}`)
                    .join(" ")}
                />

                {/* Intermediate Reported Dots (e.g., 2026 when 2027+ is also reported) */}
                {historicalPoints
                  .filter((pt) => pt.yr > baselineYear && pt.yr < reportedYear)
                  .map((pt) => (
                    <circle
                      key={`hist-dot-${pt.yr}`}
                      cx={getX(pt.yr)}
                      cy={getY(pt.val)}
                      r="4"
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth="1.75"
                    />
                  ))}

                {/* Baseline Dot */}
                <g
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint("base")}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ pointerEvents: "all" }}
                >
                  <circle
                    cx={xBase}
                    cy={yBaseCoord}
                    r="20"
                    fill="#ffffff"
                    fillOpacity="0.001"
                    style={{ pointerEvents: "all", cursor: "pointer" }}
                  />
                  <circle
                    cx={xBase}
                    cy={yBaseCoord}
                    r="4.5"
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="2"
                    style={{ pointerEvents: "none" }}
                  />
                </g>

                {/* Reported 2026 Dot with Traffic-Light RAG status color */}
                <g
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint("2026")}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ pointerEvents: "all" }}
                >
                  <circle
                    cx={x2026}
                    cy={yReported}
                    r="22"
                    fill="#ffffff"
                    fillOpacity="0.001"
                    style={{ pointerEvents: "all", cursor: "pointer" }}
                  />
                  <circle
                    cx={x2026}
                    cy={yReported}
                    r="8"
                    fill={ragDotGlow}
                    style={{ pointerEvents: "none" }}
                  />
                  <circle
                    cx={x2026}
                    cy={yReported}
                    r="5.5"
                    fill={ragDotColor}
                    stroke="#ffffff"
                    strokeWidth="2"
                    style={{ pointerEvents: "none" }}
                  />
                </g>

                {/* Label at 2026 Reported Dot */}
                <text
                  x={x2026 - 10}
                  y={yReported <= yBaseCoord ? yReported - 10 : yReported + 18}
                  textAnchor="end"
                  fill="#111827"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                >
                  {formatNum(reportedVal)}
                  {cleanUnit}
                </text>
              </svg>
            </div>
          )}

          {/* Dark RBM Blue Hover Tooltip Overlay (clamped inside chart bounds) */}
          {hoveredPoint === "2026" && hasReportedValue && (
            <div
              className="absolute pointer-events-none z-40 w-60 max-w-[85%] rounded-lg bg-[#152243] text-white border border-[#2a437e] shadow-[0_14px_34px_-6px_rgba(9,16,36,0.55)] overflow-hidden text-left"
              style={{
                borderTopWidth: "3px",
                borderTopColor: ragDotColor,
                left: `${Math.max(26, Math.min(74, (x2026 / svgWidth) * 100))}%`,
                top: `${(yReported / svgHeight) * 100}%`,
                transform:
                  yReported < 95 ? "translate(-50%, 16px)" : "translate(-50%, -112%)",
                pointerEvents: "none",
              }}
            >
              <div className="px-3 py-1.5 bg-[#1c2d57] border-b border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: ragDotColor }}
                  />
                  <span className="text-[10px] font-sans font-bold text-white">
                    {reportedYear} Reported
                  </span>
                </div>
                <span
                  className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-white/15"
                  style={{
                    backgroundColor: `${ragDotColor}30`,
                    color: "#ffffff",
                  }}
                >
                  {ragLabel}
                </span>
              </div>
              <div className="p-2.5 space-y-1 text-[10.5px] font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-blue-200/80">Recorded Value:</span>
                  <span className="font-mono font-bold text-white">
                    {formatNum(reportedVal)}
                    {cleanUnit}
                  </span>
                </div>
                {hasValidTarget && elapsedYears > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-blue-200/80">{reportedYear} Milestone:</span>
                    <span className="font-mono font-semibold text-[#4bc2e7]">
                      {formatNum(expectedVal2026)}
                      {cleanUnit}
                    </span>
                  </div>
                )}
                <div className="pt-1 border-t border-white/10 text-[10px] text-blue-100/90 leading-snug">
                  {directionText}
                </div>
              </div>
            </div>
          )}
          {hoveredPoint === "base" && hasReportedValue && (
            <div
              className="absolute pointer-events-none z-40 w-52 max-w-[80%] rounded-lg bg-[#152243] text-white border border-[#2a437e] shadow-[0_14px_34px_-6px_rgba(9,16,36,0.55)] overflow-hidden text-left"
              style={{
                borderTopWidth: "3px",
                borderTopColor: "#4bc2e7",
                left: `${Math.max(24, Math.min(76, (xBase / svgWidth) * 100))}%`,
                top: `${(yBaseCoord / svgHeight) * 100}%`,
                transform:
                  yBaseCoord < 95 ? "translate(-50%, 16px)" : "translate(-50%, -112%)",
                pointerEvents: "none",
              }}
            >
              <div className="px-3 py-1.5 bg-[#1c2d57] border-b border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-sans font-bold text-white">
                  {baselineYear} Baseline
                </span>
                <span className="text-[9px] font-mono font-semibold text-[#4bc2e7]">
                  Reference
                </span>
              </div>
              <div className="p-2.5 flex items-center justify-between text-[11px]">
                <span className="text-blue-200/80 font-sans">Baseline Value:</span>
                <span className="font-mono font-bold text-white">
                  {formatNum(baselineVal)}
                  {cleanUnit}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Simplified 3-Column Inset Metric Footer (Centered with Responsive Adaptive Spacing) */}
      <div
        className="mt-4 pt-3.5 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-5 lg:gap-6 max-w-3xl mx-auto w-full items-stretch"
        data-name="summary-panels"
      >
        {/* 1st Panel: We should be: */}
        <div className="rounded-lg bg-[#f8fafc] border border-slate-200/90 px-4 py-3 flex flex-col items-center justify-center text-center">
          <div className="text-[11px] font-sans font-semibold text-slate-500 leading-tight">
            We should be:
          </div>
          <div className="text-base sm:text-lg font-mono font-bold text-[#1e3653] leading-tight mt-1">
            {hasReportedValue && hasValidTarget ? `${formatNum(expectedVal2026)}${cleanUnit}` : "—"}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-1 leading-tight">
            {hasValidTarget
              ? `On-track pace: ${onTrackRatePerYear >= 0 ? "+" : ""}${formatNum(
                  onTrackRatePerYear
                )}${cleanUnit}/yr`
              : "Target not specified"}
          </div>
        </div>

        {/* 2nd Panel: Gap to expected: */}
        <div
          className={`rounded-lg border px-4 py-3 flex flex-col items-center justify-center text-center ${
            hasReportedValue && hasValidTarget
              ? gapToExpected <= 0
                ? "bg-emerald-50/50 border-[#16a34a]/30"
                : ragStatus === "off_track"
                ? "bg-rose-50/50 border-[#dc2626]/30"
                : "bg-amber-50/50 border-[#f59e0b]/40"
              : "bg-[#f8fafc] border-slate-200/90"
          }`}
        >
          <div className="text-[11px] font-sans font-semibold text-slate-600 leading-tight">
            Gap to expected:
          </div>
          {hasReportedValue && hasValidTarget ? (
            <>
              <div
                className={`text-base sm:text-lg font-mono font-bold leading-tight mt-1 ${
                  gapToExpected <= 0
                    ? "text-[#16a34a]"
                    : ragStatus === "off_track"
                    ? "text-[#dc2626]"
                    : "text-[#d97706]"
                }`}
              >
                {gapToExpected <= 0 ? "+" : "-"}
                {formatNum(Math.abs(gapToExpected))}
                {unit === "%" ? "% pts" : cleanUnit}
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1 leading-tight">
                {gapToExpected <= 0 ? "On or ahead of milestone" : `Behind ${reportedYear} milestone`}
              </div>
            </>
          ) : (
            <>
              <div className="text-base sm:text-lg font-mono font-bold leading-tight text-slate-400 mt-1">
                —
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1 leading-tight">
                Awaiting data
              </div>
            </>
          )}
        </div>

        {/* 3rd Panel: Years to reach target at current pace */}
        <div className="rounded-lg bg-[#f8fafc] border border-slate-200/90 px-4 py-3 flex flex-col items-center justify-center text-center">
          <div className="text-[11px] font-sans font-semibold text-slate-500 leading-tight">
            Years to reach target:
          </div>
          {hasReportedValue && hasValidTarget ? (
            targetAlreadyReached ? (
              <>
                <div className="text-base sm:text-lg font-mono font-bold leading-tight text-[#16a34a] mt-1">
                  0 yrs
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 leading-tight">
                  Target reached in {reportedYear}
                </div>
              </>
            ) : yearsToReachTarget !== null ? (
              <>
                <div
                  className={`text-base sm:text-lg font-mono font-bold leading-tight mt-1 ${
                    yearsToReachTarget <= remainingYears + 0.05
                      ? "text-[#16a34a]"
                      : "text-[#2563eb]"
                  }`}
                >
                  {yearsToReachTarget < 1
                    ? "< 1 yr"
                    : `${formatNum(yearsToReachTarget)} ${
                        Math.abs(yearsToReachTarget - 1) < 0.05 ? "yr" : "yrs"
                      }`}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 leading-tight">
                  Current pace: {paceSoFar >= 0 ? `+${formatNum(paceSoFar)}` : formatNum(paceSoFar)}
                  {cleanUnit}/yr{projectedTargetYear ? ` (est. ${projectedTargetYear})` : ""}
                </div>
              </>
            ) : isMovingAwayFromTarget ? (
              <>
                <div className="text-base sm:text-lg font-mono font-bold leading-tight text-[#dc2626] mt-1">
                  Moving away
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 leading-tight">
                  Current pace: {paceSoFar >= 0 ? `+${formatNum(paceSoFar)}` : formatNum(paceSoFar)}
                  {cleanUnit}/yr
                </div>
              </>
            ) : elapsedYears > 0 ? (
              <>
                <div className="text-base sm:text-lg font-mono font-bold leading-tight text-[#d97706] mt-1">
                  No progress
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 leading-tight">
                  Current pace: 0{cleanUnit}/yr since {baselineYear}
                </div>
              </>
            ) : (
              <>
                <div className="text-base sm:text-lg font-mono font-bold leading-tight text-slate-600 mt-1">
                  Baseline yr
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 leading-tight">
                  Need {paceNeeded >= 0 ? `+${formatNum(paceNeeded)}` : formatNum(paceNeeded)}
                  {cleanUnit}/yr for 2030
                </div>
              </>
            )
          ) : (
            <>
              <div className="text-base sm:text-lg font-mono font-bold leading-tight text-slate-400 mt-1">
                —
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1 leading-tight">
                Awaiting target/value
              </div>
            </>
          )}
        </div>
      </div>

      {/* 5. Provenance Footer (Clean Unboxed Metadata) */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between text-[10.5px] text-slate-500 gap-2">
        <div className="flex flex-wrap items-center gap-1.5 font-sans">
          <span className="font-semibold text-slate-600">Source:</span>
          <span className="text-[#1e3653] font-medium">
            {kpi.source || (isApex ? "WHO Malaria Report" : "RBM Working Group Tracking")}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[10px]">Baseline {baselineYear}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[10px]">Reported {reportedYear}</span>
          {kpi.cadence && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[10px]">{kpi.cadence}</span>
            </>
          )}
        </div>
        {viewMode === "sparkline" && (
          <div className="text-slate-400 font-mono text-[10px]">
            Dotted line projects 2030 outcome at current pace
          </div>
        )}
      </div>
    </div>
  );
};
