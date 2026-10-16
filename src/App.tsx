"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Info, X } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  KPI,
  RAGStatus,
  SheetSyncLog,
  SheetTermsMap,
  BigPushPillarSpec,
} from "./types";
import { StrategicHierarchyView } from "./components/StrategicHierarchyView";
import { KPISparkline } from "./components/KPISparkline";
import { ApexTrajectoryCard } from "./components/ApexTrajectoryCard";
import { IndicatorClassificationModal } from "./components/IndicatorClassificationModal";
import { DataQualityTableView } from "./components/DataQualityTableView";
import { InfoIconButton, RBMTooltip } from "./components/RBMTooltip";
import { syncKPIsFromGoogleSheets, SPREADSHEET_ID } from "./lib/sheetsService";
import {
  evaluateKPITrafficLight,
  formatWithUnit,
  formatMetricNum,
} from "./lib/kpiTrafficLight";
import { exportElementToPDF, exportElementToPNG } from "./lib/pdfExport";

const heroBg = "/images/malaria_hero_bg_1783577339212.jpg";

interface AppProps {
  initialKPIs?: KPI[];
  initialTerms?: SheetTermsMap;
  initialBigPushPillars?: BigPushPillarSpec[];
}

const renderFormattedText = (text: string) => {
  const boldParts = text.split("**");
  return boldParts.flatMap((boldPart, bIdx) => {
    const isBold = bIdx % 2 === 1;
    const italicParts = boldPart.split("*");
    const renderedItalics = italicParts.map((italicPart, iIdx) => {
      const isItalic = iIdx % 2 === 1;
      if (isItalic) {
        return (
          <em key={`it-${iIdx}`} className="italic text-slate-600 font-medium">
            {italicPart}
          </em>
        );
      }
      return italicPart;
    });

    if (isBold) {
      return (
        <strong key={`b-${bIdx}`} className="font-bold text-slate-900">
          {renderedItalics}
        </strong>
      );
    }
    return renderedItalics;
  });
};

const renderBriefingText = (text: string, isSection: boolean = false) => {
  if (!text) return null;

  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed === "*" || trimmed === "**" || trimmed === "***") {
      return <div key={i} className="h-1.5" />;
    }

    if (trimmed.startsWith(">")) {
      const cleanText = trimmed
        .replace(/^>\s*/, "")
        .replace(/^\*\s*/, "")
        .replace(/\*\s*$/, "")
        .trim();
      return (
        <blockquote
          key={i}
          className="my-4 border-l-4 border-slate-300 pl-4 text-xs sm:text-sm text-slate-500 italic"
        >
          {renderFormattedText(cleanText)}
        </blockquote>
      );
    }

    if (line.startsWith("#")) {
      const cleanText = line.replace(/#/g, "").trim();
      if (isSection) {
        return (
          <h4 key={i} className="font-bold text-slate-900 text-xs mt-3 mb-1">
            {renderFormattedText(cleanText)}
          </h4>
        );
      }
      return (
        <h3
          key={i}
          className="text-sm font-bold text-slate-900 border-l-4 border-blue-600 pl-2 mt-6 mb-2 uppercase tracking-wide"
        >
          {renderFormattedText(cleanText)}
        </h3>
      );
    }

    const listMatch = line.match(/^[-*+]\s+(.*)/);
    if (listMatch) {
      const content = listMatch[1];
      return (
        <li key={i} className={`${isSection ? "ml-4" : "ml-5"} list-disc mt-1.5 text-slate-700`}>
          {renderFormattedText(content)}
        </li>
      );
    }

    return (
      <p key={i} className={`${isSection ? "mt-1" : "mt-1.5 leading-relaxed text-slate-700"}`}>
        {renderFormattedText(line)}
      </p>
    );
  });
};

const getSectionTheme = (secId: string) => {
  if (secId === "big_push") {
    return {
      bg: "bg-orange-50",
      border: "border-orange-200",
      text: "text-[#E55535]",
      fill: "#E55535",
    };
  }
  if (secId === "unity_engage") {
    return {
      bg: "bg-[#1F429B]/10",
      border: "border-[#1F429B]/30",
      text: "text-[#1F429B]",
      fill: "#1F429B",
    };
  }
  if (secId === "unity_align") {
    return {
      bg: "bg-[#1E62D0]/10",
      border: "border-[#1E62D0]/30",
      text: "text-[#1E62D0]",
      fill: "#1E62D0",
    };
  }
  if (secId === "unity_enable") {
    return {
      bg: "bg-[#00A3E0]/10",
      border: "border-[#00A3E0]/30",
      text: "text-[#00A3E0]",
      fill: "#00A3E0",
    };
  }
  if (secId === "unity_act") {
    return {
      bg: "bg-[#D2E24E]/20",
      border: "border-[#D2E24E]/40",
      text: "text-[#8c9c1b]",
      fill: "#D2E24E",
    };
  }
  if (secId === "unity_impact") {
    return {
      bg: "bg-[#43B02A]/10",
      border: "border-[#43B02A]/30",
      text: "text-[#43B02A]",
      fill: "#43B02A",
    };
  }
  return {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
    fill: "#3b82f6",
  };
};

const getKPIStrategicColor = (kpi: KPI) => {
  if (kpi.category === "save_lives") return "#FFC72C";
  if (kpi.category === "ecosystem") return "#84cc16";
  if (kpi.category === "architecture" || kpi.category === "broader_goals") return "#10b981";
  if (kpi.category === "big_push") return "#E55535";
  if (kpi.category === "unity") {
    const step = kpi.unityStep || "";
    const sub = kpi.subcategory || "";
    if (step.includes("U.1") || sub === "engage") return "#1F429B";
    if (step.includes("U.2") || sub === "align") return "#1E62D0";
    if (step.includes("U.3") || sub === "enable") return "#00A3E0";
    if (step.includes("U.4") || sub === "act") return "#8c9c1b";
    if (step.includes("U.5") || sub === "impact") return "#43B02A";
    return "#1E62D0";
  }
  if (kpi.group === "Secretariat" || kpi.owner === "Secretariat") return "#3b82f6";
  return "#6366f1";
};

const getKPIStrategicLabel = (kpi: KPI) => {
  if (kpi.category === "save_lives") return "Save Lives";
  if (kpi.category === "ecosystem") return "Ecosystem & Finance";
  if (kpi.category === "architecture" || kpi.category === "broader_goals") return "Strategic Architecture";
  if (kpi.category === "big_push") return "Big Push";
  if (kpi.category === "unity") {
    const step = kpi.unityStep || "";
    const sub = kpi.subcategory || "";
    if (step.includes("U.1") || sub === "engage") return "U.1 Engage";
    if (step.includes("U.2") || sub === "align") return "U.2 Align";
    if (step.includes("U.3") || sub === "enable") return "U.3 Enable";
    if (step.includes("U.4") || sub === "act") return "U.4 Act";
    if (step.includes("U.5") || sub === "impact") return "U.5 Impact";
    return "Unity 30";
  }
  if (kpi.group === "Secretariat" || kpi.owner === "Secretariat") return "Secretariat";
  return "Partnership";
};

const getKPIYearValues = (kpi: KPI): { [year: number]: number } => {
  if (kpi.yearValues && Object.keys(kpi.yearValues).length >= 1) {
    return kpi.yearValues;
  }
  return {};
};

const getYearValueStatus = (kpi: KPI, year: number, val: number | undefined): RAGStatus => {
  if (val === undefined || val === null || isNaN(val)) {
    return "pending";
  }
  const evalForYear = evaluateKPITrafficLight(
    {
      ...kpi,
      value: year === 2026 ? val : kpi.value,
      yearValues: { ...(kpi.yearValues || {}), [year]: val },
    },
    year
  );
  return evalForYear.status;
};

const normalizeKPIList = (list: KPI[]): KPI[] => {
  const seen = new Set<string>();
  return list
    .filter((k) => {
      if (!k || !k.id) return false;
      if (seen.has(k.id)) return false;
      seen.add(k.id);
      return true;
    })
    .map((k) => ({
      ...k,
      status: evaluateKPITrafficLight(k).status,
    }));
};

const computeSectionProgressStats = (items: KPI[]) => {
  let sumProgress = 0;
  let sumExpected = 0;
  let validCount = 0;

  items.forEach((k) => {
    const tl = evaluateKPITrafficLight(k);
    const b = tl.baselineValue;
    const t = tl.target2030;
    const v = tl.reported2026;
    const hib = tl.higherIsBetter;

    if (b !== null && t !== null && v !== null) {
      validCount++;
      if (t === b) {
        sumProgress += (hib ? v >= t : v <= t) ? 100 : 0;
        sumExpected += 100;
      } else {
        const span = Math.abs(t - b) || 1;
        const signedDelta = hib ? v - b : b - v;
        const pct = Math.min(100, Math.max(0, (signedDelta / span) * 100));
        sumProgress += pct;

        if (tl.expected2026 !== null) {
          const expDelta = hib
            ? tl.expected2026 - b
            : b - tl.expected2026;
          const expPct = Math.min(100, Math.max(0, (expDelta / span) * 100));
          sumExpected += expPct;
        }
      }
    }
  });

  const avgProgress = validCount > 0 ? Math.round(sumProgress / validCount) : null;
  const avgExpectedProgress = validCount > 0 ? Math.round(sumExpected / validCount) : null;
  const greenCount = items.filter((k) => k.status === "green").length;
  const amberCount = items.filter((k) => k.status === "amber").length;
  const redCount = items.filter((k) => k.status === "red").length;
  const pendingCount = items.filter((k) => k.status === "pending").length;

  let overallStatus: "green" | "amber" | "red" | "pending" = "pending";
  if (validCount > 0 && avgProgress !== null) {
    if (redCount > greenCount && redCount >= amberCount) {
      overallStatus = "red";
    } else if (
      avgExpectedProgress !== null &&
      avgProgress >= avgExpectedProgress &&
      redCount === 0
    ) {
      overallStatus = "green";
    } else if (greenCount > 0 && amberCount === 0 && redCount === 0) {
      overallStatus = "green";
    } else if (avgProgress < 10 && redCount > 0) {
      overallStatus = "red";
    } else {
      overallStatus = "amber";
    }
  }

  return {
    avgProgress,
    avgExpectedProgress,
    validCount,
    greenCount,
    amberCount,
    redCount,
    pendingCount,
    totalCount: items.length,
    overallStatus,
  };
};

const TAB_LABELS: Record<"hub" | "rag" | "briefing", string> = {
  hub: "Strategic Framework",
  rag: "Indicator Matrix",
  briefing: "Executive Briefing",
};

