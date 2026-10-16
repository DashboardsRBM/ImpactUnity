import React, { useState, useMemo } from "react";
import { KPI } from "@/src/types";
import { InfoIconButton } from "./RBMTooltip";
import { evaluateKPITrafficLight } from "@/src/lib/kpiTrafficLight";

interface DataQualityTableViewProps {
  kpis: KPI[];
  onSelectKpi?: (kpi: KPI) => void;
  onOpenClassificationModal?: (kpi: KPI) => void;
}

const getKPIStrategicColor = (k: KPI): string => {
  if (k.group === "Save Lives" || k.category === "save_lives") return "#FFC72C";
  if (k.group === "Ecosystem and Member Partners" || k.category === "ecosystem") return "#84cc16";
  if (
    k.group === "Broader Malaria Health Goals" ||
    k.category === "broader_goals" ||
    k.category === "architecture"
  )
    return "#10b981";
  const step = (k.unityStep || "").trim();
  const sub = k.subcategory;
  if (step.startsWith("U.1") || sub === "engage") return "#1F429B";
  if (step.startsWith("U.2") || sub === "align") return "#1E62D0";
  if (step.startsWith("U.3") || sub === "enable") return "#00A3E0";
  if (step.startsWith("U.4") || sub === "act") return "#8c9c1b";
  if (step.startsWith("U.5") || sub === "impact") return "#43B02A";
  return k.group === "Secretariat" ? "#2563eb" : "#4f46e5";
};

const getKPIStrategicLabel = (k: KPI): string => {
  if (k.group === "Save Lives" || k.category === "save_lives") return "Save Lives";
  if (k.group === "Ecosystem and Member Partners" || k.category === "ecosystem")
    return "Ecosystem";
  if (
    k.group === "Broader Malaria Health Goals" ||
    k.category === "broader_goals" ||
    k.category === "architecture"
  )
    return "Broader Goals";
  const step = (k.unityStep || "").trim();
  const sub = k.subcategory;
  if (step.startsWith("U.1") || sub === "engage") return "U.1 Engage";
  if (step.startsWith("U.2") || sub === "align") return "U.2 Align";
  if (step.startsWith("U.3") || sub === "enable") return "U.3 Enable";
  if (step.startsWith("U.4") || sub === "act") return "U.4 Act";
  if (step.startsWith("U.5") || sub === "impact") return "U.5 Impact";
  return k.group || "Unity 30 KPI";
};

