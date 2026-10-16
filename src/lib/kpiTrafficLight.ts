import { KPI, RAGStatus } from "@/src/types";

export interface KPITrafficLightEvaluation {
  status: RAGStatus; // "green" | "amber" | "red" | "pending"
  ragStatus: "on_track" | "at_risk" | "off_track" | "pending";
  color: string; // "#16a34a" | "#f59e0b" | "#dc2626" | "#94a3b8"
  badgeLabel: string; // "On Track" | "At Risk" | "Off Track" | "Pending"
  evaluationYear: number; // Dynamic reporting year (2026, 2027, 2028, 2029, 2030)
  baselineYear: number; // Column J (2015, 2025, 2026)
  baselineValue: number | null; // Column K
  reported2026: number | null; // Reported value at evaluationYear (kept as reported2026 alias for compatibility)
  expected2026: number | null; // Linear milestone at evaluationYear between baselineYear and 2030
  target2030: number | null; // Column L
  unit: string; // Column M ("%", "#", "$Million")
  higherIsBetter: boolean;
  isReductionMetric: boolean;
  indicatorTypeLabel: string;
  totalYears: number; // 2030 - baselineYear
  elapsedYears: number; // evaluationYear - baselineYear
  requiredAnnualPace: number | null;
  deltaVsBaseline: number | null; // signed in direction of raw numbers
  deltaVsExpected2026: number | null; // signed in direction of raw numbers
  deltaVsTarget2030: number | null;
  pctBelowOrAboveMilestone: number | null; // relative % difference vs expected milestone
  completionPct: number | null; // 0..100+ progress from baseline toward 2030 target
  ruleApplied: string;
  varianceSummary: string;
  milestoneFormulaText: string;
  fullRationaleText: string;
}

export function resolveLatestEvaluationYear(kpi?: KPI | null, explicitYear?: number): number {
  if (typeof explicitYear === "number" && !isNaN(explicitYear)) {
    return explicitYear;
  }
  if (!kpi) return 2026;
  if (typeof kpi.latestReportedYear === "number" && !isNaN(kpi.latestReportedYear)) {
    return kpi.latestReportedYear;
  }
  if (kpi.yearValues && typeof kpi.yearValues === "object") {
    for (const yr of [2030, 2029, 2028, 2027, 2026]) {
      const v = kpi.yearValues[yr];
      if (typeof v === "number" && !isNaN(v)) {
        return yr;
      }
    }
  }
  return 2026;
}

export function formatMetricNum(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  if (Math.abs(v) >= 100 && Number.isInteger(v)) return v.toFixed(0);
  if (Math.abs(v) >= 10) return Number(v.toFixed(1)).toString();
  return Number(v.toFixed(2)).toString();
}

export function formatWithUnit(v: number | null | undefined, rawUnit: string): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const numStr = formatMetricNum(v);
  const u = (rawUnit || "").replace(/reduction/gi, "").trim();
  if (!u) return numStr;
  if (u === "%") return `${numStr}%`;
  if (u === "#") return numStr;
  if (u.toLowerCase().includes("$million") || u.toLowerCase() === "$m") {
    return `$${numStr}M`;
  }
  return `${numStr} ${u}`;
}

/**
 * Evaluates a KPI's Traffic-Light status (Green / Amber / Red / Gray)
 * Automatically uses the latest reported year (2026, 2027, 2028, 2029, 2030) unless an explicit year is passed.
 */
