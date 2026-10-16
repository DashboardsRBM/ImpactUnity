import {
  KPI,
  KPICategory,
  SheetSyncLog,
  DataQualityRating,
  DataAccessLevel,
  UnitySubcategory,
  BigPushPillarSpec,
  SheetTermsMap,
} from "@/src/types";
import { evaluateKPITrafficLight } from "@/src/lib/kpiTrafficLight";

// Official Google Sheet configuration
export const DEFAULT_SPREADSHEET_ID =
  "1a8nZmfvbIJrfyoe5sAGbobmScvNPZe0eA8J77-FEGxM";
export const SPREADSHEET_ID = DEFAULT_SPREADSHEET_ID;

export const TARGET_SHEET_TABS = [
  "Unity 30 KPIs Final",
  "Terms and cascade",
  "Big Push KPIs",
];

const STORAGE_KEY_CUSTOM_SHEET = "rbm_custom_google_sheet_link_or_id";

export const extractSpreadsheetId = (input: string): string => {
  if (!input) return DEFAULT_SPREADSHEET_ID;
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return DEFAULT_SPREADSHEET_ID;
};

export const getActiveSpreadsheetId = (): string => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_SHEET);
    if (saved) return extractSpreadsheetId(saved);
  }
  return DEFAULT_SPREADSHEET_ID;
};

export const getActiveSpreadsheetInput = (): string => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_SHEET);
    if (saved) return saved;
  }
  return `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`;
};

export const setActiveSpreadsheetInput = (input: string) => {
  if (typeof window !== "undefined") {
    if (input && input.trim()) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_SHEET, input.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_SHEET);
    }
  }
};

/**
 * Server-side / fallback helper to fetch live cell background colors for Columns U & V
 * directly from Google Sheets htmlview/sheet.
 */