export default function App({
  initialKPIs = [],
  initialTerms = {},
  initialBigPushPillars = [],
}: AppProps) {
  const [kpis, setKpis] = useState<KPI[]>(() => normalizeKPIList(initialKPIs));
  const [sheetTerms, setSheetTerms] = useState<SheetTermsMap>(initialTerms);
  const [bigPushPillars, setBigPushPillars] = useState<BigPushPillarSpec[]>(initialBigPushPillars);

  const kpisRef = useRef<KPI[]>(kpis);
  kpisRef.current = kpis;

  // Live Google Sheets Sync State
  const [liveSyncStatus, setLiveSyncStatus] = useState<"connected" | "syncing" | "error">("connected");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastSyncLog, setLastSyncLog] = useState<SheetSyncLog | null>(null);

  // Navigation & View Filters (Consolidated 3-Tab Architecture)
  const [ownerFilter, setOwnerFilter] = useState<"all" | "secretariat" | "partnership">("all");
  const [activeMainTab, setActiveMainTab] = useState<"hub" | "rag" | "briefing">("hub");
  const [frameworkSubView, setFrameworkSubView] = useState<"cascade" | "strategy_doc" | "blocks">("cascade");
  const [matrixSubView, setMatrixSubView] = useState<"trajectory" | "quality_access">("trajectory");
  const [selectedCell, setSelectedCell] = useState<{
    catId: string | "all";
    status: RAGStatus | "all";
  } | null>(null);
  const [kpiSearchQuery, setKpiSearchQuery] = useState("");
  const [classificationModalKpi, setClassificationModalKpi] = useState<KPI | null>(null);
  const [isKnowMoreOpen, setIsKnowMoreOpen] = useState(false);
  const [drilldownModal, setDrilldownModal] = useState<{
    sectionId: string;
    kpiId?: string | null;
    statusFilter: RAGStatus | "all";
    searchQuery: string;
  } | null>(null);
  const [heatmapPlotMode, setHeatmapPlotMode] = useState<"milestone" | "sparkline">("milestone");
  const [globalFocusArea, setGlobalFocusArea] = useState<string>("all");
  const selectedSection = globalFocusArea === "all" ? null : globalFocusArea;
  const sectionDrilldownRef = useRef<HTMLDivElement>(null);

  const openTierDrilldown = useCallback((sectionId: string, kpiId?: string | null) => {
    setDrilldownModal({
      sectionId,
      kpiId: kpiId || null,
      statusFilter: "all",
      searchQuery: "",
    });
  }, []);

  // PDF & PNG Export States & Refs
  const [isExportingTabPdf, setIsExportingTabPdf] = useState(false);
  const [isExportingTabPng, setIsExportingTabPng] = useState(false);
  const activeTabViewportRef = useRef<HTMLDivElement>(null);
  const cleanMatrixRef = useRef<HTMLDivElement>(null);
  const donorSection3MatrixRef = useRef<HTMLDivElement>(null);
  const donorReportRef = useRef<HTMLDivElement>(null);

  // Donor Strategic Briefing States
  const [donorBriefLoading, setDonorBriefLoading] = useState(false);
  const [donorBriefText, setDonorBriefText] = useState("");
  const [donorBriefError, setDonorBriefError] = useState("");
  const [briefingStatusFilter, setBriefingStatusFilter] = useState<RAGStatus | null>(null);
  const [isModifyContextOpen, setIsModifyContextOpen] = useState(false);
  const [briefingContextNotes, setBriefingContextNotes] = useState(
    "Account for data reliability and quality comments in the last column of the Google Sheet data source (Column W), as well as unforeseen ecosystem events such as the 2025 USG funding cuts."
  );
  const [briefingUploadedDocs, setBriefingUploadedDocs] = useState<
    Array<{ name: string; content: string }>
  >([]);

  // Countdown to 2030 Elimination Goal
  const [countdownDays, setCountdownDays] = useState(0);
  useEffect(() => {
    const targetDate = new Date("2030-12-31T23:59:59");
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      setCountdownDays(days > 0 ? days : 0);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000 * 60 * 60 * 24);
    return () => clearInterval(interval);
  }, []);

  // Live Google Sheets Sync Executor
  const performLiveSync = useCallback(async () => {
    try {
      setLiveSyncStatus("syncing");
      const { updatedKPIs, log, terms, bigPushPillars: pillars } = await syncKPIsFromGoogleSheets(
        kpisRef.current
      );

      if (updatedKPIs && updatedKPIs.length > 0) {
        setKpis(normalizeKPIList(updatedKPIs));
      }
      if (terms && Object.keys(terms).length > 0) {
        setSheetTerms(terms);
      }
      if (pillars && pillars.length > 0) {
        setBigPushPillars(pillars);
      }

      setLastSyncLog(log);
      setLastSyncTime(new Date());
      setLiveSyncStatus("connected");
    } catch (err) {
      console.warn("Google Sheets sync error:", err);
      setLiveSyncStatus("error");
    }
  }, []);

  // Sync on mount and poll every 300s
  useEffect(() => {
    performLiveSync();
    const timer = setInterval(() => {
      performLiveSync();
    }, 300000);
    return () => clearInterval(timer);
  }, [performLiveSync]);

  const filterKPIsByFocusArea = useCallback((list: KPI[], area: string): KPI[] => {
    if (area === "all") return list;
    if (area === "save_lives")
      return list.filter((k) => k.group === "Save Lives" || k.category === "save_lives");
    if (area === "ecosystem")
      return list.filter(
        (k) => k.group === "Ecosystem and Member Partners" || k.category === "ecosystem"
      );
    if (area === "ecosystem_all")
      return list.filter(
        (k) =>
          k.group === "Ecosystem and Member Partners" ||
          k.category === "ecosystem" ||
          k.group === "Broader Malaria Health Goals" ||
          k.category === "broader_goals" ||
          k.category === "architecture"
      );
    if (area === "architecture" || area === "broader_goals")
      return list.filter(
        (k) =>
          k.group === "Broader Malaria Health Goals" ||
          k.category === "broader_goals" ||
          k.category === "architecture"
      );
    if (area === "big_push")
      return list.filter(
        (k) =>
          Boolean(k.bigPushPillarId) ||
          k.category === "big_push" ||
          k.category === "ecosystem" ||
          k.group === "Ecosystem and Member Partners"
      );
    if (area === "unity")
      return list.filter((k) => k.group === "Secretariat" || k.group === "Partnership");
    if (area === "unity_engage")
      return list.filter(
        (k) => k.subcategory === "engage" || (k.unityStep && k.unityStep.includes("U.1"))
      );
    if (area === "unity_align")
      return list.filter(
        (k) => k.subcategory === "align" || (k.unityStep && k.unityStep.includes("U.2"))
      );
    if (area === "unity_enable")
      return list.filter(
        (k) => k.subcategory === "enable" || (k.unityStep && k.unityStep.includes("U.3"))
      );
    if (area === "unity_act")
      return list.filter(
        (k) => k.subcategory === "act" || (k.unityStep && k.unityStep.includes("U.4"))
      );
    if (area === "unity_impact")
      return list.filter(
        (k) => k.subcategory === "impact" || (k.unityStep && k.unityStep.includes("U.5"))
      );
    if (area === "secretariat") return list.filter((k) => k.group === "Secretariat");
    if (area === "partnership") return list.filter((k) => k.group === "Partnership");
    return list;
  }, []);

  const heatmapKPIs = useMemo(() => {
    return normalizeKPIList(filterKPIsByFocusArea(kpis, globalFocusArea));
  }, [globalFocusArea, kpis, filterKPIsByFocusArea]);

  const bannerStats = useMemo(() => {
    const green = kpis.filter((k) => k.status === "green").length;
    const amber = kpis.filter((k) => k.status === "amber").length;
    const red = kpis.filter((k) => k.status === "red").length;
    const pending = kpis.filter((k) => k.status === "pending").length;
    const total = kpis.length;
    return { green, amber, red, pending, total };
  }, [kpis]);

  const mortalityKpi = useMemo(
    () =>
      kpis.find(
        (k) =>
          k.id === "kpi-19" ||
          k.kpiCode === "KPI.19" ||
          k.name.toLowerCase().includes("mortality")
      ),
    [kpis]
  );

  const morbidityKpi = useMemo(
    () =>
      kpis.find(
        (k) =>
          k.id === "kpi-20" ||
          k.kpiCode === "KPI.20" ||
          k.name.toLowerCase().includes("incidence") ||
          k.name.toLowerCase().includes("morbidity")
      ),
    [kpis]
  );

  // Dynamically calculate stats for each of the 11 schema sections from Google Sheet KPIs
  const blockStats = useMemo(() => {
    const calculateBlockMetrics = (blockId: string) => {
      const filtered = filterKPIsByFocusArea(kpis, blockId);

      let totalProgress = 0;
      let populatedCount = 0;
      filtered.forEach((k) => {
        const { baseline, target, value } = k;
        const hasValidTarget =
          typeof target === "number" &&
          typeof baseline === "number" &&
          (target > 0 || target !== baseline);
        if (
          typeof value === "number" &&
          !isNaN(value) &&
          typeof baseline === "number" &&
          typeof target === "number" &&
          hasValidTarget
        ) {
          populatedCount++;
          if (target === baseline) {
            totalProgress += 100;
          } else if (target > baseline) {
            const progress = ((value - baseline) / (target - baseline || 1)) * 100;
            totalProgress += Math.min(100, Math.max(0, progress));
          } else {
            const progress = ((baseline - value) / (baseline - target || 1)) * 100;
            totalProgress += Math.min(100, Math.max(0, progress));
          }
        }
      });
      const score = populatedCount > 0 ? Math.round(totalProgress / populatedCount) : null;
      const redCount = filtered.filter((k) => k.status === "red").length;
      const amberCount = filtered.filter((k) => k.status === "amber").length;
      const greenCount = filtered.filter((k) => k.status === "green").length;

      return {
        count: filtered.length,
        score,
        populatedCount,
        redCount,
        amberCount,
        greenCount,
      };
    };

    const keys = [
      "save_lives",
      "ecosystem",
      "architecture",
      "big_push",
      "unity_engage",
      "unity_align",
      "unity_enable",
      "unity_act",
      "unity_impact",
      "secretariat",
      "partnership",
    ];

    const stats: {
      [key: string]: {
        count: number;
        score: number | null;
        redCount: number;
        amberCount: number;
        greenCount: number;
      };
    } = {};
    keys.forEach((k) => {
      stats[k] = calculateBlockMetrics(k);
    });
    return stats;
  }, [kpis, filterKPIsByFocusArea]);

  // Export the currently active tab to a formatted PDF
  const handleExportActiveTabPDF = async () => {
    const isCleanMatrixExport =
      activeMainTab === "rag" && matrixSubView === "trajectory" && cleanMatrixRef.current !== null;
    const element = isCleanMatrixExport ? cleanMatrixRef.current : activeTabViewportRef.current;
    if (!element || isExportingTabPdf || isExportingTabPng) return;

    setIsExportingTabPdf(true);
    try {
      const tabTitle = TAB_LABELS[activeMainTab] || "Dashboard View";
      const subScope =
        selectedSection && activeMainTab === "hub"
          ? ` (${selectedSection.replace(/_/g, " ").toUpperCase()})`
          : "";
      await exportElementToPDF({
        element,
        tabTitle: `${tabTitle}${subScope}`,
        subtitle: `RBM Partnership To End Malaria (${kpis.length} Monitored Indicators • ${bannerStats.green} On Track, ${bannerStats.amber} At Risk, ${bannerStats.red} Off Track, ${bannerStats.pending} Pending)`,
        filenamePrefix: isCleanMatrixExport ? "RBM_Indicator_Matrix" : "RBM_Impact_Dashboard",
        orientation: activeMainTab === "briefing" ? "portrait" : "landscape",
        cleanMatrixOnly: isCleanMatrixExport,
      });
    } catch (err) {
      console.error("Failed to export tab PDF:", err);
    } finally {
      setIsExportingTabPdf(false);
    }
  };

  // Export the currently active tab to a single continuous PNG image (no page breaks)
  const handleExportActiveTabPNG = async () => {
    const isCleanMatrixExport =
      activeMainTab === "rag" && matrixSubView === "trajectory" && cleanMatrixRef.current !== null;
    const element = isCleanMatrixExport ? cleanMatrixRef.current : activeTabViewportRef.current;
    if (!element || isExportingTabPng || isExportingTabPdf) return;

    setIsExportingTabPng(true);
    try {
      const tabTitle = TAB_LABELS[activeMainTab] || "Dashboard View";
      const subScope =
        selectedSection && activeMainTab === "hub"
          ? ` (${selectedSection.replace(/_/g, " ").toUpperCase()})`
          : "";
      await exportElementToPNG({
        element,
        tabTitle: `${tabTitle}${subScope}`,
        subtitle: `RBM Partnership To End Malaria (${kpis.length} Monitored Indicators • ${bannerStats.green} On Track, ${bannerStats.amber} At Risk, ${bannerStats.red} Off Track, ${bannerStats.pending} Pending)`,
        filenamePrefix: isCleanMatrixExport ? "RBM_Indicator_Matrix" : "RBM_Impact_Dashboard",
        cleanMatrixOnly: isCleanMatrixExport,
      });
    } catch (err) {
      console.error("Failed to export tab PNG:", err);
    } finally {
      setIsExportingTabPng(false);
    }
  };

  // Export ONLY the clean Section 3 Indicator Matrix (no summary stats or headers) as PNG or PDF
  const handleExportCleanDonorMatrix = async (format: "png" | "pdf") => {
    const element = donorSection3MatrixRef.current || cleanMatrixRef.current;
    if (!element || isExportingTabPng || isExportingTabPdf) return;

    if (format === "png") {
      setIsExportingTabPng(true);
      try {
        await exportElementToPNG({
          element,
          tabTitle: "Section_3_Indicator_Matrix",
          filenamePrefix: "RBM_Donor_Report",
          cleanMatrixOnly: true,
        });
      } finally {
        setIsExportingTabPng(false);
      }
    } else {
      setIsExportingTabPdf(true);
      try {
        await exportElementToPDF({
          element,
          tabTitle: "Section_3_Indicator_Matrix",
          filenamePrefix: "RBM_Donor_Report",
          orientation: "landscape",
          cleanMatrixOnly: true,
        });
      } finally {
        setIsExportingTabPdf(false);
      }
    }
  };

  // Generate AI Strategic Board Briefing from live Google Sheet KPIs
  const generateDonorBriefing = async (focusAreaId: string) => {
    setDonorBriefLoading(true);
    setDonorBriefError("");
    setDonorBriefText("");
    try {
      let filteredKPIs = kpis;
      let focusName = "Full Partnership Portfolio";

      if (focusAreaId !== "all") {
        const matchingSection = [
          { id: "save_lives", name: "Save Lives Outcomes" },
          { id: "ecosystem", name: "Ecosystem Health" },
          { id: "architecture", name: "Global Health Architecture" },
          { id: "big_push", name: "Big Push against Malaria" },
          { id: "unity", name: "Unity 30 Country Support (U.1 - U.5)" },
          { id: "secretariat", name: "Secretariat Support" },
          { id: "partnership", name: "Partnership KPIs" },
        ].find((s) => s.id === focusAreaId);

        if (matchingSection) {
          focusName = matchingSection.name;
          filteredKPIs = filterKPIsByFocusArea(kpis, focusAreaId);
        }
      }

      const response = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpis: filteredKPIs,
          currentHorizon: "2026 Workplan & 2030 Elimination Horizon",
          focusArea: focusName,
          contextNotes: briefingContextNotes,
          uploadedDocs: briefingUploadedDocs,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to compile strategic board briefing");
      }

      const data = await response.json();
      setDonorBriefText(data.text);
    } catch (err: any) {
      setDonorBriefError(err.message || "An error occurred during briefing compilation.");
    } finally {
      setDonorBriefLoading(false);
    }
  };

  const downloadDonorBriefingPDF = async (focusAreaName: string) => {
    const element = donorReportRef.current;
    if (!element || isExportingTabPdf) return;

    setIsExportingTabPdf(true);
    try {
      await exportElementToPDF({
        element,
        tabTitle: `Strategic Board Briefing — ${focusAreaName}`,
        subtitle: "RBM Partnership To End Malaria — Executive Performance Synthesis",
        filenamePrefix: "RBM_Strategic_Board_Briefing",
        orientation: "portrait",
      });
    } catch (err) {
      console.error("Failed to export briefing PDF:", err);
    } finally {
      setIsExportingTabPdf(false);
    }
  };

  const renderIndicatorMatrixTable = (
    itemsToFilter: KPI[],
    options?: { cleanStatic?: boolean }
  ) => {
    const cleanStatic = Boolean(options?.cleanStatic);
    const filteredKPIs = itemsToFilter.filter((k) => {
      if (!cleanStatic && kpiSearchQuery.trim()) {
        const q = kpiSearchQuery.toLowerCase();
        const matchName = k.name && k.name.toLowerCase().includes(q);
        const matchCode = k.kpiCode && k.kpiCode.toLowerCase().includes(q);
        const matchDef =
          (k.definition && k.definition.toLowerCase().includes(q)) ||
          (k.description && k.description.toLowerCase().includes(q));
        if (!matchName && !matchCode && !matchDef) return false;
      }
      if (cleanStatic || ownerFilter === "all") return true;
      const o = k.owner.toLowerCase();
      if (ownerFilter === "secretariat") {
        return (
          o === "secretariat" ||
          o === "arcpc" ||
          o === "crspc" ||
          k.group === "Secretariat"
        );
      }
      if (ownerFilter === "partnership") {
        return (
          o === "partnership" ||
          o === "joint" ||
          o.startsWith("wg") ||
          k.group === "Partnership"
        );
      }
      return true;
    });

    const groupDefinitions = [
      {
        id: "save_lives",
        title: "Save Lives (Apex Indicators)",
        accent: "#FFC72C",
        textAccent: "text-amber-900",
        bgHeader: "bg-amber-50/90 border-y border-amber-200/80",
        items: filteredKPIs.filter(
          (k) => k.group === "Save Lives" || k.category === "save_lives"
        ),
      },
      {
        id: "ecosystem",
        title: "Ecosystem & Member Partners",
        accent: "#65a30d",
        textAccent: "text-lime-900",
        bgHeader: "bg-lime-50/90 border-y border-lime-200/80",
        items: filteredKPIs.filter(
          (k) =>
            k.group === "Ecosystem and Member Partners" ||
            k.category === "ecosystem"
        ),
      },
      {
        id: "broader_goals",
        title: "Broader Malaria Health Goals",
        accent: "#059669",
        textAccent: "text-emerald-900",
        bgHeader: "bg-emerald-50/90 border-y border-emerald-200/80",
        items: filteredKPIs.filter(
          (k) =>
            k.group === "Broader Malaria Health Goals" ||
            k.category === "broader_goals" ||
            k.category === "architecture"
        ),
      },
      {
        id: "secretariat",
        title: "Unity 30 — Secretariat KPIs",
        accent: "#1d4ed8",
        textAccent: "text-blue-900",
        bgHeader: "bg-blue-50/90 border-y border-blue-200/80",
        items: filteredKPIs.filter((k) => k.group === "Secretariat"),
      },
      {
        id: "partnership",
        title: "Unity 30 — Partnership KPIs",
        accent: "#4338ca",
        textAccent: "text-indigo-900",
        bgHeader: "bg-indigo-50/90 border-y border-indigo-200/80",
        items: filteredKPIs.filter((k) => k.group === "Partnership"),
      },
    ].filter((g) => g.items.length > 0);

    return (
      <table className="dashboard-table text-left w-full">
        <thead>
          <tr className="text-[9.5px] uppercase">
            <th className="py-1 px-3">Indicator (KPI)</th>
            <th
              className="py-1 px-1 text-center w-13 font-bold"
              title="Baseline Year (2015, 2025, or 2026)"
            >
              Base Yr
            </th>
            <th
              className="py-1 px-1 text-center w-15 font-bold"
              title="Baseline Value"
            >
              Baseline
            </th>
            <th
              className="py-1 px-1 text-center w-15 text-[#2563eb] font-extrabold"
              title="2026 Reported Value"
            >
              2026 Rep.
            </th>
            {[2027, 2028, 2029].map((yr) => (
              <th
                key={yr}
                className="py-1 px-1 text-center w-11 text-gray-400"
                title={`${yr} Reporting Cycle`}
              >
                {yr}
              </th>
            ))}
            <th
              className="py-1 px-1 text-center w-15 text-emerald-700 font-extrabold"
              title="2030 Target"
            >
              2030 Tgt
            </th>
            <th className="py-1 pl-2.5 pr-4 text-center w-44 sm:w-52">
              {heatmapPlotMode === "milestone" ? "KPI Progress Bar" : "Line View"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 text-xs">
          {groupDefinitions.map((group) => {
            const secStats = computeSectionProgressStats(group.items);
            const avgBarColor =
              secStats.overallStatus === "green"
                ? "#16a34a"
                : secStats.overallStatus === "red"
                ? "#dc2626"
                : secStats.overallStatus === "amber"
                ? "#f59e0b"
                : "#94a3b8";
            const avgBadgeClasses =
              secStats.overallStatus === "green"
                ? "bg-emerald-100/90 text-emerald-800 border-emerald-300"
                : secStats.overallStatus === "red"
                ? "bg-rose-100/90 text-rose-800 border-rose-300"
                : secStats.overallStatus === "amber"
                ? "bg-amber-100/90 text-amber-900 border-amber-300"
                : "bg-slate-100 text-slate-600 border-slate-300";

            return (
              <React.Fragment key={group.id}>
                <tr
                  data-pdf-section-header="true"
                  onClick={() => openTierDrilldown(group.id, null)}
                  className={`${group.bgHeader} cursor-pointer hover:brightness-97 transition-all group/sec`}
                  title={`Click to open ${group.title} Indicator Drilldown Popup`}
                >
                  <td colSpan={8} className="py-1 px-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Left: Section Title + Action Prompt */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-2.5 h-2.5 rounded-xs inline-block shrink-0 shadow-2xs"
                          style={{ backgroundColor: group.accent }}
                        />
                        <span
                          className={`font-display font-black text-[10.5px] uppercase tracking-wider whitespace-nowrap ${group.textAccent}`}
                        >
                          {group.title}
                        </span>
                        {!cleanStatic && (
                          <span
                            data-pdf-ignore="true"
                            className="text-[9.5px] font-sans italic font-semibold text-[#1d4ed8] group-hover/sec:underline whitespace-nowrap"
                          >
                            Click section to open drilldown →
                          </span>
                        )}
                      </div>

                      {/* Right: Section Average Progress + Interactive Status Summary */}
                      <div className="flex items-center gap-2 flex-wrap pr-1">
                        {/* Average Progress to 2030 Target Badge & Mini Bar */}
                        <div
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-[9.5px] font-bold whitespace-nowrap ${avgBadgeClasses}`}
                          title={
                            secStats.avgProgress !== null
                              ? `Average progress toward 2030 target across ${secStats.validCount} reported indicator(s) in ${group.title}: ${secStats.avgProgress}%`
                              : "Awaiting 2026 reported values or 2030 targets"
                          }
                        >
                          <span className="whitespace-nowrap">
                            Avg. Progress to 2030 Target:{" "}
                            <strong className="font-black">
                              {secStats.avgProgress !== null
                                ? `${secStats.avgProgress}%`
                                : "Pending"}
                            </strong>
                          </span>
                          {secStats.avgProgress !== null && (
                            <span className="w-12 h-1.5 rounded-full bg-white/80 border border-black/10 overflow-hidden inline-flex shrink-0">
                              <span
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.max(4, secStats.avgProgress)}%`,
                                  backgroundColor: avgBarColor,
                                }}
                              />
                            </span>
                          )}
                        </div>

                        {!cleanStatic && (
                          <div
                            data-pdf-ignore="true"
                            className="hidden sm:inline-flex items-center gap-1 font-mono text-[9px] font-bold"
                          >
                            {secStats.greenCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[#16a34a] text-white whitespace-nowrap">
                                {secStats.greenCount} On Track
                              </span>
                            )}
                            {secStats.amberCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[#f59e0b] text-white whitespace-nowrap">
                                {secStats.amberCount} At Risk
                              </span>
                            )}
                            {secStats.redCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[#dc2626] text-white whitespace-nowrap">
                                {secStats.redCount} Off Track
                              </span>
                            )}
                            {secStats.pendingCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 whitespace-nowrap">
                                {secStats.pendingCount} Pending
                              </span>
                            )}
                          </div>
                        )}

                        {!cleanStatic && (
                          <span
                            data-pdf-ignore="true"
                            className="font-mono text-[9.5px] font-bold text-[#1e3653] whitespace-nowrap"
                          >
                            {group.items.length}{" "}
                            {group.items.length === 1 ? "Indicator" : "Indicators"}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
                {group.items.map((kpi) => {
                  const isSelected =
                    !cleanStatic &&
                    (drilldownModal?.kpiId === kpi.id || selectedCell?.catId === kpi.id);
                  const kpiYears = getKPIYearValues(kpi);
                  const stratColor = getKPIStrategicColor(kpi);
                  const stratLabel = getKPIStrategicLabel(kpi);
                  const tlEval = evaluateKPITrafficLight(kpi);
                  const tlEval2026 = evaluateKPITrafficLight(kpi, 2026);
                  const baseYr = tlEval.baselineYear;
                  const bVal = tlEval.baselineValue;
                  const tVal = tlEval.target2030;
                  const rep2026Val = tlEval2026.reported2026;
                  const hasRep2026 = rep2026Val !== null;
                  const hasValidTarget = tVal !== null;

                  const status2026Classes =
                    tlEval2026.status === "green"
                      ? "bg-[#16a34a] text-white font-black ring-1 ring-emerald-200/60"
                      : tlEval2026.status === "amber"
                      ? "bg-[#f59e0b] text-white font-black ring-1 ring-amber-200/60"
                      : tlEval2026.status === "red"
                      ? "bg-[#dc2626] text-white font-black ring-1 ring-red-200/60"
                      : "bg-slate-200/80 text-slate-500 font-bold border border-slate-300";

                  const rowAccent =
                    tlEval.ragStatus === "on_track"
                      ? "green"
                      : tlEval.ragStatus === "at_risk"
                      ? "amber"
                      : tlEval.ragStatus === "off_track"
                      ? "red"
                      : "blue";

                  return (
                    <tr
                      key={kpi.id}
                      onClick={() => openTierDrilldown(group.id, kpi.id)}
                      className={`hover:bg-blue-50/40 transition-all cursor-pointer group ${
                        isSelected ? "bg-blue-50/60 shadow-xs ring-1 ring-blue-200" : ""
                      }`}
                      title={`Click to open Indicator Drilldown Popup for ${kpi.name}`}
                    >
                      <td className="py-1 px-3 relative">
                        <div
                          className="absolute left-0 top-0.5 bottom-0.5 w-1 rounded"
                          style={{ backgroundColor: stratColor }}
                        />
                        <div className="pl-1.5 pr-1 flex items-center gap-1.5">
                          {kpi.kpiCode && (
                            <span className="text-[8px] font-mono font-bold px-1.2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap shrink-0">
                              {kpi.kpiCode}
                            </span>
                          )}
                          <span className="text-[11px] font-normal text-slate-800 leading-tight group-hover:text-[#1d4ed8] transition-colors">
                            {kpi.name}
                          </span>
                          {!cleanStatic && (
                            <span data-pdf-ignore="true" className="inline-flex items-center gap-1.5 shrink-0">
                              <InfoIconButton
                                size="xs"
                                tooltipTitle={`${kpi.kpiCode || kpi.id} • ${stratLabel}`}
                                tooltipBadge={tlEval.badgeLabel}
                                accent={rowAccent}
                                onClick={() => setClassificationModalKpi(kpi)}
                                ariaLabel={`View Traffic-Light rationale and info for ${kpi.name}`}
                                widthClass="w-72"
                                tooltipContent={
                                  <div className="space-y-1.5">
                                    <div className="font-mono font-bold text-white text-[10px]">
                                      {tlEval.ruleApplied}
                                    </div>
                                    <p className="text-[10px] text-blue-50/95 leading-relaxed">
                                      {tlEval.varianceSummary}
                                    </p>
                                    <div className="text-[9.5px] font-mono text-blue-100 bg-white/10 px-2 py-1 rounded border border-white/15">
                                      {tlEval.milestoneFormulaText}
                                    </div>
                                  </div>
                                }
                              />
                              <span className="text-[9px] font-sans italic font-semibold text-[#1d4ed8] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                Drill down →
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 1a. Baseline Year Cell */}
                      <td className="py-1 px-1 text-center">
                        <div
                          className={`mx-auto rounded-md py-0.5 px-1 text-[9px] font-mono leading-none border font-bold flex justify-center items-center min-h-[24px] w-11 ${
                            baseYr === 2015
                              ? "bg-purple-50 border-purple-200 text-purple-800"
                              : baseYr === 2026
                              ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                              : "bg-slate-100 border-slate-200 text-slate-700"
                          }`}
                          title={`${kpi.name}\nBaseline Year: ${baseYr}`}
                        >
                          <span className="text-[9.5px] font-black leading-none">{baseYr}</span>
                        </div>
                      </td>

                      {/* 1b. Baseline Value Cell */}
                      <td className="py-1 px-1 text-center">
                        <div
                          className="mx-auto rounded-md py-0.5 px-1 text-[9px] font-mono leading-tight bg-slate-100 border border-slate-200 text-slate-800 font-bold flex flex-col justify-center items-center min-h-[24px] w-13"
                          title={`${kpi.name}\nBaseline Year: ${baseYr}\nBaseline Value: ${
                            bVal !== null ? formatWithUnit(bVal, tlEval.unit) : "Pending"
                          }`}
                        >
                          <span className="text-[9.5px] font-black leading-tight whitespace-nowrap">
                            {bVal !== null ? formatMetricNum(bVal) : "—"}
                          </span>
                          <span className="text-[6.5px] text-slate-500 leading-tight whitespace-nowrap">
                            {bVal !== null ? kpi.unit || tlEval.unit : "Pending"}
                          </span>
                        </div>
                      </td>

                      {/* 2. 2026 Reported Cell */}
                      <td className="py-1 px-1 text-center">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setClassificationModalKpi(kpi);
                          }}
                          className={`mx-auto rounded-md py-0.5 px-1 text-[9px] font-mono leading-tight shadow-2xs transition-all flex flex-col justify-center items-center min-h-[24px] w-13 ${status2026Classes}`}
                          title={`${kpi.name} (2026 Reported)\n${tlEval2026.ruleApplied}\n${tlEval2026.varianceSummary}\nClick to view full rationale`}
                        >
                          <span className="text-[9px] leading-tight whitespace-nowrap">
                            {hasRep2026 && rep2026Val !== null ? formatMetricNum(rep2026Val) : "—"}
                          </span>
                          <span className="text-[6.5px] opacity-90 leading-tight whitespace-nowrap">
                            {hasRep2026 ? (hasValidTarget ? kpi.unit : "No Target") : "Pending"}
                          </span>
                        </div>
                      </td>

                      {/* 3. Annual Reporting Columns (2027, 2028, 2029) */}
                      {[2027, 2028, 2029].map((year) => {
                        const val = kpiYears[year];
                        const isReported = typeof val === "number" && !isNaN(val);
                        const evalYr = isReported ? evaluateKPITrafficLight(kpi, year) : null;
                        const st = evalYr ? evalYr.status : "pending";
                        const cellClasses = !isReported
                          ? "bg-slate-100/70 text-slate-300 border border-slate-200/60"
                          : st === "green"
                          ? "bg-[#16a34a] text-white font-black ring-1 ring-emerald-200/60"
                          : st === "amber"
                          ? "bg-[#f59e0b] text-white font-black ring-1 ring-amber-200/60"
                          : st === "red"
                          ? "bg-[#dc2626] text-white font-black ring-1 ring-red-200/60"
                          : "bg-slate-200/80 text-slate-500 font-bold border border-slate-300";

                        return (
                          <td key={year} className="py-1 px-1 text-center">
                            <div
                              onClick={(e) => {
                                if (isReported) {
                                  e.stopPropagation();
                                  setClassificationModalKpi(kpi);
                                }
                              }}
                              className={`mx-auto rounded-md py-0.5 px-0.5 text-[9px] font-mono leading-tight flex flex-col items-center justify-center min-h-[24px] w-10 ${cellClasses}`}
                              title={
                                isReported && evalYr
                                  ? `${kpi.name} (${year} Reported)\n${evalYr.ruleApplied}\n${evalYr.varianceSummary}`
                                  : `${kpi.name} (${year}): Pending future report`
                              }
                            >
                              <span className="text-[9px] leading-tight whitespace-nowrap">
                                {isReported ? formatMetricNum(val) : "—"}
                              </span>
                              {isReported && (
                                <span className="text-[6.5px] opacity-90 leading-tight whitespace-nowrap">
                                  {hasValidTarget ? kpi.unit : "No Target"}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* 4. 2030 Target Cell */}
                      <td className="py-1 px-1 text-center">
                        <div
                          className={`mx-auto rounded-md py-0.5 px-1 text-[9px] font-mono leading-tight border flex flex-col justify-center items-center min-h-[24px] w-13 ${
                            hasValidTarget
                              ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 font-black"
                              : "bg-slate-100 border-slate-200 text-slate-400 font-normal"
                          }`}
                          title={
                            hasValidTarget && tVal !== null
                              ? `${kpi.name} (2030 Target): ${formatWithUnit(tVal, tlEval.unit)}`
                              : `${kpi.name}: No 2030 Target defined`
                          }
                        >
                          <span className="text-[9px] leading-tight whitespace-nowrap">
                            {hasValidTarget && tVal !== null ? formatMetricNum(tVal) : "—"}
                          </span>
                          <span className="text-[6.5px] opacity-80 leading-tight whitespace-nowrap">
                            {hasValidTarget ? kpi.unit || "Target" : "Not Set"}
                          </span>
                        </div>
                      </td>

                      {/* 5. Compact Plot Column */}
                      <td className="py-1 pl-2.5 pr-4 w-44 sm:w-52">
                        <KPISparkline kpi={kpi} compact={true} viewMode={heatmapPlotMode} />
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#111827] font-sans selection:bg-[#2563eb] selection:text-white pb-12">
      {/* 1. PROGRAMMATIC HERO BANNER (Clean Executive Header; Top badge removed & Export moved to Overview Card) */}
      <header
        className="relative text-white z-20 overflow-hidden bg-no-repeat bg-cover bg-top"
        style={{
          backgroundImage: `radial-gradient(circle at 78% 18%, rgba(31,91,139,0.92) 0%, rgba(24,70,112,0.72) 26%, transparent 58%), radial-gradient(circle at 82% 58%, rgba(22,75,120,0.72) 0%, transparent 55%), linear-gradient(110deg, #091229 0%, #0d1d3b 34%, #123d63 68%, #124873 100%)`,
        }}
      >
        {/* Hero Content + Folder Navigation Tabs (Clean Banner aligned with dashboards.endmalaria.org/en) */}
        <div className="w-full px-4 sm:px-6 lg:px-10 pt-6 pb-0 relative z-10">
          <div className="pb-2">
            <div className="w-full">
              <div className="flex items-center gap-3.5">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight text-white">
                  RBM Partnership Impact Dashboard
                </h1>
                <button
                  type="button"
                  onClick={() => setIsKnowMoreOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs sm:text-sm font-sans font-medium shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap"
                  aria-label="Know More about the RBM Partnership Impact Dashboard"
                >
                  <Info className="w-4 h-4 text-white shrink-0" />
                  <span>Know More</span>
                </button>
              </div>
              <p className="text-xs sm:text-sm text-blue-100/90 mt-2 font-normal leading-relaxed max-w-3xl">
                Theory of Change progress monitoring across the malaria ecosystem path toward
                eradication powered by the Big Push—connecting{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveMainTab("hub");
                    setFrameworkSubView("blocks");
                    setGlobalFocusArea("all");
                    setSelectedCell(null);
                  }}
                  className="underline decoration-[#7dd865] underline-offset-4 font-semibold text-white hover:text-[#7dd865] transition-colors cursor-pointer"
                >
                  Unity 30 building blocks
                </button>{" "}
                to life-saving impact outcomes.
              </p>
            </div>
          </div>

          {/* OFFICIAL RBM FOLDER-STYLE NAVIGATION TABS (.dashboard-tab) — Consolidated 3-Tab Layout */}
          <div className="pt-5">
            <nav className="flex flex-wrap gap-1" aria-label="Dashboard views">
              <button
                type="button"
                onClick={() => {
                  setActiveMainTab("hub");
                  setSelectedCell(null);
                }}
                className={`dashboard-tab ${
                  activeMainTab === "hub" ? "dashboard-tab-active" : "dashboard-tab-inactive"
                }`}
              >
                <span>Strategic Framework</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMainTab("rag");
                  setSelectedCell(null);
                }}
                className={`dashboard-tab ${
                  activeMainTab === "rag" ? "dashboard-tab-active" : "dashboard-tab-inactive"
                }`}
              >
                <span>Indicator Matrix</span>
                <span className="w-2 h-2 rounded-full bg-[#93d573] inline-block" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMainTab("briefing");
                  setSelectedCell(null);
                }}
                className={`dashboard-tab ${
                  activeMainTab === "briefing" ? "dashboard-tab-active" : "dashboard-tab-inactive"
                }`}
              >
                <span>Executive Briefing</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* 2. CORE VIEWPORT (Wrapped in activeTabViewportRef for clean multi-tab PDF export) */}
      <main className="w-full px-4 sm:px-6 lg:px-10 pt-6" ref={activeTabViewportRef}>
        {activeMainTab === "hub" ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Framework Overview Banner (With Export PDF Button in Header & Centered Adaptive Summary Figure Cards) */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#93d573] rounded-lg p-6 shadow-xs relative overflow-visible z-10">
              {/* Top Row: Title & Description on Left, Export PDF Button on Right */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563eb] mb-1">
                    Unity 30 &amp; Big Push Cascade
                  </div>
                  <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-[#111827]">
                    Strategic Framework Overview
                  </h2>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1.5 max-w-3xl leading-relaxed">
                    The RBM <strong>Unity 30</strong> Strategic Framework powers the{" "}
                    <strong>Big Push against Malaria</strong>, connecting operational building blocks
                    and annual workplan streams to global impact outcomes.
                  </p>
                </div>

                {/* Export to PNG & PDF Buttons */}
                <div className="shrink-0 self-start flex items-center gap-2" data-pdf-ignore="true">
                  <button
                    type="button"
                    onClick={handleExportActiveTabPNG}
                    disabled={isExportingTabPng || isExportingTabPdf}
                    title={`Export ${TAB_LABELS[activeMainTab]} view as a single continuous PNG image without page breaks`}
                    className={`px-3.5 h-[38px] rounded-lg text-xs font-sans font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      isExportingTabPng
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-wait"
                        : "bg-white hover:bg-[#F2F8FF] text-[#1d4ed8] border border-blue-300 shadow-2xs"
                    }`}
                  >
                    {isExportingTabPng ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        <span>Exporting PNG...</span>
                      </>
                    ) : (
                      <span>Export to PNG</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportActiveTabPDF}
                    disabled={isExportingTabPdf || isExportingTabPng}
                    title={`Export ${TAB_LABELS[activeMainTab]} view to high-resolution PDF`}
                    className={`px-3.5 h-[38px] rounded-lg text-xs font-sans font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      isExportingTabPdf
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-wait"
                        : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs"
                    }`}
                  >
                    {isExportingTabPdf ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        <span>Exporting PDF...</span>
                      </>
                    ) : (
                      <span>Export to PDF</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Centered Dynamic Horizon & Remaining Reduction Aim Statement */}
              {(() => {
                const mortEval = mortalityKpi ? evaluateKPITrafficLight(mortalityKpi) : null;
                const morbEval = morbidityKpi ? evaluateKPITrafficLight(morbidityKpi) : null;
                const mortTarget = mortEval?.target2030 ?? 90;
                const morbTarget = morbEval?.target2030 ?? 90;
                const mortRemaining =
                  mortEval?.reported2026 !== null && mortEval?.reported2026 !== undefined
                    ? Number((mortTarget - mortEval.reported2026).toFixed(1))
                    : mortTarget;
                const morbRemaining =
                  morbEval?.reported2026 !== null && morbEval?.reported2026 !== undefined
                    ? Number((morbTarget - morbEval.reported2026).toFixed(1))
                    : morbTarget;

                return (
                  <div
                    onClick={() => openTierDrilldown("save_lives")}
                    title="Click to open Save Lives (Mortality & Incidence) Apex Trajectory Cards"
                    className="mt-5 py-3.5 px-4 rounded-xl bg-[#F2F8FF]/70 hover:bg-[#F2F8FF] border border-blue-100 text-center max-w-4xl mx-auto cursor-pointer transition-colors"
                  >
                    <p className="text-sm sm:text-base font-sans font-medium text-[#1e3653] leading-relaxed">
                      Within{" "}
                      <span className="text-xl sm:text-2xl font-mono font-extrabold text-[#2563eb] mx-0.5">
                        {countdownDays.toLocaleString()}
                      </span>{" "}
                      days we aim to achieve a mortality reduction of{" "}
                      <span className="text-xl sm:text-2xl font-mono font-extrabold text-[#dc2626] mx-0.5">
                        {mortRemaining}%
                      </span>{" "}
                      and an incidence rate reduction of{" "}
                      <span className="text-xl sm:text-2xl font-mono font-extrabold text-[#dc2626] mx-0.5">
                        {morbRemaining}%
                      </span>
                    </p>
                  </div>
                );
              })()}

              {/* Centered Summary Figure Cards with Adaptive Screen-Size Spacing */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 md:gap-8 lg:gap-12 max-w-4xl mx-auto w-full">
                <div className="bg-[#F2F8FF] border border-blue-200/80 rounded-xl px-4 py-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#16a34a] tracking-tight leading-none">
                    {bannerStats.green}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-[#15803d] uppercase font-bold tracking-wider font-mono">
                      On Track
                    </span>
                    <InfoIconButton
                      size="xs"
                      tooltipTitle="On Track Criteria"
                      tooltipBadge="Green"
                      accent="green"
                      ariaLabel="On Track definition"
                      widthClass="w-64"
                      tooltipContent={
                        <p className="text-[11px] text-blue-50/95 leading-relaxed">
                          Meets or exceeds the expected milestone for the latest reported year along
                          the linear path from Baseline to 2030 Target.
                        </p>
                      }
                    />
                  </div>
                </div>

                <div className="bg-[#F2F8FF] border border-blue-200/80 rounded-xl px-4 py-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#f59e0b] tracking-tight leading-none">
                    {bannerStats.amber}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-[#b45309] uppercase font-bold tracking-wider font-mono">
                      At Risk
                    </span>
                    <InfoIconButton
                      size="xs"
                      tooltipTitle="At Risk Criteria"
                      tooltipBadge="Amber"
                      accent="amber"
                      ariaLabel="At Risk definition"
                      widthClass="w-64"
                      tooltipContent={
                        <p className="text-[11px] text-blue-50/95 leading-relaxed">
                          Moving in the right direction vs. Baseline (or at Baseline in its baseline
                          year), but lagging behind the expected milestone.
                        </p>
                      }
                    />
                  </div>
                </div>

                <div className="bg-[#F2F8FF] border border-blue-200/80 rounded-xl px-4 py-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#dc2626] tracking-tight leading-none">
                    {bannerStats.red}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-[#b91c1c] uppercase font-bold tracking-wider font-mono">
                      Off Track
                    </span>
                    <InfoIconButton
                      size="xs"
                      tooltipTitle="Off Track Criteria"
                      tooltipBadge="Red"
                      accent="red"
                      ariaLabel="Off Track definition"
                      widthClass="w-64"
                      tooltipContent={
                        <p className="text-[11px] text-blue-50/95 leading-relaxed">
                          Moving in the wrong direction (latest reported value is worse than
                          Baseline).
                        </p>
                      }
                    />
                  </div>
                </div>

                <div className="bg-[#F2F8FF] border border-blue-200/80 rounded-xl px-4 py-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-gray-500 tracking-tight leading-none">
                    {bannerStats.pending}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-gray-600 uppercase font-bold tracking-wider font-mono">
                      Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Consolidated Sub-View Switcher & Italicized User Instruction */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col items-center text-center gap-2.5">
                <div className="inline-flex flex-wrap justify-center bg-[#F2F8FF] p-1 rounded-lg border border-blue-200 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFrameworkSubView("cascade");
                      setGlobalFocusArea("all");
                    }}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      frameworkSubView === "cascade"
                        ? "bg-[#2563eb] text-white shadow-2xs"
                        : "text-[#1e3653] hover:text-[#2563eb]"
                    }`}
                  >
                    Visual Cascade &amp; KPI Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFrameworkSubView("strategy_doc");
                      setGlobalFocusArea("all");
                    }}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      frameworkSubView === "strategy_doc"
                        ? "bg-[#2563eb] text-white shadow-2xs"
                        : "text-[#1e3653] hover:text-[#2563eb]"
                    }`}
                  >
                    Our Theory of Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFrameworkSubView("blocks");
                      setGlobalFocusArea("all");
                    }}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      frameworkSubView === "blocks"
                        ? "bg-[#2563eb] text-white shadow-2xs"
                        : "text-[#1e3653] hover:text-[#2563eb]"
                    }`}
                  >
                    Unity 30 Blocks &amp; Big Push Pillars
                  </button>
                </div>

                {selectedSection === null && (
                  <p className="text-xs italic text-[#1d4ed8] font-medium max-w-2xl leading-relaxed">
                    {frameworkSubView === "cascade" ? (
                      <>
                        Click any active tier in the cascade below—including{" "}
                        <strong className="font-bold text-[#1e40af]">Save Lives</strong> for the apex
                        mortality and incidence indicators—to open its trajectory cards and milestone
                        diagnostics.
                      </>
                    ) : frameworkSubView === "strategy_doc" ? (
                      <>
                        Click any active tier in the strategic architecture below to inspect the monitored KPIs
                        and milestone progress for that level of the Theory of Change.
                      </>
                    ) : (
                      <>
                        Select any Unity 30 building block or switch to the 6 Big Push Pillars below to
                        inspect mapped indicators and milestone rationale.
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {frameworkSubView === "blocks" && selectedSection === null ? (
              <StrategicHierarchyView
                kpis={kpis}
                bigPushPillars={bigPushPillars}
                onSelectKpi={(kpi) => setClassificationModalKpi(kpi)}
                selectedKpiId={null}
              />
            ) : frameworkSubView === "strategy_doc" && selectedSection === null ? (
              /* COMPLETE RBM STRATEGY ARCHITECTURE MAP (Matches the Official Strategy Document Diagram) */
              <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-10 shadow-xs space-y-6">
                <div className="text-center max-w-3xl mx-auto">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#2563eb]">
                    RBM Partnership Theory of Change &amp; Strategic Architecture
                  </div>
                  <h3 className="text-xl md:text-2xl font-display font-bold text-[#111827] mt-1">
                    How Unity 30 &amp; the Big Push Connect Actions to Saving Lives
                  </h3>
                </div>

                <div className="max-w-5xl mx-auto space-y-5">
                  {/* Narrative Connector 1 */}
                  <div className="text-center">
                    <span className="text-xs sm:text-sm font-medium text-[#1e3653] underline underline-offset-4 decoration-gray-400">
                      RBM Partners will:
                    </span>
                  </div>

                  {/* Tier 1: Save lives (Yellow Banner) */}
                  <div
                    onClick={() => openTierDrilldown("save_lives")}
                    className="w-full rounded-xl bg-[#FFD100] hover:bg-[#f5c700] text-[#111827] py-4 px-6 text-center shadow-xs cursor-pointer transition-all group"
                  >
                    <div className="text-lg sm:text-xl font-display font-bold tracking-tight">
                      Save lives
                    </div>
                    <div className="text-xs font-sans italic text-[#1d4ed8] font-semibold mt-0.5 group-hover:underline">
                      {blockStats.save_lives.count} Apex Indicators (Mortality &amp; Morbidity
                      Reduction) — Click to open trajectory cards →
                    </div>
                  </div>

                  {/* Narrative Connector 2 */}
                  <div className="text-center pt-1">
                    <span className="text-xs sm:text-sm font-medium text-[#1e3653] underline underline-offset-4 decoration-gray-400">
                      This will be achieved by maintaining momentum towards a:
                    </span>
                  </div>

                  {/* Tier 2: Malaria eradication-ready ecosystem (Blue-to-Green Gradient Container) */}
                  <div
                    onClick={() => openTierDrilldown("ecosystem_all")}
                    className="w-full rounded-2xl p-5 sm:p-6 shadow-xs cursor-pointer transition-all hover:shadow-md group"
                    style={{
                      background:
                        "linear-gradient(95deg, #0072CE 0%, #009BDF 45%, #2CC84D 100%)",
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-white mb-4">
                      <h4 className="text-base sm:text-lg font-display font-bold tracking-tight text-center sm:text-left w-full">
                        Malaria eradication-ready ecosystem
                      </h4>
                      <span className="text-[11px] font-sans italic font-semibold bg-white/20 group-hover:bg-white/30 px-2.5 py-0.5 rounded text-white shrink-0 self-center">
                        Click to open {blockStats.ecosystem.count + blockStats.architecture.count}{" "}
                        Ecosystem &amp; Broader Goal KPIs →
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        "Gains are safeguarded",
                        "Malaria as a part of primary healthcare systems",
                        "Fully engaged and resourced malaria community",
                        "Countries trend towards eradication",
                      ].map((item) => (
                        <div
                          key={item}
                          className="bg-white rounded-xl p-3.5 text-xs sm:text-sm font-semibold text-[#111827] shadow-2xs flex items-center hover:bg-blue-50/40 transition-colors"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Narrative Connector 3 */}
                  <div className="text-center pt-1">
                    <span className="text-xs sm:text-sm font-medium text-[#1e3653] underline underline-offset-4 decoration-gray-400">
                      In order to do this, we need to focus on two primary outcomes:
                    </span>
                  </div>

                  {/* Tier 3: Two Primary Outcomes (We coordinate malaria response + We power the Big Push against Malaria) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Left: We coordinate malaria response */}
                    <div
                      onClick={() => openTierDrilldown("partnership")}
                      className="rounded-2xl bg-[#f1f3f5] border border-gray-200/90 p-5 flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-xs transition-all group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <h4 className="text-sm sm:text-base font-display font-bold text-[#111827]">
                            We coordinate malaria response
                          </h4>
                          <span className="text-[11px] font-sans italic font-semibold text-[#1d4ed8] group-hover:underline">
                            Click to open Partnership KPIs →
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {[
                            "Countries lead with confidence",
                            "Financing is predictable and diversified",
                            "The ecosystem is primed for change",
                          ].map((text) => (
                            <div
                              key={text}
                              className="bg-white rounded-xl p-3 text-xs text-gray-800 font-medium border border-gray-200/60"
                            >
                              {text}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                          {[
                            "The Partnership adds visible value",
                            "RBM is recognized as a convener aligning Partner action",
                          ].map((text) => (
                            <div
                              key={text}
                              className="bg-white rounded-xl p-3 text-xs text-gray-800 font-medium border border-gray-200/60"
                            >
                              {text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: We power the Big Push against Malaria (To be reported in 2027 - not clickable) */}
                    <div className="rounded-2xl bg-[#f1f3f5] border border-gray-200/90 p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <h4 className="text-sm sm:text-base font-display font-bold text-[#111827]">
                            We power the Big Push against Malaria
                          </h4>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-orange-50 text-[#E55535] border border-orange-200 shrink-0">
                            To be reported in 2027
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {[
                            "An integrated malaria response",
                            "A more resilient supply chain and care delivery network",
                            "A more resilient, country driven malaria response",
                            "Enable data-informed, conscious decision making",
                            "Products are developed and reach markets faster with greater efficacy",
                            "Greater resources to take on malaria challenges",
                          ].map((text) => (
                            <div
                              key={text}
                              className="bg-white rounded-xl p-3 text-xs text-gray-800 font-medium border border-gray-200/60"
                            >
                              {text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Narrative Connector 4 */}
                  <div className="text-center pt-1">
                    <span className="text-xs sm:text-sm font-medium text-[#1e3653] underline underline-offset-4 decoration-gray-400">
                      Our success relies on the following Unity 30 actions guiding our 5 years strategy that power the Big Push:
                    </span>
                  </div>

                  {/* Tier 4: Unity 30 Building Blocks (5 Action Cards with Full Document Descriptions) */}
                  <div className="rounded-2xl bg-[#f1f3f5] border border-gray-200/90 p-5 sm:p-6">
                    <div
                      onClick={() => openTierDrilldown("unity")}
                      className="text-center mb-4 cursor-pointer group"
                    >
                      <h4 className="text-base sm:text-lg font-display font-bold text-[#111827] group-hover:text-[#2563eb] transition-colors">
                        Unity 30 Building Blocks
                      </h4>
                      <span className="text-xs italic text-[#1d4ed8] font-semibold group-hover:underline">
                        Click any block below to open its indicator cards, or click here to view all Unity 30 KPIs →
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {[
                        {
                          id: "unity_engage",
                          title: "Engage",
                          borderColor: "border-[#1F429B]",
                          textColor: "text-[#1F429B]",
                          desc: "We convene the ecosystem to align and solve problems with more integrated, digital, and purposeful collaboration.",
                        },
                        {
                          id: "unity_align",
                          title: "Align",
                          borderColor: "border-[#00A3E0]",
                          textColor: "text-[#0077b6]",
                          desc: "We provide timely intelligence — country profiles and innovation matching — focused on immediate needs and next steps.",
                        },
                        {
                          id: "unity_enable",
                          title: "Enable",
                          borderColor: "border-[#38bdf8]",
                          textColor: "text-[#0284c7]",
                          desc: "We steady progress by supporting financing and capacity, smoothing peaks and valleys so countries keep moving forward.",
                        },
                        {
                          id: "unity_act",
                          title: "Act",
                          borderColor: "border-[#93d573]",
                          textColor: "text-[#15803d]",
                          desc: "We deliver targeted country support and advocacy, turning momentum into measurable results.",
                        },
                        {
                          id: "unity_impact",
                          title: "Impact",
                          borderColor: "border-[#22c55e]",
                          textColor: "text-[#15803d]",
                          desc: "We track and learn, feeding results back into the cycle to strengthen action and accountability.",
                        },
                      ].map((b) => {
                        const stats = blockStats[b.id];
                        return (
                          <div
                            key={b.id}
                            onClick={() => openTierDrilldown(b.id)}
                            className={`bg-white rounded-xl p-4 border-2 ${b.borderColor} flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <h5 className="text-sm font-display font-bold text-[#111827]">
                                  {b.title}
                                </h5>
                                <span
                                  className={`text-[10px] font-mono font-bold ${b.textColor}`}
                                >
                                  {stats?.count || 0} KPIs
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 mt-2 leading-relaxed">
                                {b.desc}
                              </p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] font-sans italic text-[#1d4ed8] font-semibold group-hover:underline">
                              Click to open {b.title} KPIs →
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Narrative Connector 5 */}
                  <div className="text-center pt-1">
                    <span className="text-xs sm:text-sm font-medium text-[#1e3653] underline underline-offset-4 decoration-gray-400">
                      Which will be refined annually in our work plans which will include:
                    </span>
                  </div>

                  {/* Tier 5: 5 Annual Workplan Streams (Convening, Intelligence, Resourcing, Implementation, Measuring) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-2">
                    {[
                      {
                        stream: "Convening",
                        focusId: "unity_engage",
                        items: ["Board", "Partner Committees", "Working Groups"],
                      },
                      {
                        stream: "Intelligence",
                        focusId: "unity_align",
                        items: ["Data", "Partner matching", "Innovation", "Foresight"],
                      },
                      {
                        stream: "Resourcing",
                        focusId: "unity_enable",
                        items: ["Sustainable finance", "Human capital capacity building"],
                      },
                      {
                        stream: "Implementation",
                        focusId: "unity_act",
                        items: ["Country support", "Advocacy", "Health Security"],
                      },
                      {
                        stream: "Measuring",
                        focusId: "unity_impact",
                        items: ["M&E", "Big Push against Malaria KPIs"],
                      },
                    ].map((col) => (
                      <div
                        key={col.stream}
                        onClick={() => openTierDrilldown(col.focusId)}
                        className="bg-[#f8fafc] hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 rounded-xl p-3.5 cursor-pointer transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-xs font-display font-bold text-[#111827] underline underline-offset-4 decoration-slate-400 mb-2">
                            {col.stream}
                          </div>
                          <ul className="space-y-1 text-xs text-gray-700 list-disc list-inside">
                            {col.items.map((it) => (
                              <li key={it} className="leading-snug">
                                {it}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-slate-200/70 text-[10px] font-sans italic text-[#1d4ed8] font-semibold group-hover:underline">
                          Click to open KPIs →
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Narrative Connector 6 */}
                  <div className="text-center pt-1">
                    <span className="text-xs sm:text-sm font-medium text-[#1e3653] underline underline-offset-4 decoration-gray-400">
                      Across all four years, we will prioritize:
                    </span>
                  </div>

                  {/* Tier 6: Three Cross-Cutting Priorities Across All Four Years */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        title: "Increasing RBM's proactive convener and advocate role",
                        focusId: "partnership",
                        body: "Focusing on what RBM's value proposition is for different stakeholders will help us be more proactive. By building on the success of Partnership convenings, we can improve how we work.",
                      },
                      {
                        title: "Leveraging data and knowledge assets more extensively.",
                        focusId: "unity_align",
                        body: "RBM has a unique opportunity to better use data and knowledge to create actionable intelligence through our data platform.",
                      },
                      {
                        title: "Focusing on cross-cutting issues more generally, but with limits.",
                        focusId: "architecture",
                        body: "Create a new framework that builds on the work of PCs/WGs, improves knowledge sharing, and ties to the Big Push against Malaria.",
                      },
                    ].map((p) => (
                      <div
                        key={p.title}
                        onClick={() => openTierDrilldown(p.focusId)}
                        className="rounded-xl bg-[#f1f3f5] hover:bg-blue-50/40 border border-gray-200 hover:border-blue-300 p-4 space-y-2 cursor-pointer transition-all group flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <h5 className="text-xs sm:text-sm font-display font-bold text-[#111827] leading-snug">
                            {p.title}
                          </h5>
                          <p className="text-xs text-gray-700 leading-relaxed">{p.body}</p>
                        </div>
                        <div className="pt-1.5 border-t border-gray-200/80 text-[10px] font-sans italic text-[#1d4ed8] font-semibold group-hover:underline">
                          Click to open related KPIs →
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedSection === null ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-8 shadow-md">

                <div className="text-center max-w-2xl mx-auto mb-6">
                  <h2 className="text-xl font-display font-black tracking-tight text-[#1e3653] uppercase">
                    RBM Strategic Cascade of Indicators
                  </h2>
                </div>

                <div className="w-full max-w-6xl mx-auto space-y-4 select-none relative p-6 md:p-8 bg-slate-50/40 border border-slate-200 rounded-2xl overflow-visible">
                  <div className="text-center -mt-2 mb-1">
                    <span className="text-[11px] font-sans font-semibold text-[#1e3653] underline underline-offset-4 decoration-slate-300">
                      RBM Partners will:
                    </span>
                  </div>
                  {/* ROW 1: Save Lives (Ultimate Outcome — Click to open Apex KPI Cards) */}
                  <div className="w-full flex flex-col items-center">
                    <div
                      onClick={() => openTierDrilldown("save_lives")}
                      className="group w-full max-w-3xl py-5 px-6 rounded-xl text-center cursor-pointer transition-all duration-200 border border-amber-300 border-t-4 border-t-[#f59e0b] relative overflow-visible flex flex-col items-center justify-center bg-amber-50/70 hover:bg-amber-50 hover:shadow-md"
                      title="Click to open the Mortality & Incidence Apex Trajectory Cards"
                    >
                      <span className="text-[10px] font-mono font-bold tracking-widest text-[#b45309] uppercase">
                        Ultimate Strategic Outcome · {blockStats.save_lives.count} Apex KPIs
                      </span>
                      <h3 className="text-base md:text-lg font-display font-bold tracking-tight text-[#111827] mt-1">
                        Save Lives: Mortality &amp; Morbidity Reduction
                      </h3>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-xs text-slate-700 font-mono">
                        <span>
                          Reported vs {mortalityKpi?.baselineYear || 2015}:{" "}
                          <strong className="text-[#111827]">
                            {typeof mortalityKpi?.value === "number"
                              ? `${Math.abs(mortalityKpi.value)}% ${
                                  mortalityKpi.value >= 0 ? "lower" : "higher"
                                } mortality`
                              : "Pending mortality"}{" "}
                            ·{" "}
                            {typeof morbidityKpi?.value === "number"
                              ? `${Math.abs(morbidityKpi.value)}% ${
                                  morbidityKpi.value >= 0 ? "lower" : "higher"
                                } incidence`
                              : "Pending incidence"}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#1d4ed8] font-sans italic font-semibold group-hover:underline">
                          Click to open Apex Trajectory Cards →
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CONNECTOR 1 to 2 */}
                  <div className="w-full flex flex-col items-center pointer-events-none relative -my-1">
                    <span className="text-[11px] font-sans font-medium text-[#1e3653] bg-slate-50/90 px-2 py-0.5 rounded z-10">
                      This will be achieved by maintaining momentum towards a malaria eradication-ready ecosystem:
                    </span>
                    <svg
                      viewBox="0 0 800 30"
                      className="w-full h-6 text-slate-300 fill-none"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M 200 30 C 200 15, 400 15, 400 5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <path
                        d="M 600 30 C 600 15, 400 15, 400 5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <path d="M 400 5 L 400 0" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M 396 6 L 400 0 L 404 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* ROW 2: Ecosystem & Member Partners & Broader Health Goals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mx-auto">
                    <div
                      onClick={() => openTierDrilldown("ecosystem")}
                      className="group p-5 rounded-2xl text-center cursor-pointer transition-all duration-300 border-2 border-t-8 bg-white hover:bg-lime-50/20 border-lime-200 border-t-lime-500 hover:border-lime-400 hover:shadow-xs flex flex-col justify-between"
                      title={`Ecosystem and Member Partners (${blockStats.ecosystem.count} KPIs)`}
                    >
                      <div>
                        <span className="text-[9px] font-mono font-black tracking-wider text-lime-700 uppercase">
                          Ecosystem Resilience
                        </span>
                        <h4 className="text-sm font-display font-black text-slate-900 tracking-tight mt-0.5 uppercase">
                          Ecosystem &amp; Member Partners
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                          {sheetTerms["Ecosystem KPIs"] ||
                            "Measure systemic resilience of the entire malaria ecosystem toward the goal of ending malaria."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-bold text-slate-600 font-mono pt-2 border-t border-slate-100">
                        <span>{blockStats.ecosystem.count} Indicators</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>
                          Avg Progress:{" "}
                          <strong className="text-lime-700">
                            {blockStats.ecosystem.score !== null
                              ? `${blockStats.ecosystem.score}%`
                              : "Tracked"}
                          </strong>
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-[#1d4ed8] font-sans italic font-semibold group-hover:underline">
                          Click to open KPIs →
                        </span>
                      </div>
                    </div>

                    <div
                      onClick={() => openTierDrilldown("architecture")}
                      className="group p-5 rounded-2xl text-center cursor-pointer transition-all duration-300 border-2 border-t-8 bg-white hover:bg-emerald-50/20 border-emerald-200 border-t-emerald-500 hover:border-emerald-400 hover:shadow-xs flex flex-col justify-between"
                      title={`Broader Malaria Health Goals (${blockStats.architecture.count} KPIs)`}
                    >
                      <div>
                        <span className="text-[9px] font-mono font-black tracking-wider text-emerald-700 uppercase">
                          Global Health Integration
                        </span>
                        <h4 className="text-sm font-display font-black text-slate-900 tracking-tight mt-0.5 uppercase">
                          Broader Malaria Health Goals
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                          {sheetTerms["Broader Health Goals"] ||
                            "Measure progress toward integrating malaria with health goals for climate change and refugee/IDP populations."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-bold text-slate-600 font-mono pt-2 border-t border-slate-100">
                        <span>{blockStats.architecture.count} Indicators</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>
                          Avg Progress:{" "}
                          <strong className="text-emerald-700">
                            {blockStats.architecture.score !== null
                              ? `${blockStats.architecture.score}%`
                              : "Tracked"}
                          </strong>
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-[#1d4ed8] font-sans italic font-semibold group-hover:underline">
                          Click to open KPIs →
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CONNECTOR 2 to 3 */}
                  <div className="w-full flex flex-col items-center pointer-events-none relative -my-1">
                    <span className="text-[11px] font-sans font-medium text-[#1e3653] bg-slate-50/90 px-2 py-0.5 rounded z-10">
                      In order to do this, we coordinate the malaria response and power the Big Push against Malaria:
                    </span>
                    <svg
                      viewBox="0 0 800 30"
                      className="w-full h-6 text-slate-300 fill-none"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M 400 30 C 400 15, 200 15, 200 5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M 400 30 C 400 15, 600 15, 600 5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M 196 6 L 200 0 L 204 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 596 6 L 600 0 L 604 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* ROW 3: Big Push against Malaria KPIs (To be reported in 2027 — non-clickable) */}
                  <div className="w-full flex justify-center">
                    <div className="w-full max-w-3xl p-5 rounded-xl text-center select-none border border-orange-200 border-t-4 border-t-[#E55535] bg-white">
                      <div className="text-[10px] font-mono font-bold tracking-wider text-[#E55535] uppercase">
                        Strategic Acceleration Pillars · {bigPushPillars.length || 6} Pillars
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
                        <h4 className="text-base font-display font-bold text-slate-900 tracking-tight">
                          Big Push against Malaria KPIs
                        </h4>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-orange-50 text-[#E55535] border border-orange-200">
                          To be reported in 2027
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                        {sheetTerms["Big Push against Malaria KPIs"] ||
                          "Measure acceleration outcomes of the Big Push against malaria toward its mission"}
                      </p>
                    </div>
                  </div>

                  {/* CONNECTOR 3 to 4 */}
                  <div className="w-full flex flex-col items-center pointer-events-none relative -my-1">
                    <span className="text-[11px] font-sans font-medium text-[#1e3653] bg-slate-50/90 px-2 py-0.5 rounded z-10 text-center">
                      Our success relies on the following Unity 30 actions guiding our 5 years strategy that power the Big Push:
                    </span>
                    <svg
                      viewBox="0 0 800 30"
                      className="w-full h-6 text-slate-300 fill-none"
                      preserveAspectRatio="none"
                    >
                      <path d="M 400 30 L 400 4" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M 396 6 L 400 0 L 404 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* ROW 4: Unity 30 Building Blocks Container */}
                  <div className="w-full max-w-5xl mx-auto bg-slate-100/60 border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-inner relative pt-8 z-30 hover:z-50 overflow-visible">
                    <div
                      onClick={() => openTierDrilldown("unity")}
                      className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-900 border border-slate-300 text-slate-700 text-[9px] font-black px-4.5 py-0.5 rounded-full uppercase tracking-widest font-mono shadow-xs whitespace-nowrap cursor-pointer transition-colors"
                      title="Click to view all Unity 30 indicators"
                    >
                      Unity 30 Building Blocks
                    </div>
                    <p className="text-[11px] text-slate-500 text-center mb-3 max-w-xl mx-auto leading-relaxed">
                      {sheetTerms["2026 Unity KPIs WP"] ||
                        "Engage, Align, Enable, Act, Impact. Define our way of working together and structure the activities measured by KPIs"}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                      {[
                        {
                          id: "unity_engage",
                          name: "01. Engage",
                          stream: "Convening: Board, PCs, WGs",
                          color: "bg-[#1F429B] hover:bg-[#1A3884] text-white border-blue-900",
                          statsId: "unity_engage",
                          tooltipText:
                            "We convene the ecosystem to align and solve problems with more integrated, digital, and purposeful collaboration. (Pillar 1 & Pillar 2)",
                          tooltipImpact: "Informs Big Push priorities",
                        },
                        {
                          id: "unity_align",
                          name: "02. Align",
                          stream: "Intelligence: Data, Matching, Foresight",
                          color: "bg-[#1E62D0] hover:bg-[#1850AA] text-white border-blue-700",
                          statsId: "unity_align",
                          tooltipText:
                            "We provide timely intelligence — country profiles and innovation matching — focused on immediate needs and next steps. (Pillars 3 & 5)",
                          tooltipImpact: "Sharpens Big Push solutions",
                        },
                        {
                          id: "unity_enable",
                          name: "03. Enable",
                          stream: "Resourcing: Finance & Capacity",
                          color: "bg-[#00A3E0] hover:bg-[#008BBF] text-white border-cyan-600",
                          statsId: "unity_enable",
                          tooltipText:
                            "We steady progress by supporting financing and capacity, smoothing peaks and valleys so countries keep moving forward. (Pillars 5 & 6)",
                          tooltipImpact: "Fuels Big Push action",
                        },
                        {
                          id: "unity_act",
                          name: "04. Act",
                          stream: "Implementation: Country Support & Advocacy",
                          color: "bg-[#D2E24E] hover:bg-[#C2D23E] text-slate-900 border-lime-400",
                          statsId: "unity_act",
                          tooltipText:
                            "We deliver targeted country support and advocacy, turning momentum into measurable results. (Pillars 3 & 4)",
                          tooltipImpact: "Implements the Big Push globally and locally",
                        },
                        {
                          id: "unity_impact",
                          name: "05. Impact",
                          stream: "Measuring: M&E & Big Push KPIs",
                          color: "bg-[#43B02A] hover:bg-[#389422] text-white border-emerald-700",
                          statsId: "unity_impact",
                          tooltipText:
                            "We track and learn, feeding results back into the cycle to strengthen action and accountability.",
                          tooltipImpact: "Strengthens and reorients the Big Push",
                        },
                      ].map((b) => {
                        const stats = blockStats[b.statsId];

                        return (
                          <RBMTooltip
                            key={b.id}
                            title={`${b.name} — Unity 30 Block`}
                            badgeText={`${stats.count} KPIs`}
                            accent="blue"
                            widthClass="w-68"
                            className="block w-full"
                            content={
                              <div className="space-y-2">
                                <p className="text-blue-50/95 leading-relaxed text-[10.5px] font-sans font-normal">
                                  {b.tooltipText}
                                </p>
                                <div className="text-[9.5px] font-mono text-blue-200">
                                  Workplan Stream: {b.stream}
                                </div>
                                <div className="text-[9.5px] pt-1.5 border-t border-white/15 font-mono text-[#86efac] font-bold flex items-center gap-1.5 leading-tight">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                                  <span>{b.tooltipImpact}</span>
                                </div>
                              </div>
                            }
                          >
                            <div
                              onClick={() => openTierDrilldown(b.id)}
                              className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-xs text-center w-full h-full ${b.color}`}
                            >
                              <h5 className="text-xs font-black font-display tracking-tight uppercase">
                                {b.name}
                              </h5>
                              <div className="text-[10px] font-mono mt-0.5 opacity-90 font-bold flex flex-col items-center leading-none">
                                <span>{stats.count} KPIs</span>
                                <span className="underline mt-0.5">
                                  {stats.score !== null ? `${stats.score}% Met` : "—"}
                                </span>
                              </div>

                              <div className="mt-2 pt-1.5 border-t border-black/10 w-full">
                                <span className="inline-block text-[8.5px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-black/20 text-white tracking-tight leading-tight">
                                  {b.tooltipImpact}
                                </span>
                              </div>
                            </div>
                          </RBMTooltip>
                        );
                      })}
                    </div>
                  </div>

                  {/* CONNECTOR 4 to 5 */}
                  <div className="w-full h-8 flex justify-center items-center pointer-events-none relative -my-1">
                    <svg
                      viewBox="0 0 800 30"
                      className="w-full h-8 text-slate-300 fill-none"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M 200 0 C 200 15, 400 15, 400 25"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M 600 0 C 600 15, 400 15, 400 25"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path d="M 400 25 L 400 30" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M 196 6 L 200 0 L 204 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 596 6 L 600 0 L 604 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* ROW 5: Unity 30 Container wrapping Secretariat & Partnership */}
                  <div className="w-full max-w-5xl mx-auto bg-slate-100/60 border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-inner relative pt-8">
                    <div
                      onClick={() => openTierDrilldown("unity")}
                      className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-900 border border-slate-300 text-slate-700 text-[9px] font-black px-4.5 py-0.5 rounded-full uppercase tracking-widest font-mono shadow-xs whitespace-nowrap cursor-pointer transition-colors"
                      title="Click to view all Unity 30 indicators"
                    >
                      Unity 30 KPIs
                    </div>
                    <p className="text-[11px] text-slate-500 text-center mb-4 max-w-xl mx-auto leading-relaxed">
                      {sheetTerms["Unity KPIs"] ||
                        "Measure progress of the RBM Partnership and Secretariat toward its mission exclusively"}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div
                        onClick={() => openTierDrilldown("secretariat")}
                        className="group p-5 rounded-xl text-center cursor-pointer transition-all duration-300 border bg-white hover:bg-slate-50 border-blue-200 border-t-4 border-t-blue-500 hover:border-blue-400 hover:shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <h4 className="text-sm font-display font-black text-slate-800 tracking-tight uppercase">
                            Secretariat KPIs
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                            Internal Secretariat output metrics &amp; regional support execution
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-bold text-slate-600 font-mono pt-2 border-t border-slate-100">
                          <span>{blockStats.secretariat.count} Indicators</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span>
                            Avg Progress:{" "}
                            <strong className="text-blue-600">
                              {blockStats.secretariat.score !== null
                                ? `${blockStats.secretariat.score}%`
                                : "—"}
                            </strong>
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[#1d4ed8] font-sans italic font-semibold group-hover:underline">
                            Click to open KPIs →
                          </span>
                        </div>
                      </div>

                      <div
                        onClick={() => openTierDrilldown("partnership")}
                        className="group p-5 rounded-xl text-center cursor-pointer transition-all duration-300 border bg-white hover:bg-slate-50 border-indigo-200 border-t-4 border-t-indigo-500 hover:border-indigo-400 hover:shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <h4 className="text-sm font-display font-black text-slate-800 tracking-tight uppercase">
                            Partnership KPIs
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                            WG/Partner alignment, collaboration index &amp; joint advocacy
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-bold text-slate-600 font-mono pt-2 border-t border-slate-100">
                          <span>{blockStats.partnership.count} Indicators</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span>
                            Avg Progress:{" "}
                            <strong className="text-indigo-600">
                              {blockStats.partnership.score !== null
                                ? `${blockStats.partnership.score}%`
                                : "—"}
                            </strong>
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[#1d4ed8] font-sans italic font-semibold group-hover:underline">
                            Click to open KPIs →
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ROW 6: Cross-Cutting Four-Year Priorities from Strategy Document */}
                  <div className="w-full max-w-5xl mx-auto pt-3">
                    <div className="text-center mb-3">
                      <span className="text-[11px] font-sans font-semibold text-[#1e3653] underline underline-offset-4 decoration-slate-300">
                        Across all four years, we will prioritize:
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div
                        onClick={() => openTierDrilldown("partnership")}
                        className="rounded-xl bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-300 p-4 text-left shadow-2xs cursor-pointer transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <h5 className="text-xs font-display font-bold text-slate-900">
                            Increasing RBM&apos;s proactive convener and advocate role
                          </h5>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Focusing on what RBM&apos;s value proposition is for different stakeholders
                            will help us be more proactive. By building on the success of Partnership
                            convenings, we can improve how we work.
                          </p>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-slate-100 text-[10px] font-sans italic text-[#1d4ed8] font-semibold group-hover:underline">
                          Click to open related KPIs →
                        </div>
                      </div>
                      <div
                        onClick={() => openTierDrilldown("unity_align")}
                        className="rounded-xl bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-300 p-4 text-left shadow-2xs cursor-pointer transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <h5 className="text-xs font-display font-bold text-slate-900">
                            Leveraging data and knowledge assets more extensively
                          </h5>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            RBM has a unique opportunity to better use data and knowledge to create
                            actionable intelligence through our data platform.
                          </p>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-slate-100 text-[10px] font-sans italic text-[#1d4ed8] font-semibold group-hover:underline">
                          Click to open related KPIs →
                        </div>
                      </div>
                      <div
                        onClick={() => openTierDrilldown("architecture")}
                        className="rounded-xl bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-300 p-4 text-left shadow-2xs cursor-pointer transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <h5 className="text-xs font-display font-bold text-slate-900">
                            Focusing on cross-cutting issues more generally, but with limits
                          </h5>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Create a new framework that builds on the work of PCs/WGs, improves
                            knowledge sharing, and ties to the Big Push against Malaria.
                          </p>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-slate-100 text-[10px] font-sans italic text-[#1d4ed8] font-semibold group-hover:underline">
                          Click to open related KPIs →
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Section Drilldown View */
              (() => {
                const sec = [
                  {
                    id: "save_lives",
                    name: "Save Lives Outcomes",
                    desc: "Tracks mortality reductions and incidence drops toward 2030 targets.",
                  },
                  {
                    id: "ecosystem",
                    name: "Ecosystem & Member Partners",
                    desc:
                      sheetTerms["Ecosystem KPIs"] ||
                      "Systemic resilience, local manufacturing, diagnostics & vaccines.",
                  },
                  {
                    id: "ecosystem_all",
                    name: "Malaria Eradication-Ready Ecosystem & Broader Health Goals",
                    desc: "Combined Ecosystem resilience and Broader Malaria Health Goals (climate change & refugee/IDP inclusion).",
                  },
                  {
                    id: "architecture",
                    name: "Broader Malaria Health Goals",
                    desc:
                      sheetTerms["Broader Health Goals"] ||
                      "Integration into NDCs (climate/vector) and refugee & IDP population inclusion in NSPs.",
                  },
                  {
                    id: "big_push",
                    name: "Big Push against Malaria KPIs & Active Linked Indicators",
                    desc:
                      sheetTerms["Big Push against Malaria KPIs"] ||
                      "Measure acceleration outcomes of the Big Push against malaria toward its mission, alongside active Unity 30 and Ecosystem indicators that directly power the 6 Big Push Pillars.",
                  },
                  {
                    id: "unity",
                    name: "Unity 30 KPIs",
                    desc:
                      sheetTerms["Unity KPIs"] ||
                      "Measure progress of the RBM Partnership and Secretariat toward its mission exclusively.",
                  },
                  {
                    id: "unity_engage",
                    name: "Unity 30: Engage",
                    desc: "Surfaces country challenges, mobilizes global and local leadership, and aligns convening bodies.",
                  },
                  {
                    id: "unity_align",
                    name: "Unity 30: Align",
                    desc: "Generates actionable country-level intelligence and aligns multi-donor funding schemas.",
                  },
                  {
                    id: "unity_enable",
                    name: "Unity 30: Enable",
                    desc: "Unlocks sovereign finance commitments and scales local capacity via joint teams.",
                  },
                  {
                    id: "unity_act",
                    name: "Unity 30: Act",
                    desc: "Executes coordinated advocacy campaigns and direct, targeted country assistance.",
                  },
                  {
                    id: "unity_impact",
                    name: "Unity 30: Impact",
                    desc: "Tracks overall RBM partnership satisfaction and strengthening of national leadership.",
                  },
                  {
                    id: "secretariat",
                    name: "Secretariat KPIs",
                    desc: "Internal Secretariat output metrics and regional support execution.",
                  },
                  {
                    id: "partnership",
                    name: "Partnership KPIs",
                    desc: "WG/Partner alignment, collaboration index & joint advocacy.",
                  },
                ].find((s) => s.id === selectedSection) || {
                  id: "unknown",
                  name: "RBM KPIs",
                  desc: "Indicators for the selected section.",
                };

                const sectionKPIs = normalizeKPIList(
                  filterKPIsByFocusArea(kpis, selectedSection || "all")
                );

                return (
                  <div ref={sectionDrilldownRef} className="space-y-6 scroll-mt-6">
                    {/* Streamlined Section Drilldown Header Bar */}
                    <div className="bg-white border border-gray-200 border-t-4 border-t-[#3365e3] rounded-lg p-5 sm:p-6 shadow-xs">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                        <div>
                          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-slate-500 mb-1">
                            <button
                              type="button"
                              onClick={() => setGlobalFocusArea("all")}
                              className="text-[#2563eb] hover:underline font-bold cursor-pointer flex items-center gap-1"
                            >
                              <span>← Back to Strategic Cascade</span>
                            </button>
                            <span aria-hidden="true">·</span>
                            <span className="uppercase tracking-wider">Tier Drilldown</span>
                          </div>
                          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#111827]">
                            {sec.name}
                          </h2>
                          <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">
                            {sec.desc}
                          </p>
                        </div>

                        {/* Compact Section Status Strip */}
                        <div className="flex items-center gap-4 bg-[#F2F8FF] border border-blue-200/80 px-4 py-2.5 rounded-lg shrink-0 self-start lg:self-center font-mono">
                          <div className="text-center pr-3 border-r border-blue-200">
                            <div className="text-lg font-bold text-[#1e3653] leading-none">
                              {sectionKPIs.length}
                            </div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold mt-1 block">
                              Total KPIs
                            </span>
                          </div>
                          <div className="text-center pr-3 border-r border-blue-200">
                            <div className="text-lg font-bold text-[#16a34a] leading-none">
                              {sectionKPIs.filter((k) => k.status === "green").length}
                            </div>
                            <span className="text-[10px] text-[#15803d] uppercase font-bold mt-1 block">
                              On Track
                            </span>
                          </div>
                          <div className="text-center pr-3 border-r border-blue-200">
                            <div className="text-lg font-bold text-[#f59e0b] leading-none">
                              {sectionKPIs.filter((k) => k.status === "amber").length}
                            </div>
                            <span className="text-[10px] text-[#b45309] uppercase font-bold mt-1 block">
                              At Risk
                            </span>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-[#dc2626] leading-none">
                              {sectionKPIs.filter((k) => k.status === "red").length}
                            </div>
                            <span className="text-[10px] text-[#b91c1c] uppercase font-bold mt-1 block">
                              Off Track
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section Indicator Trajectory Cards Grid (Immediately visible above the fold) */}
                      <div className="mt-5">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                          {sectionKPIs.map((kpi) => (
                            <ApexTrajectoryCard
                              key={kpi.id}
                              kpi={kpi}
                              type={
                                kpi.id === "kpi-19"
                                  ? "mortality"
                                  : kpi.id === "kpi-20"
                                  ? "incidence"
                                  : "general"
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        ) : activeMainTab === "briefing" ? (
          /* BOARD & DONOR BRIEFINGS VIEW (Aligned with dashboards.endmalaria.org/en) */
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Light RBM Header Panel */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#93d573] rounded-lg p-6 shadow-md">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded bg-[#F2F8FF] text-[#2563eb] border border-blue-200 font-mono text-[11px] font-bold uppercase tracking-wider">
                      Executive Synthesis Engine
                    </span>
                    <span className="text-gray-500 text-xs font-mono">
                      2026 Workplan &amp; 2030 Elimination Horizon
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-[#111827]">
                    Board &amp; Donor Strategic Briefings
                  </h2>
                  <p className="text-gray-600 text-xs sm:text-sm max-w-2xl leading-relaxed">
                    Generate comprehensive, evidence-based synthesis reports tailored for RBM
                    Partnership Board reviews, donor replenishment updates, and working group
                    oversight.
                  </p>
                </div>

                {/* Right: RBM Scope Selector & Action Controls */}
                <div className="flex flex-wrap items-center gap-3 bg-[#F2F8FF] border border-blue-200 p-3.5 rounded-lg shrink-0">
                  <select
                    value={globalFocusArea}
                    onChange={(e) => setGlobalFocusArea(e.target.value)}
                    aria-label="Filter briefing focus area"
                    className="bg-white border-2 border-gray-300 text-gray-800 rounded-md px-3 text-xs font-sans font-medium focus:outline-none focus:border-[#2563eb] cursor-pointer h-[36px]"
                  >
                    <option value="all">Scope: Full Partnership Portfolio</option>
                    <option value="save_lives">Scope: Save Lives Outcomes</option>
                    <option value="ecosystem">Scope: Ecosystem &amp; Member Partners</option>
                    <option value="architecture">Scope: Broader Malaria Health Goals</option>
                    <option value="unity">Scope: Unity 30 Country Support (U.1 - U.5)</option>
                    <option value="secretariat">Scope: Secretariat KPIs</option>
                    <option value="partnership">Scope: Partnership KPIs</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsModifyContextOpen(true)}
                    className="px-3.5 h-[36px] rounded-md bg-white hover:bg-gray-50 text-slate-700 border border-slate-300 font-sans text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Modify Context</span>
                    {briefingUploadedDocs.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-[#1d4ed8] font-mono text-[10px] font-bold">
                        {briefingUploadedDocs.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => generateDonorBriefing(globalFocusArea)}
                    disabled={donorBriefLoading}
                    className="px-4 h-[36px] rounded-md bg-[#2563eb] hover:bg-blue-700 text-white font-sans text-xs font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {donorBriefLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Compiling Briefing...</span>
                      </>
                    ) : (
                      <span>Generate Board Briefing</span>
                    )}
                  </button>

                  {donorBriefText && !donorBriefLoading && (
                    <button
                      onClick={() =>
                        downloadDonorBriefingPDF(
                          globalFocusArea === "all" ? "Full_Portfolio" : globalFocusArea
                        )
                      }
                      className="px-4 h-[36px] rounded-md bg-white border-2 border-green-500 text-green-600 hover:bg-gray-50 font-sans text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>Export Memo PDF</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Simple Modify Context Modal (Data Sources & Uploaded Documents) */}
            {isModifyContextOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
                onClick={() => setIsModifyContextOpen(false)}
              >
                <div
                  className="bg-white border border-gray-200 rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="text-base font-display font-bold text-[#111827]">
                        Data Sources &amp; Reference Documents Context
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure data source notes and reference documents for briefing synthesis.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsModifyContextOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Close Modify Context modal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 1. Data Sources Info & Context Notes */}
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                      <div className="font-semibold text-slate-900">Active Primary Data Source</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        RBM Partnership Google Sheet (<span className="font-mono">Unity 30 KPIs Final</span>) — automatically includes indicator values, Data Quality (Col U), Availability (Col V), and Reliability Comments (Col W).
                      </p>
                    </div>

                    <label
                      htmlFor="briefing-context-notes"
                      className="text-xs font-semibold text-slate-800 block pt-1"
                    >
                      Additional Data Source &amp; Ecosystem Context
                    </label>
                    <textarea
                      id="briefing-context-notes"
                      rows={4}
                      value={briefingContextNotes}
                      onChange={(e) => setBriefingContextNotes(e.target.value)}
                      placeholder="Add context on data source reliability or ecosystem events (e.g., 2025 USG funding cuts)..."
                      className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563eb] font-sans leading-relaxed"
                    />
                  </div>

                  {/* 2. Uploaded Reference Documents */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Uploaded Reference Documents ({briefingUploadedDocs.length})
                      </span>
                      <label className="px-3 py-1.5 rounded-md bg-[#F2F8FF] hover:bg-blue-100 text-[#1d4ed8] border border-blue-200 text-xs font-semibold cursor-pointer transition-colors">
                        + Upload Document
                        <input
                          type="file"
                          accept=".txt,.md,.csv,.json"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            const loaded: Array<{ name: string; content: string }> = [];
                            for (const file of Array.from(files)) {
                              const text = await file.text();
                              loaded.push({
                                name: file.name,
                                content: text.slice(0, 15000),
                              });
                            }
                            setBriefingUploadedDocs((prev) => [...prev, ...loaded]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {briefingUploadedDocs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        No reference documents uploaded. Upload .txt, .md, .csv, or .json files to include in the briefing context.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {briefingUploadedDocs.map((doc, idx) => (
                          <div
                            key={`${doc.name}-${idx}`}
                            className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs"
                          >
                            <span className="font-mono text-[11px] text-slate-700 truncate">
                              {doc.name}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setBriefingUploadedDocs((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-rose-600 hover:underline text-[11px] font-semibold ml-2 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIsModifyContextOpen(false)}
                      className="px-4 py-1.5 rounded-md bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Save &amp; Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {donorBriefError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-mono">
                {donorBriefError}
              </div>
            )}

            <div
              ref={donorReportRef}
              className="bg-white border border-gray-200 rounded-lg p-6 md:p-8 shadow-md"
            >
              {(() => {
                const scopedBriefingKPIs = heatmapKPIs;
                const scopedCounts = {
                  green: scopedBriefingKPIs.filter((k) => k.status === "green").length,
                  amber: scopedBriefingKPIs.filter((k) => k.status === "amber").length,
                  red: scopedBriefingKPIs.filter((k) => k.status === "red").length,
                  pending: scopedBriefingKPIs.filter((k) => k.status === "pending").length,
                };
                const statusFilteredKPIs = briefingStatusFilter
                  ? scopedBriefingKPIs.filter((k) => k.status === briefingStatusFilter)
                  : [];

                const statusMeta: Record<
                  RAGStatus,
                  { label: string; headerBg: string; border: string; badgeBg: string }
                > = {
                  green: {
                    label: "On Track",
                    headerBg: "bg-emerald-50/70",
                    border: "border-emerald-200",
                    badgeBg: "bg-[#16a34a] text-white",
                  },
                  amber: {
                    label: "At Risk",
                    headerBg: "bg-amber-50/70",
                    border: "border-amber-200",
                    badgeBg: "bg-[#f59e0b] text-white",
                  },
                  red: {
                    label: "Off Track",
                    headerBg: "bg-rose-50/70",
                    border: "border-rose-200",
                    badgeBg: "bg-[#dc2626] text-white",
                  },
                  pending: {
                    label: "Pending",
                    headerBg: "bg-slate-100/80",
                    border: "border-slate-300",
                    badgeBg: "bg-slate-600 text-white",
                  },
                };

                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 font-bold block">
                          RBM Partnership to End Malaria • Official Telemetry Summary
                        </span>
                        <h3 className="text-lg font-display font-bold text-[#111827] mt-0.5">
                          Strategic Performance Assessment (
                          {globalFocusArea === "all"
                            ? "All Monitored Tiers"
                            : globalFocusArea.replace(/_/g, " ").toUpperCase()}
                          )
                        </h3>
                        <p className="text-[11px] italic text-[#1d4ed8] mt-0.5" data-pdf-ignore="true">
                          Click any status badge on the right to view the list of indicators in that status.
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs font-mono flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setBriefingStatusFilter((prev) =>
                              prev === "green" ? null : "green"
                            )
                          }
                          title="Click to list On Track indicators"
                          className={`px-2.5 py-1 rounded border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            briefingStatusFilter === "green"
                              ? "bg-[#16a34a] text-white border-emerald-700 ring-2 ring-emerald-200 shadow-xs"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          <span>{scopedCounts.green} On Track</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBriefingStatusFilter((prev) =>
                              prev === "amber" ? null : "amber"
                            )
                          }
                          title="Click to list At Risk indicators"
                          className={`px-2.5 py-1 rounded border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            briefingStatusFilter === "amber"
                              ? "bg-[#f59e0b] text-white border-amber-600 ring-2 ring-amber-200 shadow-xs"
                              : "bg-amber-50 hover:bg-amber-100 text-[#b45309] border-[#f59e0b]/60"
                          }`}
                        >
                          <span>{scopedCounts.amber} At Risk</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBriefingStatusFilter((prev) =>
                              prev === "red" ? null : "red"
                            )
                          }
                          title="Click to list Off Track indicators"
                          className={`px-2.5 py-1 rounded border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            briefingStatusFilter === "red"
                              ? "bg-[#dc2626] text-white border-rose-700 ring-2 ring-rose-200 shadow-xs"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200"
                          }`}
                        >
                          <span>{scopedCounts.red} Off Track</span>
                        </button>
                        {scopedCounts.pending > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setBriefingStatusFilter((prev) =>
                                prev === "pending" ? null : "pending"
                              )
                            }
                            title="Click to list Pending indicators"
                            className={`px-2.5 py-1 rounded border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              briefingStatusFilter === "pending"
                                ? "bg-slate-700 text-white border-slate-800 ring-2 ring-slate-300 shadow-xs"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
                            }`}
                          >
                            <span>{scopedCounts.pending} Pending</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable List of Indicators for Clicked Status Badge */}
                    {briefingStatusFilter && (
                      <div
                        data-pdf-ignore="true"
                        className={`mb-6 rounded-xl border ${statusMeta[briefingStatusFilter].border} overflow-hidden shadow-xs animate-fadeIn`}
                      >
                        <div
                          className={`px-4 py-2.5 ${statusMeta[briefingStatusFilter].headerBg} border-b ${statusMeta[briefingStatusFilter].border} flex items-center justify-between gap-3`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${statusMeta[briefingStatusFilter].badgeBg}`}
                            >
                              {statusMeta[briefingStatusFilter].label}
                            </span>
                            <span className="text-xs font-display font-bold text-slate-800">
                              {statusFilteredKPIs.length} Indicator
                              {statusFilteredKPIs.length === 1 ? "" : "s"} in Selected Scope
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBriefingStatusFilter(null)}
                            className="text-xs font-mono font-bold text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded hover:bg-white/60 cursor-pointer"
                          >
                            Close ✕
                          </button>
                        </div>

                        {statusFilteredKPIs.length === 0 ? (
                          <div className="p-4 text-center text-xs font-mono text-slate-500 bg-white">
                            No indicators in this scope have status &ldquo;
                            {statusMeta[briefingStatusFilter].label}&rdquo;.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 bg-white">
                            {statusFilteredKPIs.map((kpi) => {
                              const tl = evaluateKPITrafficLight(kpi);
                              const stratColor = getKPIStrategicColor(kpi);
                              const stratLabel = getKPIStrategicLabel(kpi);

                              return (
                                <div
                                  key={kpi.id}
                                  onClick={() => openTierDrilldown(kpi.category, kpi.id)}
                                  className="px-4 py-3 hover:bg-blue-50/40 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                                >
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: stratColor }}
                                      />
                                      {kpi.kpiCode && (
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                          {kpi.kpiCode}
                                        </span>
                                      )}
                                      <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase">
                                        {kpi.group || stratLabel}
                                      </span>
                                      <span className="text-xs font-normal text-slate-900 group-hover:text-[#1d4ed8] transition-colors">
                                        {kpi.name}
                                      </span>
                                    </div>
                                    <p className="text-[11px] font-mono text-slate-600 pl-4">
                                      <strong className="text-slate-800">{tl.ruleApplied}:</strong>{" "}
                                      {tl.varianceSummary}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] font-mono shrink-0 pl-4 md:pl-0">
                                    <div className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700">
                                      Base ({tl.baselineYear}):{" "}
                                      <strong>
                                        {tl.baselineValue !== null
                                          ? formatWithUnit(tl.baselineValue, tl.unit)
                                          : "Pending"}
                                      </strong>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700">
                                      2026 Rep:{" "}
                                      <strong>
                                        {tl.reported2026 !== null
                                          ? formatWithUnit(tl.reported2026, tl.unit)
                                          : "Pending"}
                                      </strong>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700">
                                      2030 Target:{" "}
                                      <strong>
                                        {tl.target2030 !== null
                                          ? formatWithUnit(tl.target2030, tl.unit)
                                          : "No Target"}
                                      </strong>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {donorBriefLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-[#2563eb] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-mono text-gray-500">
                    Synthesizing indicator trajectories and working group commentary...
                  </p>
                </div>
              ) : donorBriefText ? (
                <div className="prose prose-slate max-w-none text-sm leading-relaxed">
                  {renderBriefingText(donorBriefText)}
                </div>
              ) : (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm font-bold text-[#111827]">
                    Ready to Compile Strategic Briefing
                  </p>
                  <p className="text-xs italic text-[#1d4ed8] font-medium max-w-md mx-auto leading-relaxed">
                    Select a portfolio scope above and click{" "}
                    <strong className="text-[#1e40af] font-bold">Generate Board Briefing</strong>{" "}
                    to synthesize an evidence-based executive narrative.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* CONSOLIDATED INDICATOR MATRIX VIEW (Trajectory Heatmap + Data Quality & Source Access) */
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Light RBM Header Panel with Export PDF Button & Centered Adaptive Summary Figure Cards */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#93d573] rounded-lg p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563eb]">
                    Consolidated Indicator Matrix
                  </div>
                  <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-[#111827]">
                    {matrixSubView === "trajectory"
                      ? "Indicator Trajectory & Milestone Matrix"
                      : "Data Quality & Source Availability Audit"}
                  </h2>
                  <p className="text-gray-600 text-xs sm:text-sm max-w-2xl leading-relaxed">
                    {matrixSubView === "trajectory"
                      ? "Chronological 2024–2030 indicator trajectory grid tracking baseline values, reported milestones, and 2030 elimination targets across all strategic tiers."
                      : "Comprehensive data governance audit covering verification sources, baseline availability, and quality readiness across all monitored RBM Partnership indicators."}
                  </p>
                  <p className="text-xs italic text-[#1d4ed8] font-medium max-w-2xl leading-relaxed pt-0.5">
                    {matrixSubView === "trajectory" ? (
                      <>
                        Click any section header or indicator row to open the interactive{" "}
                        <strong className="text-[#1e40af] font-bold">Indicator Drilldown</strong>{" "}
                        popup, or hover/click the inline{" "}
                        <strong className="text-[#2563eb] font-serif italic">i</strong> icon beside an
                        indicator to inspect its Traffic-Light formula, baseline year, and milestone
                        rationale.
                      </>
                    ) : (
                      <>
                        Use the filters below to audit data sources and quality ratings, or click any
                        indicator&apos;s inline{" "}
                        <strong className="text-[#2563eb] font-serif italic">i</strong> icon to inspect
                        its full classification and milestone formula.
                      </>
                    )}
                  </p>
                </div>

                {/* Export to PNG & PDF Buttons */}
                <div className="shrink-0 self-start flex items-center gap-2" data-pdf-ignore="true">
                  <button
                    type="button"
                    onClick={handleExportActiveTabPNG}
                    disabled={isExportingTabPng || isExportingTabPdf}
                    title={`Export ${TAB_LABELS[activeMainTab]} view as a single continuous PNG image without page breaks`}
                    className={`px-3.5 h-[36px] rounded-md text-xs font-sans font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      isExportingTabPng
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-wait"
                        : "bg-white hover:bg-[#F2F8FF] text-[#1d4ed8] border border-blue-300 shadow-2xs"
                    }`}
                  >
                    {isExportingTabPng ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        <span>Exporting PNG...</span>
                      </>
                    ) : (
                      <span>Export to PNG</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportActiveTabPDF}
                    disabled={isExportingTabPdf || isExportingTabPng}
                    title={`Export ${TAB_LABELS[activeMainTab]} view to high-resolution PDF`}
                    className={`px-3.5 h-[36px] rounded-md text-xs font-sans font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      isExportingTabPdf
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-wait"
                        : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs"
                    }`}
                  >
                    {isExportingTabPdf ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        <span>Exporting PDF...</span>
                      </>
                    ) : (
                      <span>Export to PDF</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Centered Summary Figure Cards with Adaptive Screen-Size Spacing */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 md:gap-8 lg:gap-12 max-w-4xl mx-auto w-full">
                <div className="bg-[#F2F8FF] border border-blue-200/80 rounded-xl px-4 py-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#16a34a] leading-none">
                    {bannerStats.green}
                  </div>
                  <span className="text-[11px] text-[#15803d] uppercase font-bold tracking-wider font-mono mt-1.5 whitespace-nowrap">
                    On Track
                  </span>
                </div>
                <div className="bg-[#F2F8FF] border border-blue-200/80 rounded-xl px-4 py-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#f59e0b] leading-none">
                    {bannerStats.amber}
                  </div>
                  <span className="text-[11px] text-[#b45309] uppercase font-bold tracking-wider font-mono mt-1.5 whitespace-nowrap">
                    At Risk
                  </span>
                </div>
                <div className="bg-[#F2F8FF] border border-blue-200/80 rounded-xl px-4 py-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#dc2626] leading-none">
                    {bannerStats.red}
                  </div>
                  <span className="text-[11px] text-[#b91c1c] uppercase font-bold tracking-wider font-mono mt-1.5 whitespace-nowrap">
                    Off Track
                  </span>
                </div>
                <div className="bg-[#F2F8FF] border border-blue-200/80 rounded-xl px-4 py-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-gray-500 leading-none">
                    {bannerStats.pending}
                  </div>
                  <span className="text-[11px] text-gray-600 uppercase font-bold tracking-wider font-mono mt-1.5 whitespace-nowrap">
                    Pending
                  </span>
                </div>
              </div>

              {/* Consolidated Matrix Mode Bar */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="inline-flex bg-[#F2F8FF] p-1 rounded-lg border border-blue-200 self-start">
                  <button
                    type="button"
                    onClick={() => setMatrixSubView("trajectory")}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      matrixSubView === "trajectory"
                        ? "bg-[#2563eb] text-white shadow-2xs"
                        : "text-[#1e3653] hover:text-[#2563eb]"
                    }`}
                  >
                    Trajectory &amp; Milestone Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixSubView("quality_access")}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      matrixSubView === "quality_access"
                        ? "bg-[#2563eb] text-white shadow-2xs"
                        : "text-[#1e3653] hover:text-[#2563eb]"
                    }`}
                  >
                    Data Quality &amp; Source Audit
                  </button>
                </div>

                {matrixSubView === "trajectory" && (
                  <div className="flex bg-[#F2F8FF] p-1 rounded-md border border-blue-200 font-sans self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setHeatmapPlotMode("milestone")}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                        heatmapPlotMode === "milestone"
                          ? "bg-[#3365e3] text-white shadow-xs"
                          : "text-gray-600 hover:text-[#111827]"
                      }`}
                    >
                      KPI Progress View
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeatmapPlotMode("sparkline")}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                        heatmapPlotMode === "sparkline"
                          ? "bg-[#3365e3] text-white shadow-xs"
                          : "text-gray-600 hover:text-[#111827]"
                      }`}
                    >
                      Line View
                    </button>
                  </div>
                )}
              </div>
            </div>

            {matrixSubView === "quality_access" ? (
              <DataQualityTableView
                kpis={kpis}
                onSelectKpi={(kpi) => setClassificationModalKpi(kpi)}
                onOpenClassificationModal={(kpi) => setClassificationModalKpi(kpi)}
              />
            ) : (
              <>

            {/* 2. RBM Filter Bar (Matches dashboards.endmalaria.org/en/country-support) */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Filters:
                </span>

                <div className="relative flex-1 min-w-[220px]">
                  <input
                    type="text"
                    placeholder="Search indicators by code, statement, or definition..."
                    value={kpiSearchQuery}
                    onChange={(e) => setKpiSearchQuery(e.target.value)}
                    className="w-full bg-white border-2 border-gray-300 rounded-md px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2563eb] font-sans h-[34.5px]"
                  />
                  {kpiSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setKpiSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={globalFocusArea}
                    onChange={(e) => {
                      setGlobalFocusArea(e.target.value);
                      setSelectedCell(null);
                    }}
                    aria-label="Filter by Strategic Focus Area"
                    className="bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-md px-2.5 text-xs text-gray-700 font-sans font-medium focus:outline-none focus:border-[#2563eb] cursor-pointer h-[34.5px]"
                  >
                    <option value="all">Focus Area: All Indicators ({kpis.length})</option>
                    <option value="save_lives">Save Lives (Mortality &amp; Morbidity)</option>
                    <option value="ecosystem">Ecosystem &amp; Member Partners</option>
                    <option value="architecture">Broader Malaria Health Goals</option>
                    <option value="unity">All Unity 30 KPIs (Secretariat &amp; Partnership)</option>
                    <option value="unity_engage">U.1 Engage</option>
                    <option value="unity_align">U.2 Align</option>
                    <option value="unity_enable">U.3 Enable</option>
                    <option value="unity_act">U.4 Act</option>
                    <option value="unity_impact">U.5 Impact</option>
                    <option value="secretariat">Secretariat KPIs</option>
                    <option value="partnership">Partnership KPIs</option>
                  </select>

                  <select
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value as any)}
                    aria-label="Filter by KPI Owner"
                    className="bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-md px-2.5 text-xs text-gray-700 font-sans font-medium focus:outline-none focus:border-[#2563eb] cursor-pointer h-[34.5px]"
                  >
                    <option value="all">Owner: All Owners</option>
                    <option value="secretariat">Owner: Secretariat</option>
                    <option value="partnership">Owner: Partnership / WGs</option>
                  </select>

                  {(globalFocusArea !== "all" || ownerFilter !== "all" || kpiSearchQuery) && (
                    <button
                      onClick={() => {
                        setGlobalFocusArea("all");
                        setOwnerFilter("all");
                        setKpiSearchQuery("");
                        setSelectedCell(null);
                      }}
                      className="px-3 h-[34.5px] rounded-md bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-sans text-xs font-medium transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Unified Legend Strip: Tier Border Color Key + Traffic-Light Status Key */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-[10px] font-mono text-gray-600">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Tier Border Key:
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#FFC72C" }}
                    />{" "}
                    Save Lives
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#84cc16" }}
                    />{" "}
                    Ecosystem
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#10b981" }}
                    />{" "}
                    Broader Goals
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#1F429B" }}
                    />{" "}
                    U.1 Engage
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#1E62D0" }}
                    />{" "}
                    U.2 Align
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#00A3E0" }}
                    />{" "}
                    U.3 Enable
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#8c9c1b" }}
                    />{" "}
                    U.4 Act
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#43B02A" }}
                    />{" "}
                    U.5 Impact
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#10b981" }}
                    />{" "}
                    On Track
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#f59e0b" }}
                    />{" "}
                    At Risk
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                      style={{ backgroundColor: "#ef4444" }}
                    />{" "}
                    Off Track
                  </span>
                  <span className="inline-flex items-center gap-1 text-gray-500 whitespace-nowrap">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 border border-slate-300 inline-block shrink-0" />{" "}
                    Pending
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 md:p-6 shadow-md">
              <div
                ref={cleanMatrixRef}
                className="w-full bg-white border border-gray-200 rounded-lg overflow-hidden shadow-xs"
              >
                <div className="overflow-x-auto">
                  {renderIndicatorMatrixTable(heatmapKPIs, { cleanStatic: false })}
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Interactive Indicator Drilldown Popup Modal (Triggered on Section Header, Tier Card, or Indicator Row click) */}
      {drilldownModal &&
        (() => {
          const sectionMetaList = [
            {
              id: "save_lives",
              name: "Save Lives (Apex Indicators)",
              desc: "Tracks global malaria mortality reductions and case incidence drops toward the 2030 elimination targets.",
            },
            {
              id: "ecosystem",
              name: "Ecosystem & Member Partners",
              desc:
                sheetTerms["Ecosystem KPIs"] ||
                "Systemic resilience, funding gap closure, commodity delivery, and epidemic response across the malaria ecosystem.",
            },
            {
              id: "ecosystem_all",
              name: "Malaria Eradication-Ready Ecosystem & Broader Health Goals",
              desc: "Combined Ecosystem resilience and Broader Malaria Health Goals (climate change & refugee/IDP inclusion).",
            },
            {
              id: "architecture",
              name: "Broader Malaria Health Goals",
              desc:
                sheetTerms["Broader Health Goals"] ||
                "Integration into NDCs (climate/vector) and refugee & IDP population inclusion in National Strategic Plans.",
            },
            {
              id: "broader_goals",
              name: "Broader Malaria Health Goals",
              desc:
                sheetTerms["Broader Health Goals"] ||
                "Integration into NDCs (climate/vector) and refugee & IDP population inclusion in National Strategic Plans.",
            },
            {
              id: "unity",
              name: "Unity 30 KPIs",
              desc:
                sheetTerms["Unity KPIs"] ||
                "Measures progress of the RBM Partnership and Secretariat toward the Unity 30 strategic actions.",
            },
            {
              id: "unity_engage",
              name: "Unity 30: Engage (U.1)",
              desc: "Surfaces country challenges, mobilizes global and local leadership, and aligns convening bodies.",
            },
            {
              id: "unity_align",
              name: "Unity 30: Align (U.2)",
              desc: "Generates actionable country-level intelligence and aligns multi-donor funding schemas.",
            },
            {
              id: "unity_enable",
              name: "Unity 30: Enable (U.3)",
              desc: "Unlocks sovereign finance commitments and scales local capacity via joint teams.",
            },
            {
              id: "unity_act",
              name: "Unity 30: Act (U.4)",
              desc: "Executes coordinated advocacy campaigns and direct, targeted country assistance.",
            },
            {
              id: "unity_impact",
              name: "Unity 30: Impact (U.5)",
              desc: "Tracks overall RBM partnership satisfaction and strengthening of national leadership.",
            },
            {
              id: "secretariat",
              name: "Unity 30 — Secretariat KPIs",
              desc: "Internal Secretariat output metrics, convenings, and regional country support execution.",
            },
            {
              id: "partnership",
              name: "Unity 30 — Partnership KPIs",
              desc: "Working Group & Partner alignment, collaboration index, and joint advocacy.",
            },
          ];

          const secMeta = sectionMetaList.find((s) => s.id === drilldownModal.sectionId) || {
            id: drilldownModal.sectionId,
            name: "Monitored Partnership Indicators",
            desc: "Trajectory and milestone evaluation across selected indicators.",
          };

          const sectionKPIs = normalizeKPIList(
            filterKPIsByFocusArea(kpis, drilldownModal.sectionId)
          );
          const focusedKPI = drilldownModal.kpiId
            ? kpis.find((k) => k.id === drilldownModal.kpiId) || null
            : null;

          const baseScopeKPIs = focusedKPI ? [focusedKPI] : sectionKPIs;
          const modalStats = computeSectionProgressStats(baseScopeKPIs);

          const displayedKPIs = baseScopeKPIs.filter((k) => {
            if (
              drilldownModal.statusFilter !== "all" &&
              k.status !== drilldownModal.statusFilter
            ) {
              return false;
            }
            if (drilldownModal.searchQuery.trim()) {
              const q = drilldownModal.searchQuery.toLowerCase();
              const matchName = k.name && k.name.toLowerCase().includes(q);
              const matchCode = k.kpiCode && k.kpiCode.toLowerCase().includes(q);
              const matchDef =
                (k.definition && k.definition.toLowerCase().includes(q)) ||
                (k.description && k.description.toLowerCase().includes(q));
              if (!matchName && !matchCode && !matchDef) return false;
            }
            return true;
          });

          const avgColor =
            modalStats.overallStatus === "green"
              ? "#16a34a"
              : modalStats.overallStatus === "red"
              ? "#dc2626"
              : modalStats.overallStatus === "amber"
              ? "#f59e0b"
              : "#94a3b8";

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
              onClick={() => setDrilldownModal(null)}
            >
              <div
                className="bg-white border border-gray-200 border-t-4 border-t-[#2563eb] rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Popup Header */}
                <div className="px-6 py-4 bg-[#F2F8FF] border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#2563eb] font-bold">
                        Indicator Drilldown View
                      </span>
                      {focusedKPI && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[10px] font-mono font-bold text-[#1e3653]">
                            {secMeta.name}
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-xl font-display font-bold text-[#111827] mt-0.5">
                      {focusedKPI
                        ? `${focusedKPI.kpiCode ? `${focusedKPI.kpiCode} · ` : ""}${focusedKPI.name}`
                        : secMeta.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                      {focusedKPI ? focusedKPI.definition || focusedKPI.description : secMeta.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
                    {focusedKPI && sectionKPIs.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDrilldownModal((prev) =>
                            prev ? { ...prev, kpiId: null } : null
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-[#1d4ed8] border border-blue-200 text-xs font-sans font-semibold transition-colors cursor-pointer shadow-2xs"
                      >
                        View All in Section ({sectionKPIs.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDrilldownModal(null)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-blue-100/60 transition-colors cursor-pointer"
                      aria-label="Close Indicator Drilldown modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Status Distribution & Section Average Progress Bar */}
                <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">
                        Status distribution in this view ({baseScopeKPIs.length} KPI
                        {baseScopeKPIs.length === 1 ? "" : "s"})
                      </span>

                      {/* Average Progress to 2030 Target Pill */}
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-[10px] font-bold text-[#1e3653] shadow-2xs">
                        <span>
                          Avg. Progress to 2030 Target:{" "}
                          <strong style={{ color: avgColor }} className="font-black">
                            {modalStats.avgProgress !== null
                              ? `${modalStats.avgProgress}%`
                              : "Pending"}
                          </strong>
                        </span>
                        {modalStats.avgProgress !== null && (
                          <span className="w-16 h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden inline-flex">
                            <span
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(4, modalStats.avgProgress)}%`,
                                backgroundColor: avgColor,
                              }}
                            />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Search inside section modal when showing multiple KPIs */}
                    {baseScopeKPIs.length > 1 && (
                      <div className="relative w-full sm:w-64">
                        <input
                          type="text"
                          placeholder="Search indicators in this view..."
                          value={drilldownModal.searchQuery}
                          onChange={(e) =>
                            setDrilldownModal((prev) =>
                              prev ? { ...prev, searchQuery: e.target.value } : null
                            )
                          }
                          className="w-full pl-3 pr-7 py-1.5 border border-slate-300 text-xs bg-white rounded-lg focus:outline-none focus:border-[#2563eb] font-sans"
                        />
                        {drilldownModal.searchQuery && (
                          <button
                            type="button"
                            onClick={() =>
                              setDrilldownModal((prev) =>
                                prev ? { ...prev, searchQuery: "" } : null
                              )
                            }
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Proportional Status Bar */}
                  {baseScopeKPIs.length > 0 && (
                    <div className="h-3.5 bg-slate-200 rounded-full overflow-hidden flex font-mono text-[9px] font-black text-white text-center">
                      {modalStats.redCount > 0 && (
                        <div
                          style={{
                            width: `${(modalStats.redCount / modalStats.totalCount) * 100}%`,
                          }}
                          className="bg-[#dc2626] flex items-center justify-center border-r border-white/15"
                        >
                          {modalStats.redCount}
                        </div>
                      )}
                      {modalStats.amberCount > 0 && (
                        <div
                          style={{
                            width: `${(modalStats.amberCount / modalStats.totalCount) * 100}%`,
                          }}
                          className="bg-[#f59e0b] flex items-center justify-center border-r border-white/15"
                        >
                          {modalStats.amberCount}
                        </div>
                      )}
                      {modalStats.greenCount > 0 && (
                        <div
                          style={{
                            width: `${(modalStats.greenCount / modalStats.totalCount) * 100}%`,
                          }}
                          className="bg-[#16a34a] flex items-center justify-center border-r border-white/15"
                        >
                          {modalStats.greenCount}
                        </div>
                      )}
                      {modalStats.pendingCount > 0 && (
                        <div
                          style={{
                            width: `${(modalStats.pendingCount / modalStats.totalCount) * 100}%`,
                          }}
                          className="bg-slate-400 flex items-center justify-center"
                        >
                          {modalStats.pendingCount}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Scrollable Cards Grid */}
                <div className="p-6 overflow-y-auto flex-1 bg-[#f8fafc]">
                  {displayedKPIs.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-white">
                      <h4 className="text-xs font-bold text-slate-700">
                        No matching indicators in scope
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Try clearing the search query above.
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`grid grid-cols-1 ${
                        displayedKPIs.length > 1 ? "xl:grid-cols-2" : "max-w-3xl mx-auto"
                      } gap-5`}
                    >
                      {displayedKPIs.map((kpi) => (
                        <ApexTrajectoryCard
                          key={kpi.id}
                          kpi={kpi}
                          type={
                            kpi.id === "kpi-19"
                              ? "mortality"
                              : kpi.id === "kpi-20"
                              ? "incidence"
                              : "general"
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
                  <span className="text-[11px] font-mono text-slate-500">
                    Showing {displayedKPIs.length} of {baseScopeKPIs.length} indicator
                    {baseScopeKPIs.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrilldownModal(null)}
                    className="px-4 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-sans font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Classification & Traffic-Light Rationale Info Modal */}
      {classificationModalKpi && (
        <IndicatorClassificationModal
          kpi={classificationModalKpi}
          isOpen={!!classificationModalKpi}
          onClose={() => setClassificationModalKpi(null)}
        />
      )}

      {/* Know More Executive Context & Methodology Modal */}
      {isKnowMoreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
          onClick={() => setIsKnowMoreOpen(false)}
        >
          <div
            className="bg-white border border-gray-200 border-t-4 border-t-[#2563eb] rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#F2F8FF] border-b border-blue-100 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2563eb] text-white text-xs font-sans font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Know More</span>
                </span>
                <h2 className="text-base sm:text-lg font-display font-bold text-[#1e3653]">
                  RBM Partnership Impact Dashboard — Context &amp; Approach
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsKnowMoreOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-blue-100/60 transition-colors cursor-pointer"
                aria-label="Close Know More modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-7 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
              {/* Section 1 */}
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-display font-bold text-[#1e3653]">
                  A foundational Milestone in Collective Accountability
                </h3>
                <p>
                  In November 2025, for the first time RBM Partnership to End Malaria, presented to
                  the Board a unified Impact Reporting Framework designed explicitly for the Unity 30
                  Strategic Plan. The year 2026 marks the very first operational reporting cycle
                  under this framework. This milestone reflects a fundamental shift from fragmented,
                  transactional grant tracking toward a single, cohesive Monitoring &amp; Evaluation
                  (M&amp;E) operating model that holds both the Secretariat and the broader
                  Partnership accountable to our shared mission.
                </p>
              </div>

              {/* Section 2 */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h3 className="text-base sm:text-lg font-display font-bold text-[#1e3653]">
                  A Pragmatic, Work-in-Progress Approach
                </h3>
                <p>
                  As with any inaugural exercise, this reporting framework is a work in progress.
                  Operating with a lean Secretariat, we made deliberate, pragmatic choices during
                  this first year of implementation:
                </p>
                <ul className="space-y-2.5 pl-4 list-disc marker:text-[#2563eb]">
                  <li>
                    <strong className="font-semibold text-[#1e3653]">
                      Data Accessibility &amp; Refined KPI Formulation:
                    </strong>{" "}
                    To ensure data collection remained feasible without imposing unnecessary
                    administrative burdens, we prioritized indicators with readily available or
                    easily accessible data sources. In several instances, KPI formulations were
                    adjusted to establish a realistic baseline and enable seamless annual tracking.
                  </li>
                  <li>
                    <strong className="font-semibold text-[#1e3653]">
                      Building the Member Platform vs. Soliciting Partners:
                    </strong>{" "}
                    A major achievement in 2026 was the execution of the Partnership Census and the
                    architecture of a centralized digital members platform. While this platform will
                    ultimately enable routine pulse surveys and direct outreach with National Malaria
                    Programmes (NMPs) and partners, no pulse survey was conducted in 2026.
                    Recognizing that partners were heavily solicited throughout the year, we chose
                    not to overburden their capacity. Consequently, two partner-satisfaction KPIs
                    will not feature numerical survey scores this year; instead, we provide a
                    qualitative analysis based on rich insights gathered through the Census.
                  </li>
                  <li>
                    <strong className="font-semibold text-[#1e3653]">Resource Constraints:</strong>{" "}
                    Some critical KPIs, such as those tracking Epidemic Preparedness and Response
                    (EPR), reflect limited data for 2026 due to resource constraints. For 2027, our
                    explicit goal is that aspirational and additional resources will allow us to
                    dedicate targeted capacity to dually track and support countries in their
                    outbreak readiness.
                  </li>
                </ul>
              </div>

              {/* Section 3 */}
              <div className="space-y-3 pt-4 border-t border-gray-100 bg-[#F2F8FF]/60 p-4 sm:p-5 rounded-xl border border-blue-100">
                <p className="text-slate-800 font-medium">
                  The <strong className="font-bold text-[#1e3653]">RBM Partnership Impact Dashboard</strong>{" "}
                  is an executive interactive monitoring platform designed to transparently track the
                  multi-tiered Theory of Change toward global malaria eradication by connecting
                  operational Unity 30 activities and Big Push against Malaria pillars directly to
                  high-level, life-saving outcomes.
                </p>
                <p className="font-semibold text-[#1e3653]">
                  It features three consolidated analytical workspaces:
                </p>
                <ul className="space-y-2.5 pl-4 list-disc marker:text-[#2563eb]">
                  <li>
                    <strong className="font-semibold text-[#1e3653]">Strategic Framework:</strong> A
                    6-tier structural backbone combining the Visual Cascade &amp; KPI Trajectory
                    Cards with the Unity 30 Building Blocks (Engage, Align, Enable, Act, Impact)
                    &amp; Big Push Pillars explorer, illustrating how Secretariat and Partnership
                    actions amplify global impact.
                  </li>
                  <li>
                    <strong className="font-semibold text-[#1e3653]">Indicator Matrix:</strong> A
                    unified tabular explorer combining the Trajectory &amp; Milestone Matrix
                    (tracking indicators from their 2015, 2025, or 2026 baselines through the
                    2026–2030 reporting horizon with automated Traffic-Light evaluations and
                    interactive drilldown cards) and the Data Quality &amp; Source Availability Audit
                    table.
                  </li>
                  <li>
                    <strong className="font-semibold text-[#1e3653]">Executive Briefing:</strong> An
                    on-demand synthesis engine that compiles monitored indicator progress, milestone
                    variances, and working group commentary into print-ready Board and Donor briefing
                    memos.
                  </li>
                </ul>
                <p className="pt-1 text-slate-700">
                  Engineered for automated real-time synchronization, the platform ingests live
                  Google Sheets updates via background polling and API integration—eliminating manual
                  uploads and ensuring immediate visibility into progress toward the 2030 elimination
                  targets.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsKnowMoreOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-sans font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
