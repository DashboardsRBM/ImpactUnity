import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        row.push(current.trim());
        if (row.some((c) => c !== "")) {
          result.push(row);
        }
        row = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.some((c) => c !== "")) {
      result.push(row);
    }
  }
  return result;
}

/**
 * Fetches live cell background colors for Columns U (index 20) and V (index 21)
 * directly from Google Sheets htmlview/sheet for a given spreadsheetId and tab.
 */
async function fetchSheetCellColorsByKpiCode(
  spreadsheetId: string,
  tabName: string
): Promise<Record<string, { colUColor: string; colVColor: string }>> {
  const colorMap: Record<string, { colUColor: string; colVColor: string }> = {};
  try {
    // Resolve gid from htmlview
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
    // Non-fatal fallback if htmlview is unavailable
  }
  return colorMap;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const tab = searchParams.get("tab") || "Unity 30 KPIs Final";

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Missing spreadsheetId parameter" },
        { status: 400 }
      );
    }

    const isUnityFinalTab = tab.toLowerCase().includes("unity 30");

    // 1. Fetch GViz JSON (headers=1 preserves string headers in numeric columns J, K, L)
    //    and in parallel fetch live cell background colors for Columns U & V if Unity 30 tab
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(
      tab
    )}`;

    const [gvizRes, cellColorMap] = await Promise.all([
      fetch(gvizUrl, { cache: "no-store" }),
      isUnityFinalTab
        ? fetchSheetCellColorsByKpiCode(spreadsheetId, tab)
        : Promise.resolve({} as Record<string, { colUColor: string; colVColor: string }>),
    ]);

    if (gvizRes.ok) {
      const text = await gvizRes.text();
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
                // Inject live cell background hex colors into Col U (20) and Col V (21)
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
              return NextResponse.json({ rows, source: "gviz" });
            }
          }
        }
      }
    }

    // 2. Fallback to CSV export if GViz fails
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      tab
    )}`;
    const csvRes = await fetch(csvUrl, { cache: "no-store" });
    if (csvRes.ok) {
      const csvText = await csvRes.text();
      if (csvText && !csvText.trim().startsWith("<!DOCTYPE html>")) {
        const rows = parseCSV(csvText);
        if (rows.length > 0) {
          return NextResponse.json({ rows, source: "csv" });
        }
      }
    }

    return NextResponse.json(
      {
        error:
          "Unable to fetch Google Sheet tab. Ensure the sheet is shared with 'Anyone with the link can view'.",
      },
      { status: 404 }
    );
  } catch (err: any) {
    console.error("Google Sheets Proxy Error:", err);
    return NextResponse.json(
      { error: "Failed to query Google Sheets", details: err.message },
      { status: 500 }
    );
  }
}