export const DataQualityTableView: React.FC<DataQualityTableViewProps> = ({
  kpis,
  onOpenClassificationModal,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnityStep, setSelectedUnityStep] = useState<string>("all");
  const [selectedQualityFilter, setSelectedQualityFilter] = useState<string>("all");
  const [selectedAccessFilter, setSelectedAccessFilter] = useState<string>("all");

  const unityKpis = useMemo(() => {
    const orderMap: Record<string, number> = {
      "kpi-19": 2,
      "kpi-20": 3,
      "kpi-21": 4,
      "kpi-22": 5,
      "kpi-23": 6,
      "kpi-24": 7,
      "kpi-25": 8,
      "kpi-26": 9,
      "kpi-27": 10,
      "kpi-28": 11,
      "kpi-1": 12,
      "kpi-2": 13,
      "kpi-3": 14,
      "kpi-4": 15,
      "kpi-5": 16,
      "kpi-6": 17,
      "kpi-7": 18,
      "kpi-8": 19,
      "kpi-9": 20,
      "kpi-10": 21,
      "kpi-11": 22,
      "kpi-12": 23,
      "kpi-13": 24,
      "kpi-14": 25,
      "kpi-15": 26,
      "kpi-16": 27,
      "kpi-17": 28,
      "kpi-18": 29,
    };
    return [...kpis].sort((a, b) => (orderMap[a.id] ?? 99) - (orderMap[b.id] ?? 99));
  }, [kpis]);

  const filteredKpis = useMemo(() => {
    return unityKpis.filter((kpi) => {
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        const matchesName = kpi.name.toLowerCase().includes(q);
        const matchesDef = (kpi.definition || kpi.description || "").toLowerCase().includes(q);
        const matchesSource = (kpi.source || "").toLowerCase().includes(q);
        const matchesComments = (kpi.comments || "").toLowerCase().includes(q);
        const matchesCode = (kpi.kpiCode || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDef && !matchesSource && !matchesComments && !matchesCode) {
          return false;
        }
      }

      if (selectedUnityStep !== "all") {
        if (!kpi.unityStep || !kpi.unityStep.startsWith(selectedUnityStep)) {
          return false;
        }
      }

      if (selectedQualityFilter !== "all") {
        if ((kpi.qualityTrafficLight || "unrated") !== selectedQualityFilter) {
          return false;
        }
      }

      if (selectedAccessFilter !== "all") {
        if ((kpi.accessTrafficLight || "unrated") !== selectedAccessFilter) {
          return false;
        }
      }

      return true;
    });
  }, [unityKpis, searchTerm, selectedUnityStep, selectedQualityFilter, selectedAccessFilter]);

  const stats = useMemo(() => {
    const total = unityKpis.length;
    const qualityGreen = unityKpis.filter((k) => k.qualityTrafficLight === "green").length;
    const qualityYellow = unityKpis.filter((k) => k.qualityTrafficLight === "yellow").length;
    const qualityRed = unityKpis.filter((k) => k.qualityTrafficLight === "red").length;
    const qualityUnrated = unityKpis.filter(
      (k) => !k.qualityTrafficLight || k.qualityTrafficLight === "unrated"
    ).length;

    const accessGreen = unityKpis.filter((k) => k.accessTrafficLight === "green").length;
    const accessRed = unityKpis.filter((k) => k.accessTrafficLight === "red").length;
    const notesCount = unityKpis.filter((k) => k.comments && k.comments.trim().length > 0).length;

    return {
      total,
      qualityGreen,
      qualityYellow,
      qualityRed,
      qualityUnrated,
      accessGreen,
      accessRed,
      notesCount,
    };
  }, [unityKpis]);

  // Authentic Google Sheet cell fill hex colors & harmonized badge classes
  const getQualityBadge = (kpi: KPI) => {
    const hex = kpi.qualityColor || "#ffffff";
    const label = kpi.dataQuality || "Pending Assessment";
    const status = kpi.qualityTrafficLight || "unrated";
    const pillClasses =
      status === "green"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : status === "yellow"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : status === "red"
        ? "bg-rose-50 text-rose-800 border-rose-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
    return { hex, label, status, pillClasses };
  };

  const getAccessBadge = (kpi: KPI) => {
    const hex = kpi.accessColor || "#d9ead3";
    const label = kpi.dataAccess || "Direct System Access";
    const status = kpi.accessTrafficLight || "green";
    const pillClasses =
      status === "green"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : "bg-rose-50 text-rose-800 border-rose-200";
    return { hex, label, status, pillClasses };
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. LIGHT RBM HEADER PANEL (Aligned with dashboards.endmalaria.org/en) */}
      <div className="bg-white border border-gray-200 border-t-4 border-t-[#93d573] rounded-lg p-6 shadow-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded bg-[#F2F8FF] text-[#2563eb] border border-blue-200 font-mono text-[11px] font-bold uppercase tracking-wider">
                Unity 30 &amp; Big Push Governance
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-[#111827]">
              Data Quality &amp; Data Availability Matrix
            </h2>
            <p className="text-gray-600 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Overview of baseline data quality, reporting system availability, and working group
              methodological notes across all monitored indicators.
            </p>
          </div>

          {/* Right: RBM Summary Panels (#3365e3, #93d573, #f5f5f5) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="flex items-stretch gap-2 flex-wrap" data-name="summary-panels">
              <div
                className="rounded px-3.5 py-2.5 flex flex-col justify-between text-white min-w-[95px]"
                style={{ backgroundColor: "#93d573" }}
              >
                <div className="text-xl font-mono font-bold leading-none">{stats.qualityGreen}</div>
                <span className="text-[10px] font-medium mt-1 block text-white">High Quality</span>
              </div>
              <div
                className="rounded px-3.5 py-2.5 flex flex-col justify-between text-white min-w-[95px]"
                style={{ backgroundColor: "#3365e3" }}
              >
                <div className="text-xl font-mono font-bold leading-none">
                  {stats.total > 0 ? Math.round((stats.accessGreen / stats.total) * 100) : 0}%
                </div>
                <span className="text-[10px] font-medium mt-1 block text-white">Direct Access</span>
              </div>
              <div
                className="rounded px-3.5 py-2.5 flex flex-col justify-between min-w-[95px]"
                style={{ backgroundColor: "#f5f5f5" }}
              >
                <div className="text-xl font-mono font-bold leading-none text-amber-700">
                  {stats.qualityYellow}
                </div>
                <span className="text-[10px] font-medium mt-1 block text-gray-700">Moderate</span>
              </div>
              <div
                className="rounded px-3.5 py-2.5 flex flex-col justify-between min-w-[95px]"
                style={{ backgroundColor: "#f5f5f5" }}
              >
                <div className="text-xl font-mono font-bold leading-none text-rose-700">
                  {stats.qualityRed}
                </div>
                <span className="text-[10px] font-medium mt-1 block text-gray-700">
                  Limitations
                </span>
              </div>
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

          {/* Search box */}
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder="Search by indicator statement, definition, source, or technical comments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border-2 border-gray-300 rounded-md px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2563eb] font-sans h-[34.5px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedUnityStep}
              onChange={(e) => setSelectedUnityStep(e.target.value)}
              aria-label="Filter by Unity 30 Step"
              className="bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-md px-2.5 text-xs text-gray-700 font-sans font-medium focus:outline-none focus:border-[#2563eb] cursor-pointer h-[34.5px]"
            >
              <option value="all">All Unity 30 Steps</option>
              <option value="U.1">U.1 Engage</option>
              <option value="U.2">U.2 Align</option>
              <option value="U.3">U.3 Enable</option>
              <option value="U.4">U.4 Act</option>
              <option value="U.5">U.5 Impact</option>
            </select>

            <select
              value={selectedQualityFilter}
              onChange={(e) => setSelectedQualityFilter(e.target.value)}
              aria-label="Filter by Data Quality"
              className="bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-md px-2.5 text-xs text-gray-700 font-sans font-medium focus:outline-none focus:border-[#2563eb] cursor-pointer h-[34.5px]"
            >
              <option value="all">Data Quality: All ({stats.total})</option>
              <option value="green">Data Quality: High ({stats.qualityGreen})</option>
              <option value="yellow">Data Quality: Moderate ({stats.qualityYellow})</option>
              <option value="red">Data Quality: Limitations ({stats.qualityRed})</option>
              <option value="unrated">Data Quality: Unrated ({stats.qualityUnrated})</option>
            </select>

            <select
              value={selectedAccessFilter}
              onChange={(e) => setSelectedAccessFilter(e.target.value)}
              aria-label="Filter by Data Availability"
              className="bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-md px-2.5 text-xs text-gray-700 font-sans font-medium focus:outline-none focus:border-[#2563eb] cursor-pointer h-[34.5px]"
            >
              <option value="all">Data Availability: All ({stats.total})</option>
              <option value="green">Data Availability: Direct ({stats.accessGreen})</option>
              <option value="red">Data Availability: Restricted ({stats.accessRed})</option>
            </select>

            {(searchTerm ||
              selectedUnityStep !== "all" ||
              selectedQualityFilter !== "all" ||
              selectedAccessFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedUnityStep("all");
                  setSelectedQualityFilter("all");
                  setSelectedAccessFilter("all");
                }}
                className="px-3 h-[34.5px] rounded-md bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-sans text-xs font-medium transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Row Border Color Key */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-[10px] font-mono text-gray-600">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold text-gray-500 uppercase tracking-wider">
              Tier Border Key:
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: "#FFC72C" }}
              />{" "}
              Save Lives
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: "#84cc16" }}
              />{" "}
              Ecosystem
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: "#10b981" }}
              />{" "}
              Broader Goals
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: "#1F429B" }}
              />{" "}
              U.1 Engage
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: "#1E62D0" }}
              />{" "}
              U.2 Align
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: "#00A3E0" }}
              />{" "}
              U.3 Enable
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: "#8c9c1b" }}
              />{" "}
              U.4 Act
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: "#43B02A" }}
              />{" "}
              U.5 Impact
            </span>
          </div>
          <span>
            Showing <strong className="text-[#111827]">{filteredKpis.length}</strong> of{" "}
            {unityKpis.length} indicators
          </span>
        </div>
      </div>

      {/* 3. STREAMLINED MATRIX TABLE */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table text-left text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4 w-[32%] min-w-[220px]">Indicator Statement</th>
                <th className="py-3.5 px-4 w-[16%] min-w-[130px]">Source / Cadence</th>
                <th className="py-3.5 px-4 w-[13%] min-w-[110px] text-center">
                  Data Quality
                </th>
                <th className="py-3.5 px-4 w-[13%] min-w-[110px] text-center">
                  Availability
                </th>
                <th className="py-3.5 px-4 w-[26%] min-w-[200px]">
                  Working Group Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-sans">
              {filteredKpis.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 font-mono text-xs">
                    No indicators match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredKpis.map((kpi) => {
                  const qBadge = getQualityBadge(kpi);
                  const aBadge = getAccessBadge(kpi);
                  const stratColor = getKPIStrategicColor(kpi);
                  const stratLabel = getKPIStrategicLabel(kpi);

                  const tlEval = evaluateKPITrafficLight(kpi);
                  const accent =
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
                      onClick={() => onOpenClassificationModal?.(kpi)}
                      className="hover:bg-[#F2F8FF]/60 transition-colors group cursor-pointer"
                    >
                      {/* 1. Indicator Statement with Left Tier Color Bar & Inline Italic i */}
                      <td className="py-3.5 px-4 align-top relative">
                        <div
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded"
                          style={{ backgroundColor: stratColor }}
                        />
                        <div className="pl-2 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {kpi.kpiCode && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#F2F8FF] text-[#2563eb] border border-blue-200">
                                {kpi.kpiCode}
                              </span>
                            )}
                            <span className="text-[9px] font-mono font-extrabold uppercase tracking-wider text-gray-500">
                              {stratLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <h4 className="font-normal uppercase tracking-tight text-[#111827] group-hover:text-[#2563eb] transition-colors leading-snug text-xs inline">
                              {kpi.name}
                            </h4>
                            {onOpenClassificationModal && (
                              <InfoIconButton
                                size="xs"
                                tooltipTitle={`${kpi.kpiCode || kpi.id} • ${stratLabel}`}
                                tooltipBadge={tlEval.badgeLabel}
                                accent={accent}
                                onClick={() => onOpenClassificationModal(kpi)}
                                ariaLabel={`View rationale and classification for ${kpi.name}`}
                                widthClass="w-72"
                                tooltipContent={
                                  <div className="space-y-1.5">
                                    <div className="font-mono font-bold text-white text-[10px]">
                                      {tlEval.ruleApplied}
                                    </div>
                                    <p className="text-[10px] text-blue-100/90 leading-relaxed">
                                      {tlEval.varianceSummary}
                                    </p>
                                    <div className="text-[9.5px] font-mono text-[#7dd3fc] pt-1 border-t border-white/10">
                                      Click italic (i) for full indicator specification
                                    </div>
                                  </div>
                                }
                              />
                            )}
                          </div>
                          {(kpi.definition || kpi.description) && (
                            <p className="text-[11px] text-gray-600 font-sans leading-relaxed">
                              {kpi.definition || kpi.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 2. Source / Cadence */}
                      <td className="py-3.5 px-4 align-top font-mono text-[11px] text-gray-700 leading-tight">
                        <div
                          className="font-semibold text-[#3365e3] truncate max-w-full"
                          title={kpi.source}
                        >
                          {kpi.source || "RBM Systems"}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">
                          {kpi.cadence || "Annual"}
                        </div>
                      </td>

                      {/* 3. Data Quality */}
                      <td className="py-3.5 px-4 align-top text-center">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border shadow-2xs font-mono text-[10px] font-bold ${qBadge.pillClasses}`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shadow-xs inline-block shrink-0"
                            style={{ backgroundColor: qBadge.hex }}
                          />
                          <span className="whitespace-nowrap">{qBadge.label}</span>
                        </div>
                      </td>

                      {/* 4. Data Availability */}
                      <td className="py-3.5 px-4 align-top text-center">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border shadow-2xs font-mono text-[10px] font-bold ${aBadge.pillClasses}`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shadow-xs inline-block shrink-0"
                            style={{ backgroundColor: aBadge.hex }}
                          />
                          <span className="whitespace-nowrap">{aBadge.label}</span>
                        </div>
                      </td>

                      {/* 5. Limitations / Comments */}
                      <td className="py-3.5 px-4 align-top text-[11px] leading-relaxed">
                        {kpi.comments ? (
                          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-amber-950 font-mono text-[10.5px] break-words whitespace-normal leading-relaxed">
                            {kpi.comments}
                          </div>
                        ) : (
                          <span className="text-gray-400 font-mono text-[10px] italic">
                            No specific technical limitation noted
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataQualityTableView;