export function evaluateKPITrafficLight(
  kpi: KPI,
  explicitEvaluationYear?: number
): KPITrafficLightEvaluation {
  const evaluationYear = resolveLatestEvaluationYear(kpi, explicitEvaluationYear);

  const TL_GREEN = "#16a34a";
  const TL_YELLOW = "#f59e0b";
  const TL_RED = "#dc2626";
  const TL_GRAY = "#94a3b8";

  const nameAndDef = `${kpi.name || ""} ${kpi.definition || ""}`.toLowerCase();
  const isApex =
    kpi.id === "save-lives-mortality" ||
    kpi.id === "save-lives-morbidity" ||
    kpi.kpiCode === "KPI.19" ||
    kpi.kpiCode === "KPI.20";

  // 1. Resolve Baseline Year from Column J
  const baselineYear =
    typeof kpi.baselineYear === "number" && kpi.baselineYear >= 2015 && kpi.baselineYear <= 2030
      ? Math.round(kpi.baselineYear)
      : isApex
      ? 2015
      : 2025;

  const rawUnit = (kpi.unit || "%").replace(/reduction/gi, "").trim() || "%";
  const isPercentage = rawUnit === "%";
  const isFinancial = rawUnit.includes("$");
  const isReductionMetric =
    nameAndDef.includes("reduced") ||
    nameAndDef.includes("reduction") ||
    nameAndDef.includes("price change");

  const indicatorTypeLabel = isReductionMetric
    ? `Reduction Target (${rawUnit} vs. ${baselineYear} baseline)`
    : isFinancial
    ? `Financial Mobilization (${rawUnit})`
    : isPercentage
    ? `Percentage Indicator (${rawUnit})`
    : `Count / Output Indicator (${rawUnit})`;

  // 2. Resolve Reported Value for evaluationYear (e.g. 2026, 2027, 2028, 2029, 2030)
  const yearVal =
    kpi.yearValues &&
    typeof kpi.yearValues[evaluationYear] === "number" &&
    !isNaN(kpi.yearValues[evaluationYear])
      ? kpi.yearValues[evaluationYear]
      : undefined;

  const reportedVal =
    yearVal !== undefined
      ? yearVal
      : evaluationYear === (kpi.latestReportedYear || 2026) &&
        typeof kpi.value === "number" &&
        !isNaN(kpi.value)
      ? kpi.value
      : null;

  // 3. Resolve Baseline & Target directly from Columns K & L of the Google Sheet
  const hasBaseline = typeof kpi.baseline === "number" && !isNaN(kpi.baseline);
  const baselineValue = hasBaseline ? kpi.baseline : null;

  const hasDefinedTarget = typeof kpi.target === "number" && !isNaN(kpi.target);
  const target2030 = hasDefinedTarget ? kpi.target : null;

  const totalYears = Math.max(1, 2030 - baselineYear);
  const elapsedYears = Math.max(0, evaluationYear - baselineYear);

  // 4. Handle GRAY (Pending): No reported value OR no 2030 target defined
  if (reportedVal === null || target2030 === null || baselineValue === null) {
    const missingParts: string[] = [];
    if (reportedVal === null) missingParts.push(`${evaluationYear} reported value`);
    if (target2030 === null) missingParts.push("2030 target");
    if (baselineValue === null) missingParts.push(`${baselineYear} baseline`);

    const ruleApplied = `Gray (Pending): Missing ${missingParts.join(" and ")}`;
    const varianceSummary =
      reportedVal !== null && baselineValue !== null && target2030 === null
        ? `${evaluationYear} reported value is ${formatWithUnit(reportedVal, rawUnit)} (${baselineYear} baseline: ${formatWithUnit(baselineValue, rawUnit)}), while the 2030 target is pending.`
        : `No ${evaluationYear} reported value or 2030 target is recorded yet (${missingParts.join(", ")}).`;
    const milestoneFormulaText = `Baseline Year: ${baselineYear} | Baseline: ${
      baselineValue !== null ? formatWithUnit(baselineValue, rawUnit) : "Not set"
    } | 2030 Target: ${target2030 !== null ? formatWithUnit(target2030, rawUnit) : "Not defined"}`;

    return {
      status: "pending",
      ragStatus: "pending",
      color: TL_GRAY,
      badgeLabel: "Pending",
      evaluationYear,
      baselineYear,
      baselineValue,
      reported2026: reportedVal,
      expected2026: null,
      target2030,
      unit: rawUnit,
      higherIsBetter: true,
      isReductionMetric,
      indicatorTypeLabel,
      totalYears,
      elapsedYears,
      requiredAnnualPace: null,
      deltaVsBaseline: reportedVal !== null && baselineValue !== null ? reportedVal - baselineValue : null,
      deltaVsExpected2026: null,
      deltaVsTarget2030: null,
      pctBelowOrAboveMilestone: null,
      completionPct: null,
      ruleApplied,
      varianceSummary,
      milestoneFormulaText,
      fullRationaleText: `${ruleApplied}. ${varianceSummary}`,
    };
  }

  // 5. Compute Expected Milestone at evaluationYear based on Column J (baselineYear)
  const higherIsBetter = target2030 >= baselineValue;
  const requiredAnnualPace = (target2030 - baselineValue) / totalYears;
  const expectedMilestone = baselineValue + requiredAnnualPace * elapsedYears;

  const deltaVsBaseline = reportedVal - baselineValue;
  const deltaVsExpected2026 = reportedVal - expectedMilestone;
  const deltaVsTarget2030 = reportedVal - target2030;

  const pctBelowOrAboveMilestone =
    Math.abs(expectedMilestone) > 0.0001
      ? ((reportedVal - expectedMilestone) / Math.abs(expectedMilestone)) * 100
      : null;

  const totalSpan = Math.abs(target2030 - baselineValue) || 1;
  const signedProgress = higherIsBetter
    ? reportedVal - baselineValue
    : baselineValue - reportedVal;
  const completionPct = (signedProgress / totalSpan) * 100;

  const diffUnitLabel = isPercentage ? "% pts" : rawUnit === "#" ? "units" : rawUnit;
  const fmtSigned = (val: number) => `${val >= 0 ? "+" : ""}${formatMetricNum(val)} ${diffUnitLabel}`;

  const milestoneFormulaText =
    elapsedYears > 0
      ? `${evaluationYear} Expected Milestone = ${formatWithUnit(baselineValue, rawUnit)} (${baselineYear} Base) + (${formatWithUnit(target2030, rawUnit)} − ${formatWithUnit(baselineValue, rawUnit)}) × (${elapsedYears}/${totalYears} yrs) = ${formatWithUnit(expectedMilestone, rawUnit)} (Pace: ${fmtSigned(requiredAnnualPace)}/yr)`
      : `Baseline Year is ${baselineYear} (0 yrs elapsed in ${evaluationYear}): ${baselineYear} Baseline = ${formatWithUnit(baselineValue, rawUnit)} → 2030 Target = ${formatWithUnit(target2030, rawUnit)} (Required pace: ${fmtSigned(requiredAnnualPace)}/yr over ${totalYears} yrs)`;

  // 6. Determine Traffic-Light Status & Specific Rationale
  let status: RAGStatus;
  let ragStatus: "on_track" | "at_risk" | "off_track";
  let color: string;
  let badgeLabel: string;
  let ruleApplied: string;
  let varianceSummary: string;

  // Case A: Baseline Year === evaluationYear (elapsedYears === 0)
  if (elapsedYears === 0) {
    const improvedInBaselineYear = higherIsBetter
      ? reportedVal > baselineValue + 0.001
      : reportedVal < baselineValue - 0.001;
    const regressedInBaselineYear = higherIsBetter
      ? reportedVal < baselineValue - 0.001
      : reportedVal > baselineValue + 0.001;

    if (improvedInBaselineYear) {
      status = "green";
      ragStatus = "on_track";
      color = TL_GREEN;
      badgeLabel = "On Track";
      ruleApplied = `Green (On Track): ${evaluationYear} Reported (${formatWithUnit(reportedVal, rawUnit)}) already exceeds ${baselineYear} Baseline (${formatWithUnit(baselineValue, rawUnit)})`;
      varianceSummary = `Reported ${formatWithUnit(reportedVal, rawUnit)} is ${fmtSigned(deltaVsBaseline)} ahead of the ${baselineYear} baseline (${formatWithUnit(baselineValue, rawUnit)}) in its baseline year, reaching ${formatMetricNum(completionPct)}% of the 2030 target (${formatWithUnit(target2030, rawUnit)}).`;
    } else if (regressedInBaselineYear) {
      status = "red";
      ragStatus = "off_track";
      color = TL_RED;
      badgeLabel = "Off Track";
      ruleApplied = `Red (Off Track): ${evaluationYear} Reported (${formatWithUnit(reportedVal, rawUnit)}) is worse than ${baselineYear} Baseline (${formatWithUnit(baselineValue, rawUnit)})`;
      varianceSummary = `Reported ${formatWithUnit(reportedVal, rawUnit)} moved ${fmtSigned(deltaVsBaseline)} in the wrong direction from the ${baselineYear} baseline (${formatWithUnit(baselineValue, rawUnit)}).`;
    } else {
      status = "amber";
      ragStatus = "at_risk";
      color = TL_YELLOW;
      badgeLabel = "At Risk";
      ruleApplied = `Amber (At Risk): At ${baselineYear} Baseline (${formatWithUnit(reportedVal, rawUnit)} = ${formatWithUnit(baselineValue, rawUnit)}; Baseline Year = ${baselineYear})`;
      varianceSummary = `Baseline established in ${baselineYear} at ${formatWithUnit(reportedVal, rawUnit)}. Requires ${fmtSigned(target2030 - reportedVal)} (${fmtSigned(requiredAnnualPace)}/yr over ${2030 - evaluationYear} years) to reach the 2030 target of ${formatWithUnit(target2030, rawUnit)}.`;
    }
  } else {
    // Case B: Baseline Year < evaluationYear (e.g., 2015, 2025, or 2026 baseline evaluated in 2027+)
    const meetsMilestone = higherIsBetter
      ? reportedVal >= expectedMilestone - 0.001
      : reportedVal <= expectedMilestone + 0.001;
    const betterOrEqualBaseline = higherIsBetter
      ? reportedVal >= baselineValue - 0.001
      : reportedVal <= baselineValue + 0.001;

    if (meetsMilestone) {
      status = "green";
      ragStatus = "on_track";
      color = TL_GREEN;
      badgeLabel = "On Track";
      ruleApplied = `Green (On Track): ${evaluationYear} Reported (${formatWithUnit(reportedVal, rawUnit)}) ≥ ${evaluationYear} Expected Milestone (${formatWithUnit(expectedMilestone, rawUnit)})`;
      varianceSummary = `Reported ${formatWithUnit(reportedVal, rawUnit)} is ${fmtSigned(deltaVsBaseline)} vs. ${baselineYear} baseline (${formatWithUnit(baselineValue, rawUnit)}) and ${fmtSigned(deltaVsExpected2026)} above the ${evaluationYear} expected milestone (${formatWithUnit(expectedMilestone, rawUnit)}).`;
    } else if (betterOrEqualBaseline) {
      status = "amber";
      ragStatus = "at_risk";
      color = TL_YELLOW;
      badgeLabel = "At Risk";
      const gapBelowMilestone = Math.abs(expectedMilestone - reportedVal);
      const relPctBelow =
        pctBelowOrAboveMilestone !== null
          ? ` (${formatMetricNum(Math.abs(pctBelowOrAboveMilestone))}% below milestone)`
          : "";
      ruleApplied = `Amber (At Risk): Improved vs. ${baselineYear} Baseline (${formatWithUnit(baselineValue, rawUnit)}), but ${formatMetricNum(gapBelowMilestone)} ${diffUnitLabel} below ${evaluationYear} Milestone (${formatWithUnit(expectedMilestone, rawUnit)})`;
      varianceSummary = `Moving in the right direction (${fmtSigned(deltaVsBaseline)} vs. ${baselineYear} baseline of ${formatWithUnit(baselineValue, rawUnit)}), but trails the ${evaluationYear} expected milestone (${formatWithUnit(expectedMilestone, rawUnit)}) by ${formatMetricNum(gapBelowMilestone)} ${diffUnitLabel}${relPctBelow}.`;
    } else {
      status = "red";
      ragStatus = "off_track";
      color = TL_RED;
      badgeLabel = "Off Track";
      const regressedAmt = Math.abs(reportedVal - baselineValue);
      const gapBelowMilestone = Math.abs(expectedMilestone - reportedVal);
      ruleApplied = `Red (Off Track): Worse than ${baselineYear} Baseline by ${formatMetricNum(regressedAmt)} ${diffUnitLabel} (${formatWithUnit(reportedVal, rawUnit)} vs. ${formatWithUnit(baselineValue, rawUnit)})`;
      varianceSummary = isReductionMetric && reportedVal < 0
        ? `Moving in the wrong direction: instead of a reduction toward ${formatWithUnit(target2030, rawUnit)}, the indicator increased by ${formatMetricNum(Math.abs(reportedVal))}% vs. the ${baselineYear} baseline (${formatMetricNum(gapBelowMilestone)} ${diffUnitLabel} below the ${evaluationYear} milestone of ${formatWithUnit(expectedMilestone, rawUnit)}).`
        : `Moving in the wrong direction: reported ${formatWithUnit(reportedVal, rawUnit)} is ${formatMetricNum(regressedAmt)} ${diffUnitLabel} worse than the ${baselineYear} baseline (${formatWithUnit(baselineValue, rawUnit)}) and ${formatMetricNum(gapBelowMilestone)} ${diffUnitLabel} below the ${evaluationYear} expected milestone (${formatWithUnit(expectedMilestone, rawUnit)}).`;
    }
  }

  return {
    status,
    ragStatus,
    color,
    badgeLabel,
    evaluationYear,
    baselineYear,
    baselineValue,
    reported2026: reportedVal,
    expected2026: expectedMilestone,
    target2030,
    unit: rawUnit,
    higherIsBetter,
    isReductionMetric,
    indicatorTypeLabel,
    totalYears,
    elapsedYears,
    requiredAnnualPace,
    deltaVsBaseline,
    deltaVsExpected2026,
    deltaVsTarget2030,
    pctBelowOrAboveMilestone,
    completionPct,
    ruleApplied,
    varianceSummary,
    milestoneFormulaText,
    fullRationaleText: `${ruleApplied}. ${varianceSummary} ${milestoneFormulaText}`,
  };
}