async function fetchLiveCellColorsDirect(
  spreadsheetId: string,
  tabName: string
): Promise<Record<string, { colUColor: string; colVColor: string }>> {
  const colorMap: Record<string, { colUColor: string; colVColor: string }> = {};
  try {
    let gid = "172900380";
    const indexRes = await fetch(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`,
      { cache: "no-store" }
    );
    if (indexRes.ok) {
      const indexHtml = await indexRes.text();
      const matches = [
        ...indexHtml.matchAll(
          /items\.push\(\{name:\s*"([^"]+)",\s*pageUrl:\s*"[^"]+",\s*gid:\s*"([^"]+)"/g
        ),
      ];
      const found = matches.find(
        (m) => m[1].trim().toLowerCase() === tabName.trim().toLowerCase()
      );
      if (found && found[2]) {
        gid = found[2];
      }
    }

    const sheetHtmlRes = await fetch(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview/sheet?headers=true&gid=${gid}`,
      { cache: "no-store" }
    );
    if (!sheetHtmlRes.ok) return colorMap;

    const html = await sheetHtmlRes.text();
    const classBg: Record<string, string> = {};
    for (const m of html.matchAll(
      /\.waffle\s+\.(s\d+)\{[^}]*background-color:\s*(#[0-9a-fA-F]{3,6})/g
    )) {
      classBg[m[1]] = m[2].toLowerCase();
    }

    const trs = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
    for (const tr of trs) {
      const tds = [...tr[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
      if (tds.length > 21) {
        const col0Text = tds[0][2].replace(/<[^>]+>/g, "").trim();
        if (col0Text.toUpperCase().startsWith("KPI.")) {
          const resolveTdBg = (tdMatch: RegExpMatchArray): string => {
            const clsMatch = tdMatch[1].match(/class="([^"]+)"/);
            if (!clsMatch) return "#ffffff";
            for (const c of clsMatch[1].split(/\s+/)) {
              if (classBg[c]) return classBg[c];
            }
            return "#ffffff";
          };
          colorMap[col0Text.toUpperCase()] = {
            colUColor: resolveTdBg(tds[20]),
            colVColor: resolveTdBg(tds[21]),
          };
        }
      }
    }
  } catch (err) {
    // Non-fatal in browser if CORS blocks htmlview; /api/sheets handles it on server
  }
  return colorMap;
}

/**
 * Fetch values for a given tab from the public Google Sheet.
 * In browser context, queries /api/sheets first (which merges GViz + live Col U/V cell colors),
 * and falls back to direct GViz fetch.
 */
export const fetchSheetTab = async (
  sheetName: string,
  spreadsheetId: string = getActiveSpreadsheetId()
): Promise<any[][] | null> => {
  const targetId = extractSpreadsheetId(spreadsheetId);

  // 1. In browser, prefer /api/sheets so server-side htmlview color extraction is included without CORS issues
  if (typeof window !== "undefined") {
    try {
      const apiRes = await fetch(
        `/api/sheets?spreadsheetId=${encodeURIComponent(
          targetId
        )}&tab=${encodeURIComponent(sheetName)}`,
        { cache: "no-store" }
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
          return data.rows;
        }
      }
    } catch (e) {
      // Fall back to direct GViz below
    }
  }

  // 2. Direct fetch from Google Visualization endpoint (used on server SSR or as browser fallback)
  try {
    const isUnityFinalTab = sheetName.toLowerCase().includes("unity 30");
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${targetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(
      sheetName
    )}`;

    const [res, cellColorMap] = await Promise.all([
      fetch(gvizUrl, { cache: "no-store" }),
      typeof window === "undefined" && isUnityFinalTab
        ? fetchLiveCellColorsDirect(targetId, sheetName)
        : Promise.resolve({} as Record<string, { colUColor: string; colVColor: string }>),
    ]);

    if (res.ok) {
      const text = await res.text();
      if (text.includes("google.visualization.Query.setResponse")) {
        const startIdx = text.indexOf("setResponse(");
        const endIdx = text.lastIndexOf(");");
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          const jsonString = text.substring(startIdx + 12, endIdx);
          const parsed = JSON.parse(jsonString);
          if (parsed.table && parsed.table.rows) {
            const rows: any[][] = [];
            if (
              parsed.table.cols &&
              parsed.table.cols.some(
                (c: any) => c && c.label && String(c.label).trim() !== ""
              )
            ) {
              rows.push(
                parsed.table.cols.map((c: any) =>
                  c && c.label ? String(c.label).trim() : ""
                )
              );
            }
            parsed.table.rows.forEach((r: any) => {
              if (r.c) {
                const rowVals = r.c.map((cell: any) =>
                  cell
                    ? cell.v !== null && cell.v !== undefined
                      ? cell.v
                      : cell.f || ""
                    : ""
                );
                const codeKey = String(rowVals[0] || "")
                  .trim()
                  .toUpperCase();
                if (codeKey && cellColorMap[codeKey]) {
                  while (rowVals.length < 22) rowVals.push("");
                  if (!rowVals[20]) rowVals[20] = cellColorMap[codeKey].colUColor;
                  if (!rowVals[21]) rowVals[21] = cellColorMap[codeKey].colVColor;
                }
                rows.push(rowVals);
              }
            });
            if (rows.length > 0) {
              return rows;
            }
          }
        }
      }
    }
  } catch (err) {
    // Handled in caller
  }

  return null;
};

const norm = (s: any) =>
  String(s || "")
    .toLowerCase()
    .trim();

interface HeaderMap {
  idIdx: number;
  nameIdx: number;
  defIdx: number;
  calcIdx: number;
  baselineYearIdx: number;
  baselineIdx: number;
  targetIdx: number;
  valueIdx: number;
  cadenceIdx: number;
  ownerIdx: number;
  reporterIdx: number;
  qualityIdx: number;
  accessIdx: number;
  nuanceIdx: number;
  blockIdx: number;
  pillarIdx: number;
  sourceIdx: number;
  subKpiIdx: number;
  unitsIdx: number;
  y2024Idx: number;
  y2025Idx: number;
  y2026Idx: number;
  y2027Idx: number;
  y2028Idx: number;
  y2029Idx: number;
  y2030Idx: number;
}

const parseHeaders = (headerRow: any[]): HeaderMap => {
  const map: HeaderMap = {
    idIdx: -1,
    nameIdx: -1,
    defIdx: -1,
    calcIdx: -1,
    baselineYearIdx: -1,
    baselineIdx: -1,
    targetIdx: -1,
    valueIdx: -1,
    cadenceIdx: -1,
    ownerIdx: -1,
    reporterIdx: -1,
    qualityIdx: -1,
    accessIdx: -1,
    nuanceIdx: -1,
    blockIdx: -1,
    pillarIdx: -1,
    sourceIdx: -1,
    subKpiIdx: -1,
    unitsIdx: -1,
    y2024Idx: -1,
    y2025Idx: -1,
    y2026Idx: -1,
    y2027Idx: -1,
    y2028Idx: -1,
    y2029Idx: -1,
    y2030Idx: -1,
  };

  headerRow.forEach((col, idx) => {
    const text = norm(col);
    if (
      text.includes("kpi code") ||
      text.includes("kpi id") ||
      text.includes("kpi.") ||
      text === "kpi" ||
      text === "id" ||
      text === "code"
    ) {
      if (map.idIdx === -1) map.idIdx = idx;
    } else if (
      text.includes("statement") ||
      text.includes("kpi statement") ||
      text.includes("indicator") ||
      text.includes("metric name") ||
      text.includes("kpi name") ||
      text === "name"
    ) {
      if (map.nameIdx === -1) map.nameIdx = idx;
    } else if (text.includes("definition") || text.includes("description")) {
      if (map.defIdx === -1) map.defIdx = idx;
    } else if (
      text.includes("formula") ||
      text.includes("calculation") ||
      text.includes("method") ||
      text.includes("numerator")
    ) {
      if (map.calcIdx === -1) map.calcIdx = idx;
    } else if (
      text.includes("quality") ||
      text.includes("rating") ||
      text.includes("data quality") ||
      text.includes("asesmment") ||
      text.includes("assessment")
    ) {
      if (map.qualityIdx === -1) map.qualityIdx = idx;
    } else if (text.includes("baseline year")) {
      if (map.baselineYearIdx === -1) map.baselineYearIdx = idx;
    } else if (
      (text.includes("baseline") ||
        text.includes("baseline value") ||
        text.includes("2025 baseline") ||
        text === "2025") &&
      !text.includes("quality") &&
      !text.includes("asesmment") &&
      !text.includes("assessment") &&
      !text.includes("year")
    ) {
      if (map.baselineIdx === -1) map.baselineIdx = idx;
    } else if (
      text.includes("target") ||
      text.includes("2030 target") ||
      text === "target (2030)"
    ) {
      if (map.targetIdx === -1) map.targetIdx = idx;
    } else if (
      text.includes("reported") ||
      text.includes("current value") ||
      text.includes("latest") ||
      text === "value"
    ) {
      if (map.valueIdx === -1) map.valueIdx = idx;
    } else if (text.includes("cadence") || text.includes("frequency")) {
      if (map.cadenceIdx === -1) map.cadenceIdx = idx;
    } else if (text === "owner" || text.includes("archetype")) {
      if (map.ownerIdx === -1) map.ownerIdx = idx;
    } else if (text.includes("who reports") || text === "reporter") {
      if (map.reporterIdx === -1) map.reporterIdx = idx;
    } else if (
      text.includes("access") ||
      text.includes("accessibility") ||
      text.includes("repository")
    ) {
      if (map.accessIdx === -1) map.accessIdx = idx;
    } else if (
      text.includes("nuance") ||
      text.includes("notes") ||
      text.includes("comment")
    ) {
      if (map.nuanceIdx === -1) map.nuanceIdx = idx;
    } else if (
      text.includes("building block") ||
      text.includes("unity step") ||
      text.includes("block") ||
      text === "unity"
    ) {
      if (map.blockIdx === -1) map.blockIdx = idx;
    } else if (
      text.includes("pillar") ||
      text.includes("big push pillar") ||
      text.includes("pillar no")
    ) {
      if (map.pillarIdx === -1) map.pillarIdx = idx;
    } else if (text.includes("source") || text.includes("database")) {
      if (map.sourceIdx === -1) map.sourceIdx = idx;
    } else if (text.includes("unit")) {
      if (map.unitsIdx === -1) map.unitsIdx = idx;
    } else if (text === "2024") {
      map.y2024Idx = idx;
    } else if (text === "2025") {
      map.y2025Idx = idx;
    } else if (text === "2026") {
      map.y2026Idx = idx;
      if (map.valueIdx === -1) map.valueIdx = idx;
    } else if (text === "2027") {
      map.y2027Idx = idx;
    } else if (text === "2028") {
      map.y2028Idx = idx;
    } else if (text === "2029") {
      map.y2029Idx = idx;
    } else if (text === "2030") {
      map.y2030Idx = idx;
    }
  });

  // Structural detection for Unity 30 KPIs Final layout (Cols A..W):
  if (norm(headerRow[1]).includes("kpi statement")) {
    map.idIdx = 0;           // Col A: KPI Code / Group Header
    map.nameIdx = 1;         // Col B: KPI Statement
    map.defIdx = 2;          // Col C: Definition
    map.blockIdx = 3;        // Col D: Unity
    map.subKpiIdx = 4;       // Col E: Sub KPIs
    map.ownerIdx = 5;        // Col F: Owner
    map.sourceIdx = 6;       // Col G: Source
    map.cadenceIdx = 7;      // Col H: Cadence
    map.reporterIdx = 8;     // Col I: Who reports on this
    map.baselineYearIdx = 9; // Col J: Baseline year (2015, 2025, 2026)
    map.baselineIdx = 10;    // Col K: Baseline Value
    map.targetIdx = 11;      // Col L: 2030 Target
    map.unitsIdx = 12;       // Col M: Units
    map.valueIdx = 13;       // Col N: 2026 Reported
    map.y2026Idx = 13;       // Col N: 2026
    map.y2027Idx = 14;       // Col O: 2027
    map.y2028Idx = 15;       // Col P: 2028
    map.y2029Idx = 16;       // Col Q: 2029
    map.y2030Idx = 17;       // Col R: 2030
    map.qualityIdx = 20;     // Col U: Data quality assessment
    map.accessIdx = 21;      // Col V: Data accessibility
    map.nuanceIdx = 22;      // Col W: Comments
  }

  return map;
};

const parseQualityCell = (
  val: any
): {
  rating: DataQualityRating;
  trafficLight: "green" | "yellow" | "red" | "unrated";
  color: string;
} => {
  const s = norm(val);
  if (
    s.includes("3a7d22") ||
    s.includes("85f034") ||
    s.includes("d9ead3") ||
    s.includes("high") ||
    s.includes("green") ||
    s.includes("verified")
  ) {
    return { rating: "high", trafficLight: "green", color: "#3a7d22" };
  }
  if (
    s.includes("ffd400") ||
    s.includes("f5f0cb") ||
    s.includes("yellow") ||
    s.includes("moderate")
  ) {
    return { rating: "moderate", trafficLight: "yellow", color: "#ffd400" };
  }
  if (
    s.includes("ffcc99") ||
    s.includes("ff0000") ||
    s.includes("low") ||
    s.includes("red") ||
    s.includes("gap") ||
    s.includes("restricted")
  ) {
    return { rating: "low", trafficLight: "red", color: "#ffcc99" };
  }
  return { rating: "unrated", trafficLight: "unrated", color: "#ffffff" };
};

const parseAccessCell = (
  val: any
): {
  level: DataAccessLevel;
  trafficLight: "green" | "yellow" | "red" | "unrated";
  color: string;
} => {
  const s = norm(val);
  if (
    s.includes("ffcc99") ||
    s.includes("ff0000") ||
    s.includes("restrict") ||
    s.includes("red") ||
    s.includes("closed")
  ) {
    return { level: "restricted", trafficLight: "red", color: "#ffcc99" };
  }
  if (
    s.includes("ffd400") ||
    s.includes("yellow") ||
    s.includes("manual")
  ) {
    return { level: "manual", trafficLight: "yellow", color: "#ffd400" };
  }
  if (
    s.includes("3a7d22") ||
    s.includes("access") ||
    s.includes("green") ||
    s.includes("public") ||
    s.includes("direct")
  ) {
    return { level: "accessible", trafficLight: "green", color: "#3a7d22" };
  }
  return { level: "accessible", trafficLight: "green", color: "#3a7d22" };
};

export const parseOptionalNum = (val: any): number | undefined => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "number") return isNaN(val) ? undefined : val;
  const str = String(val).replace(/["']/g, "").trim();
  if (str === "" || str === "-" || str === "N/A" || str === "TBD")
    return undefined;
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
};

const mapSectionGroupToCategory = (
  rawGroupHeader: string
): { group: string; category: KPICategory } => {
  const cleaned = rawGroupHeader.replace(/\(\s*\d+\s*\)/g, "").trim();
  const lower = cleaned.toLowerCase();
  if (lower.includes("secretariat")) {
    return { group: "Secretariat", category: "secretariat" };
  }
  if (lower.includes("partnership")) {
    return { group: "Partnership", category: "partnership" };
  }
  if (lower.includes("ecosystem")) {
    return { group: "Ecosystem and Member Partners", category: "ecosystem" };
  }
  if (lower.includes("broader")) {
    return { group: "Broader Malaria Health Goals", category: "broader_goals" };
  }
  if (lower.includes("save lives")) {
    return { group: "Save Lives", category: "save_lives" };
  }
  return { group: cleaned || "Unity 30", category: "unity" };
};

const mapUnityStepToSubcategory = (rawUnity: string): UnitySubcategory => {
  const s = rawUnity.toLowerCase();
  if (s.includes("u.1") || s.includes("engage")) return "engage";
  if (s.includes("u.2") || s.includes("align")) return "align";
  if (s.includes("u.3") || s.includes("enable")) return "enable";
  if (s.includes("u.4") || s.includes("act")) return "act";
  if (s.includes("u.5") || s.includes("impact")) return "impact";
  return "act";
};

/**
 * Fetches and parses the 'Terms and cascade' tab directly from the Google Sheet.
 */
export const fetchSheetTerms = async (
  spreadsheetId: string = getActiveSpreadsheetId()
): Promise<SheetTermsMap> => {
  const terms: SheetTermsMap = {};
  try {
    const rows = await fetchSheetTab("Terms and cascade", spreadsheetId);
    if (!rows) return terms;
    for (const row of rows) {
      const key = String(row[0] || "").trim();
      const desc = String(row[1] || "")
        .trim()
        .replace(/\bUnite\b/gi, "Unity 30");
      if (key && desc && key.toLowerCase() !== "key terms") {
        terms[key] = desc;
      }
    }
  } catch (err) {
    // Non-fatal
  }
  return terms;
};

/**
 * Fetches and parses the 'Big Push KPIs' tab directly from the Google Sheet.
 */
export const fetchBigPushPillarsFromSheet = async (
  spreadsheetId: string = getActiveSpreadsheetId()
): Promise<BigPushPillarSpec[]> => {
  const pillars: BigPushPillarSpec[] = [];
  try {
    const rows = await fetchSheetTab("Big Push KPIs", spreadsheetId);
    if (!rows || rows.length < 7) return pillars;

    let headerIdx = 6;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const rowStr = (rows[i] || []).map((c: any) => norm(c)).join(" ");
      if (rowStr.includes("big push pillar") && rowStr.includes("pillar actions")) {
        headerIdx = i;
        break;
      }
    }

    let currentPillar: BigPushPillarSpec | null = null;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c: any) => !String(c || "").trim())) continue;

      const rawPillarTitle = String(row[0] || "").trim();
      const rawPillarActions = String(row[1] || "").trim();
      const rawRbmCategory = String(row[2] || "").trim();
      const rawStatedMetric = String(row[3] || "").trim();
      const rawProposedKpi = String(row[4] || "").trim();
      const rawBcgMapped = String(row[5] || "").trim();
      const rawBcgMissing = String(row[6] || "").trim();
      const rawRationale = String(row[7] || "").trim();
      const rawWgComments = String(row[8] || "").trim();

      if (rawPillarTitle && /^\d+\./.test(rawPillarTitle)) {
        const numMatch = rawPillarTitle.match(/^(\d+)\./);
        const pillarNum = numMatch ? parseInt(numMatch[1], 10) : pillars.length + 1;
        currentPillar = {
          id: `pillar-${pillarNum}`,
          pillarNum,
          title: rawPillarTitle.replace(/\s+/g, " ").trim(),
          actions: rawPillarActions,
          proposedKPIs: [],
        };
        pillars.push(currentPillar);
      }

      if (
        currentPillar &&
        (rawProposedKpi || rawStatedMetric || rawRbmCategory)
      ) {
        currentPillar.proposedKPIs.push({
          rbmCategory: rawRbmCategory,
          statedMetric: rawStatedMetric,
          proposedKpi: rawProposedKpi,
          bcgMapped: rawBcgMapped,
          bcgMissing: rawBcgMissing,
          rationale: rawRationale,
          wgComments: rawWgComments,
        });
      }
    }
  } catch (err) {
    // Non-fatal
  }
  return pillars;
};

/**
 * Synchronizes and constructs the complete KPI dataset directly from the Google Sheet
 * ('Unity 30 KPIs Final' tab) with zero hardcoded data.
 */
export const syncKPIsFromGoogleSheets = async (
  _currentKPIs: KPI[] = [],
  customSpreadsheetInput?: string
): Promise<{
  updatedKPIs: KPI[];
  terms: SheetTermsMap;
  bigPushPillars: BigPushPillarSpec[];
  log: SheetSyncLog;
}> => {
  const activeSpreadsheetId = extractSpreadsheetId(
    customSpreadsheetInput || getActiveSpreadsheetId()
  );

  const sheetsChecked: string[] = [];
  const flaggedLowQuality: string[] = [];
  const flaggedRestricted: string[] = [];
  const missingEntries: string[] = [];
  const parsedKPIs: KPI[] = [];

  const [unityRows, terms, bigPushPillars] = await Promise.all([
    fetchSheetTab("Unity 30 KPIs Final", activeSpreadsheetId),
    fetchSheetTerms(activeSpreadsheetId),
    fetchBigPushPillarsFromSheet(activeSpreadsheetId),
  ]);

  if (Object.keys(terms).length > 0) sheetsChecked.push("Terms and cascade");
  if (bigPushPillars.length > 0) sheetsChecked.push("Big Push KPIs");

  if (unityRows && unityRows.length >= 2) {
    sheetsChecked.push("Unity 30 KPIs Final");

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, unityRows.length); i++) {
      const rowStr = (unityRows[i] || [])
        .map((c: any) => String(c).toLowerCase())
        .join(" ");
      if (
        rowStr.includes("statement") ||
        rowStr.includes("definition") ||
        rowStr.includes("kpi code")
      ) {
        headerRowIdx = i;
        break;
      }
    }

    const headerMap = parseHeaders(unityRows[headerRowIdx]);
    let currentGroup = "Secretariat";
    let currentCategory: KPICategory = "secretariat";

    for (let r = headerRowIdx + 1; r < unityRows.length; r++) {
      const row = unityRows[r];
      if (!row || row.length === 0) continue;

      const rawCode =
        headerMap.idIdx !== -1 ? String(row[headerMap.idIdx] || "").trim() : "";
      const rawName =
        headerMap.nameIdx !== -1
          ? String(row[headerMap.nameIdx] || "")
              .trim()
              .replace(/\btrough\b/gi, "through")
              .replace(/\.\s*$/, "")
          : "";

      if (!rawCode && !rawName) continue;

      // Detect section header rows in Column A (e.g., "Secretariat (5)", "Partnership (3)", "Ecosystem and Member Partners (8)", "Broader Malaria Health Goals (2)", "Save Lives (2)")
      if (!rawName && !rawCode.toUpperCase().startsWith("KPI.")) {
        const mapped = mapSectionGroupToCategory(rawCode);
        currentGroup = mapped.group;
        currentCategory = mapped.category;
        continue;
      }

      if (!rawCode.toUpperCase().startsWith("KPI.") && !rawName) continue;

      const kpiCode = rawCode || `KPI.${String(parsedKPIs.length + 1).padStart(2, "0")}`;
      const kpiId =
        kpiCode === "KPI.19"
          ? "save-lives-mortality"
          : kpiCode === "KPI.20"
          ? "save-lives-morbidity"
          : kpiCode.toLowerCase().replace(".", "-");

      const rawDef =
        headerMap.defIdx !== -1
          ? String(row[headerMap.defIdx] || "")
              .trim()
              .replace(/\btrough\b/gi, "through")
          : "";
      const rawUnity =
        headerMap.blockIdx !== -1
          ? String(row[headerMap.blockIdx] || "").trim()
          : "";
      const rawSubKpi =
        headerMap.subKpiIdx !== -1
          ? String(row[headerMap.subKpiIdx] || "").trim()
          : "";
      const rawOwner =
        headerMap.ownerIdx !== -1
          ? String(row[headerMap.ownerIdx] || "").trim()
          : "";
      const rawSource =
        headerMap.sourceIdx !== -1
          ? String(row[headerMap.sourceIdx] || "").trim()
          : "";
      const rawCadence =
        headerMap.cadenceIdx !== -1
          ? String(row[headerMap.cadenceIdx] || "").trim()
          : "";
      const rawReporter =
        headerMap.reporterIdx !== -1
          ? String(row[headerMap.reporterIdx] || "").trim()
          : "";
      const rawUnits =
        headerMap.unitsIdx !== -1
          ? String(row[headerMap.unitsIdx] || "")
              .replace(/["']/g, "")
              .trim()
          : "";
      const rawNuance =
        headerMap.nuanceIdx !== -1
          ? String(row[headerMap.nuanceIdx] || "").trim()
          : "";

      const parsedBaselineYear =
        headerMap.baselineYearIdx !== -1 &&
        row[headerMap.baselineYearIdx] !== undefined
          ? parseOptionalNum(row[headerMap.baselineYearIdx])
          : undefined;

      const baselineVal =
        headerMap.baselineIdx !== -1 && row[headerMap.baselineIdx] !== undefined
          ? parseOptionalNum(row[headerMap.baselineIdx])
          : undefined;

      const targetVal =
        headerMap.targetIdx !== -1 && row[headerMap.targetIdx] !== undefined
          ? parseOptionalNum(row[headerMap.targetIdx])
          : undefined;

      const reportedVal =
        headerMap.valueIdx !== -1 && row[headerMap.valueIdx] !== undefined
          ? parseOptionalNum(row[headerMap.valueIdx])
          : undefined;

      const rawQualityVal =
        headerMap.qualityIdx !== -1 ? row[headerMap.qualityIdx] : "";
      const rawAccessVal =
        headerMap.accessIdx !== -1 ? row[headerMap.accessIdx] : "";

      const qualityParsed = parseQualityCell(rawQualityVal);
      const accessParsed = parseAccessCell(rawAccessVal);

      if (qualityParsed.rating === "low") {
        flaggedLowQuality.push(`${kpiCode} (Unity 30 KPIs Final)`);
      }
      if (accessParsed.level === "restricted") {
        flaggedRestricted.push(`${kpiCode} (Unity 30 KPIs Final)`);
      }

      const baselineYear =
        parsedBaselineYear !== undefined &&
        parsedBaselineYear >= 2015 &&
        parsedBaselineYear <= 2030
          ? Math.round(parsedBaselineYear)
          : currentCategory === "save_lives"
          ? 2015
          : 2025;

      const resolvedUnit =
        rawUnits || (rawName.trim().startsWith("#") ? "#" : "%");

      // Build yearValues strictly from reported cells in the Google Sheet (2024..2030)
      const yearValues: Record<number, number> = {};
      if (baselineVal !== undefined && baselineYear < 2026) {
        yearValues[baselineYear] = baselineVal;
      }
      if (headerMap.y2024Idx !== -1 && row[headerMap.y2024Idx] !== undefined) {
        const v24 = parseOptionalNum(row[headerMap.y2024Idx]);
        if (v24 !== undefined) yearValues[2024] = v24;
      }
      if (headerMap.y2025Idx !== -1 && row[headerMap.y2025Idx] !== undefined) {
        const v25 = parseOptionalNum(row[headerMap.y2025Idx]);
        if (v25 !== undefined) yearValues[2025] = v25;
      }
      if (reportedVal !== undefined) {
        yearValues[2026] = reportedVal;
      }
      [2027, 2028, 2029, 2030].forEach((futureYear) => {
        const colIdx =
          futureYear === 2027
            ? headerMap.y2027Idx
            : futureYear === 2028
            ? headerMap.y2028Idx
            : futureYear === 2029
            ? headerMap.y2029Idx
            : headerMap.y2030Idx;
        if (colIdx !== -1 && row[colIdx] !== undefined) {
          const fVal = parseOptionalNum(row[colIdx]);
          if (fVal !== undefined) {
            yearValues[futureYear] = fVal;
          }
        }
      });

      // Dynamically resolve the latest reported year (2026..2030) so adding 2027+ values updates all cards & statuses
      let latestReportedYear = 2026;
      for (const yr of [2030, 2029, 2028, 2027, 2026]) {
        if (typeof yearValues[yr] === "number" && !isNaN(yearValues[yr])) {
          latestReportedYear = yr;
          break;
        }
      }
      const activeReportedVal =
        yearValues[latestReportedYear] !== undefined
          ? yearValues[latestReportedYear]
          : reportedVal;

      const trend =
        activeReportedVal === undefined || baselineVal === undefined
          ? "pending"
          : Math.abs(activeReportedVal - baselineVal) < 0.001
          ? "stable"
          : activeReportedVal > baselineVal
          ? "up"
          : "down";

      const kpiObj: KPI = {
        id: kpiId,
        kpiCode,
        name: rawName,
        definition: rawDef,
        description: rawDef,
        category: currentCategory,
        subcategory: mapUnityStepToSubcategory(rawUnity),
        group: currentGroup,
        unityStep: rawUnity,
        subKpiRef: rawSubKpi,
        owner: rawOwner,
        archetypeOwner: rawOwner,
        source: rawSource,
        cadence: rawCadence,
        reporter: rawReporter,
        unit: resolvedUnit,
        value: activeReportedVal !== undefined ? activeReportedVal : null,
        target: targetVal !== undefined ? targetVal : null,
        baseline: baselineVal !== undefined ? baselineVal : null,
        baselineYear,
        latestReportedYear,
        status: "pending",
        trend,
        supports: [],
        yearValues,
        dataQuality: qualityParsed.rating,
        dataAccess: accessParsed.level,
        qualityColor: qualityParsed.color,
        accessColor: accessParsed.color,
        qualityTrafficLight: qualityParsed.trafficLight,
        accessTrafficLight: accessParsed.trafficLight,
        comments: rawNuance,
        dataNuances: rawNuance,
        isUnity30: true,
      };

      kpiObj.status = evaluateKPITrafficLight(kpiObj, latestReportedYear).status;
      parsedKPIs.push(kpiObj);
    }
  }

  const log: SheetSyncLog = {
    timestamp: new Date().toISOString(),
    spreadsheetId: activeSpreadsheetId,
    sheetsChecked,
    totalUpdated: parsedKPIs.length,
    flaggedLowQuality: Array.from(new Set(flaggedLowQuality)),
    flaggedRestricted: Array.from(new Set(flaggedRestricted)),
    missingEntries: Array.from(new Set(missingEntries)),
    status: parsedKPIs.length > 0 ? "success" : "error",
    message:
      parsedKPIs.length > 0
        ? `Synchronized ${parsedKPIs.length} indicators, ${Object.keys(terms).length} framework terms, and ${bigPushPillars.length} Big Push pillars directly from Google Sheets.`
        : "Unable to reach Google Sheet.",
  };

  return {
    updatedKPIs: parsedKPIs,
    terms,
    bigPushPillars,
    log,
  };
};
