import React, { useState, useMemo } from "react";
import {
  KPI,
  StrategicHierarchyView as HierarchyViewType,
  UnitySubcategory,
  BigPushPillarSpec,
} from "@/src/types";
import { IndicatorClassificationModal } from "./IndicatorClassificationModal";
import { ApexTrajectoryCard } from "./ApexTrajectoryCard";
import { formatMetricNum } from "@/src/lib/kpiTrafficLight";

interface StrategicHierarchyViewProps {
  kpis: KPI[];
  bigPushPillars: BigPushPillarSpec[];
  onSelectKpi?: (kpi: KPI) => void;
  selectedKpiId?: string | null;
}

export const StrategicHierarchyView: React.FC<StrategicHierarchyViewProps> = ({
  kpis,
  bigPushPillars,
}) => {
  const [viewMode, setViewMode] = useState<HierarchyViewType>("unity_blocks");
  const [selectedStep, setSelectedStep] = useState<UnitySubcategory | "all">("all");
  const [selectedPillarId, setSelectedPillarId] = useState<number | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [classificationModalKpi, setClassificationModalKpi] = useState<KPI | null>(null);

  const unitySteps: {
    id: UnitySubcategory;
    code: string;
    name: string;
    subtitle: string;
    bigPushImpact: string;
    hex: string;
    borderTopClass: string;
    badgeBgClass: string;
    badgeTextClass: string;
  }[] = [
    {
      id: "engage",
      code: "U.1",
      name: "Engage",
      subtitle:
        "Bring together teams, surface challenges, and enable country ownership per Pillar 2 and help set the direction for activities coordinated under Pillar 1.",
      bigPushImpact: "Informs Big Push priorities (Pillars 1 & 2)",
      hex: "#1F429B",
      borderTopClass: "border-t-[#1F429B]",
      badgeBgClass: "bg-blue-50 border-blue-200",
      badgeTextClass: "text-[#1F429B]",
    },
    {
      id: "align",
      code: "U.2",
      name: "Align",
      subtitle:
        "Bring new data and knowledge to strengthen data systems and enable data-driven decision making, per Pillars 3 and 5.",
      bigPushImpact: "Sharpens Big Push solutions (Pillars 3 & 5)",
      hex: "#1E62D0",
      borderTopClass: "border-t-[#1E62D0]",
      badgeBgClass: "bg-blue-50 border-blue-200",
      badgeTextClass: "text-[#1E62D0]",
    },
    {
      id: "enable",
      code: "U.3",
      name: "Enable",
      subtitle:
        "Activities align with Pillar 5 and 6 to drive sustainable financing and advocacy for resource needs.",
      bigPushImpact: "Fuels Big Push action (Pillars 5 & 6)",
      hex: "#00A3E0",
      borderTopClass: "border-t-[#00A3E0]",
      badgeBgClass: "bg-cyan-50 border-cyan-200",
      badgeTextClass: "text-[#007ba8]",
    },
    {
      id: "act",
      code: "U.4",
      name: "Act",
      subtitle:
        "The targeted advocacy and support under Act includes those activities under Pillars 3 and 4.",
      bigPushImpact: "Implements the Big Push globally and locally (Pillars 3 & 4)",
      hex: "#8c9c1b",
      borderTopClass: "border-t-[#8c9c1b]",
      badgeBgClass: "bg-lime-50 border-lime-200",
      badgeTextClass: "text-[#5c6810]",
    },
    {
      id: "impact",
      code: "U.5",
      name: "Impact",
      subtitle:
        "Activities track KPIs related to all Pillars and provide the M&E for any strategic shifts necessary.",
      bigPushImpact: "Strengthens and reorients the Big Push (All Pillars)",
      hex: "#43B02A",
      borderTopClass: "border-t-[#43B02A]",
      badgeBgClass: "bg-emerald-50 border-emerald-200",
      badgeTextClass: "text-[#2c7a1b]",
    },
  ];

  // Summary counts for the header banner
  const frameworkStats = useMemo(() => {
    const unityKpis = kpis.filter(
      (k) =>
        k.category === "unity" ||
        (k.unityStep && k.unityStep.trim().startsWith("U."))
    );
    const totalProposedBigPush = bigPushPillars.reduce(
      (acc, p) => acc + (p.proposedKPIs ? p.proposedKPIs.length : 0),
      0
    );
    return {
      unityCount: unityKpis.length,
      pillarsCount: bigPushPillars.length || 6,
      proposedBigPushCount: totalProposedBigPush,
    };
  }, [kpis, bigPushPillars]);

  const matchesSearch = (kpi: KPI) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      kpi.name.toLowerCase().includes(q) ||
      (kpi.kpiCode && kpi.kpiCode.toLowerCase().includes(q)) ||
      (kpi.definition && kpi.definition.toLowerCase().includes(q)) ||
      (kpi.source && kpi.source.toLowerCase().includes(q)) ||
      (kpi.group && kpi.group.toLowerCase().includes(q))
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. LIGHT RBM HEADER PANEL (Aligned with dashboards.endmalaria.org/en) */}
      <div className="bg-white border border-gray-200 border-t-4 border-t-[#93d573] rounded-lg p-6 shadow-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded bg-[#F2F8FF] text-[#2563eb] border border-blue-200 font-mono text-[11px] font-bold uppercase tracking-wider">
                Strategic Architecture
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-[#111827]">
              Unity 30 Strategic Framework &amp; Big Push Alignment
            </h2>
            <p className="text-gray-600 text-xs sm:text-sm max-w-2xl leading-relaxed">
              The 5 Unity 30 Building Blocks (U.1 Engage – U.5 Impact) organize RBM Secretariat,
              Partnership, and Ecosystem indicators to power the 6 Pillars of the Big Push against
              Malaria.
            </p>
          </div>

          {/* Right: RBM Summary Panels (#3365e3, #93d573, #f5f5f5) + Sub-Tab View Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
            <div className="flex items-stretch gap-2" data-name="summary-panels">
              <div
                className="rounded px-3.5 py-2.5 flex flex-col justify-between text-white min-w-[100px]"
                style={{ backgroundColor: "#3365e3" }}
              >
                <div className="text-xl font-mono font-bold leading-none">5</div>
                <span className="text-[10px] font-medium mt-1 block text-white">
                  Unity 30 Blocks
                </span>
              </div>
              <div
                className="rounded px-3.5 py-2.5 flex flex-col justify-between text-white min-w-[100px]"
                style={{ backgroundColor: "#93d573" }}
              >
                <div className="text-xl font-mono font-bold leading-none">
                  {frameworkStats.unityCount}
                </div>
                <span className="text-[10px] font-medium mt-1 block text-white">
                  Mapped KPIs
                </span>
              </div>
              <div
                className="rounded px-3.5 py-2.5 flex flex-col justify-between min-w-[105px]"
                style={{ backgroundColor: "#f5f5f5" }}
              >
                <div className="text-xl font-mono font-bold leading-none text-[#3365e3]">
                  {frameworkStats.pillarsCount}
                </div>
                <span className="text-[10px] font-medium mt-1 block text-[#3365e3]">
                  Big Push Pillars
                </span>
              </div>
            </div>

            {/* RBM Sub-Tab Toggle */}
            <div className="flex bg-[#F2F8FF] p-1 rounded-md border border-blue-200 font-sans self-start sm:self-center">
              <button
                type="button"
                onClick={() => setViewMode("unity_blocks")}
                className={`px-3.5 py-2 rounded text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "unity_blocks"
                    ? "bg-[#3365e3] text-white shadow-xs"
                    : "text-gray-600 hover:text-[#111827]"
                }`}
              >
                Unity 30 Blocks (U.1–U.5)
              </button>
              <button
                type="button"
                onClick={() => setViewMode("big_push_pillars")}
                className={`px-3.5 py-2 rounded text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "big_push_pillars"
                    ? "bg-[#3365e3] text-white shadow-xs"
                    : "text-gray-600 hover:text-[#111827]"
                }`}
              >
                6 Big Push Pillars
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. RBM FILTER BAR (Matches dashboards.endmalaria.org/en/country-support) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Filters:
          </span>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder={
                viewMode === "unity_blocks"
                  ? "Search Unity 30 indicators by code, statement, definition, or data source..."
                  : "Search Big Push pillars or proposed indicators..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border-2 border-gray-300 rounded-md px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2563eb] font-sans h-[34.5px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Step or Pillar Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {viewMode === "unity_blocks" ? (
              <>
                <select
                  value={selectedStep}
                  onChange={(e) => setSelectedStep(e.target.value as UnitySubcategory | "all")}
                  aria-label="Filter by Unity 30 Step"
                  className="bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-md px-2.5 text-xs text-gray-700 font-sans font-medium focus:outline-none focus:border-[#2563eb] cursor-pointer h-[34.5px]"
                >
                  <option value="all">All Unity 30 Building Blocks (U.1 – U.5)</option>
                  {unitySteps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} {s.name}
                    </option>
                  ))}
                </select>
                {(selectedStep !== "all" || searchTerm) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStep("all");
                      setSearchTerm("");
                    }}
                    className="px-3 h-[34.5px] rounded-md bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-sans text-xs font-medium transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </>
            ) : (
              <>
                <select
                  value={selectedPillarId}
                  onChange={(e) =>
                    setSelectedPillarId(
                      e.target.value === "all" ? "all" : parseInt(e.target.value, 10)
                    )
                  }
                  aria-label="Filter by Big Push Pillar"
                  className="bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-md px-2.5 text-xs text-gray-700 font-sans font-medium focus:outline-none focus:border-[#2563eb] cursor-pointer h-[34.5px]"
                >
                  <option value="all">All 6 Big Push Pillars</option>
                  {bigPushPillars.map((p) => (
                    <option key={p.id} value={p.pillarNum}>
                      Pillar {p.pillarNum}: {p.title}
                    </option>
                  ))}
                </select>
                {(selectedPillarId !== "all" || searchTerm) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPillarId("all");
                      setSearchTerm("");
                    }}
                    className="px-3 h-[34.5px] rounded-md bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-sans text-xs font-medium transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Step Selector Strip when in Unity 30 Blocks mode (RBM Subtab style) */}
        {viewMode === "unity_blocks" && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-gray-100">
            {unitySteps.map((step) => {
              const stepKpis = kpis.filter(
                (k) =>
                  k.subcategory === step.id ||
                  (k.unityStep && k.unityStep.includes(step.code))
              );
              const isSelected = selectedStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() =>
                    setSelectedStep((prev) => (prev === step.id ? "all" : step.id))
                  }
                  className={`p-2.5 rounded-md text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "rbm-subtab-active shadow-xs border border-blue-200"
                      : "rbm-subtab-inactive"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: step.hex }}
                    />
                    <span className="font-display font-bold text-xs uppercase truncate">
                      {step.code} {step.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? "bg-[#3365e3] text-white"
                        : "bg-white text-gray-600 border border-gray-200"
                    }`}
                  >
                    {stepKpis.length} KPIs
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: UNITY 30 BUILDING BLOCKS (U.1 - U.5) OR 6 BIG PUSH PILLARS */}
      {viewMode === "unity_blocks" ? (
        <div className="space-y-6">
          {unitySteps
            .filter((step) => selectedStep === "all" || selectedStep === step.id)
            .map((step) => {
              const stepKpis = kpis
                .filter(
                  (k) =>
                    k.subcategory === step.id ||
                    (k.unityStep && k.unityStep.includes(step.code))
                )
                .filter(matchesSearch);

              if (stepKpis.length === 0 && searchTerm) return null;

              const greenCount = stepKpis.filter((k) => k.status === "green").length;
              const amberCount = stepKpis.filter((k) => k.status === "amber").length;
              const redCount = stepKpis.filter((k) => k.status === "red").length;

              return (
                <div
                  key={step.id}
                  className={`bg-white border border-gray-200 border-t-4 ${step.borderTopClass} rounded-lg p-6 shadow-md space-y-6`}
                >
                  {/* Step Section Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-gray-200">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className="px-2.5 py-0.5 rounded text-white font-mono text-xs font-bold uppercase tracking-wider"
                          style={{ backgroundColor: step.hex }}
                        >
                          {step.code} • {step.name}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded border font-mono text-[10px] font-bold uppercase tracking-wider ${step.badgeBgClass} ${step.badgeTextClass}`}
                        >
                          {step.bigPushImpact}
                        </span>
                      </div>
                      <h2 className="text-xl font-display font-bold text-[#111827] uppercase tracking-tight">
                        {step.code} {step.name} — Unity 30 Building Block
                      </h2>
                      <p className="text-xs text-gray-600 max-w-3xl leading-relaxed">
                        {step.subtitle}
                      </p>
                    </div>

                    {/* Status Breakdown Pills */}
                    <div className="flex items-center gap-2 font-mono text-xs shrink-0 flex-wrap">
                      <span className="px-3 py-1.5 rounded bg-[#F2F8FF] text-[#2563eb] font-bold border border-blue-200">
                        {stepKpis.length} {stepKpis.length === 1 ? "Indicator" : "Indicators"}
                      </span>
                      {greenCount > 0 && (
                        <span className="px-2.5 py-1.5 rounded bg-emerald-50 text-[#15803d] font-bold border border-[#16a34a]/40">
                          {greenCount} On Track
                        </span>
                      )}
                      {amberCount > 0 && (
                        <span className="px-2.5 py-1.5 rounded bg-amber-50 text-[#b45309] font-bold border border-[#f59e0b]/60">
                          {amberCount} At Risk
                        </span>
                      )}
                      {redCount > 0 && (
                        <span className="px-2.5 py-1.5 rounded bg-rose-50 text-[#b91c1c] font-bold border border-[#dc2626]/40">
                          {redCount} Off Track
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Indicator Trajectory Cards Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {stepKpis.map((kpi) => (
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
              );
            })}
        </div>
      ) : (
        /* 6 BIG PUSH PILLARS VIEW (Sourced live from "Big Push KPIs" Google Sheet tab) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {bigPushPillars
              .filter((p) => selectedPillarId === "all" || p.pillarNum === selectedPillarId)
              .filter((p) => {
                if (!searchTerm.trim()) return true;
                const q = searchTerm.toLowerCase();
                if (
                  p.title.toLowerCase().includes(q) ||
                  p.actions.toLowerCase().includes(q)
                ) {
                  return true;
                }
                return p.proposedKPIs.some(
                  (pk) =>
                    pk.proposedKpi.toLowerCase().includes(q) ||
                    pk.statedMetric.toLowerCase().includes(q) ||
                    pk.rationale.toLowerCase().includes(q) ||
                    pk.wgComments.toLowerCase().includes(q)
                );
              })
              .map((pillar) => {
                const linkedUnityKpis = kpis.filter(
                  (k) => k.bigPushPillarId === pillar.pillarNum
                );

                return (
                  <div
                    key={pillar.id}
                    className="bg-white border border-gray-200 border-t-4 border-t-[#E55535] rounded-lg p-6 shadow-md flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-4">
                      {/* Pillar Header */}
                      <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-200">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded bg-[#E55535] text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                              Pillar {pillar.pillarNum}
                            </span>
                            <span className="px-2.5 py-0.5 rounded bg-orange-50 text-[#E55535] border border-orange-200 font-mono text-[10px] font-bold uppercase tracking-wider">
                              Big Push against Malaria
                            </span>
                          </div>
                          <h3 className="text-lg font-display font-bold text-[#111827] mt-2 uppercase tracking-tight">
                            {pillar.title}
                          </h3>
                          {pillar.actions && (
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                              {pillar.actions}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Big Push KPI Status Note (Not exposing proposed KPIs to be reported later) */}
                      <div className="p-3.5 rounded-lg bg-[#F2F8FF]/60 border border-blue-100 flex items-center justify-between">
                        <span className="text-xs font-sans italic text-[#1e3653]">
                          Big Push KPIs for Pillar {pillar.pillarNum} are to be reported later.
                        </span>
                      </div>
                    </div>

                    {/* Linked Active Unity 30 KPIs */}
                    {linkedUnityKpis.length > 0 && (
                      <div className="pt-4 border-t border-gray-200 space-y-2.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 block">
                          Amplified by Active Unity 30 Indicators ({linkedUnityKpis.length})
                        </span>
                        <div className="space-y-2">
                          {linkedUnityKpis.map((uk) => (
                            <div
                              key={uk.id}
                              onClick={() => setClassificationModalKpi(uk)}
                              className="p-2.5 rounded-lg bg-[#F2F8FF]/50 hover:bg-[#F2F8FF] border border-blue-100 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white border border-blue-200 text-[#2563eb]">
                                    {uk.kpiCode}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-[#1e3653]">
                                    {uk.unityStep}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-[#111827] truncate mt-1">
                                  {uk.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    uk.status === "green"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : uk.status === "amber"
                                      ? "bg-amber-100 text-amber-800"
                                      : uk.status === "red"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {typeof uk.value === "number"
                                    ? `${formatMetricNum(uk.value)}${uk.unit === "%" ? "%" : ""}`
                                    : "Pending"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Classification & Traffic-Light Rationale Info Modal */}
      {classificationModalKpi && (
        <IndicatorClassificationModal
          kpi={classificationModalKpi}
          isOpen={!!classificationModalKpi}
          onClose={() => setClassificationModalKpi(null)}
        />
      )}
    </div>
  );
};

export default StrategicHierarchyView;
