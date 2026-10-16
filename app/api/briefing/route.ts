import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export async function POST(req: NextRequest) {
  try {
    const {
      kpis,
      currentHorizon,
      focusArea,
      contextNotes = "",
      uploadedDocs = [],
    } = await req.json();

    const safeKpis = Array.isArray(kpis) ? kpis : [];
    const safeDocs: Array<{ name: string; content: string }> = Array.isArray(uploadedDocs)
      ? uploadedDocs
      : [];

    const structuredKpiLedger = safeKpis.map((k: any) => ({
      kpiCode: k.kpiCode || k.id,
      name: k.name,
      sectionGroup: k.group || k.category,
      unityStep: k.unityStep || k.subcategory || "N/A",
      owner: k.owner || "N/A",
      source: k.source || "Not specified",
      cadence: k.cadence || "Annual",
      baselineYear: k.baselineYear ?? "N/A",
      baselineValue: k.baseline ?? null,
      reported2026: k.value ?? null,
      target2030: k.target ?? null,
      unit: k.unit || "",
      ragStatus: k.status || "pending",
      dataQuality: k.dataQuality || "unrated",
      dataAccess: k.dataAccess || "unrated",
      dataReliabilityComments: k.comments || k.dataNuances || "",
    }));

    const uploadedDocsSection =
      safeDocs.length > 0
        ? `\nUploaded Reference Documents:\n${safeDocs
            .map((d) => `--- Document: ${d.name} ---\n${d.content}`)
            .join("\n\n")}\n`
        : "";

    const ai = getAiClient();
    const prompt = `
You are a senior strategic advisor to the RBM Partnership to End Malaria.
Generate an Executive Progress Briefing narrative for the Board of Directors and high-level Donors.

Active Time Horizon: ${currentHorizon || "2026 Annual Workplan / Unity 30"}
Selected Focus Area: ${focusArea || "General Overview"}

Data Sources & Ecosystem Context:
- Primary Telemetry Source: RBM Partnership Google Sheet ("Unity 30 KPIs Final"), including indicator values, Data Quality ratings (Col U), Data Availability (Col V), and Working Group reliability/quality comments in the last column (Col W: \`dataReliabilityComments\`).
${contextNotes ? `- Additional Context: ${contextNotes.trim()}` : ""}
${uploadedDocsSection}

Here is the current state of our tracking KPIs (including last-column data reliability & quality comments):
${JSON.stringify(structuredKpiLedger, null, 2)}

Provide a beautifully styled, authoritative, and concise narrative (approximately 350-500 words) that addresses:
1. **The Strategic Outlook**: Synthesize the macro progress on "Save Lives" trajectory.
2. **Ecosystem & Architecture Resilience**: Interpret what the current status of Ecosystem KPIs and Broader Malaria Health Goals means for long-term sustainability, accounting for external ecosystem context (such as 2025 USG funding cuts) where relevant.
3. **Critical Accelerators & Data Reliability Context**: Highlight the most urgent acceleration milestones across the "Unity 30 Building Blocks" (Engage, Align, Enable, Act, Impact), while accounting for the data reliability and quality comments from the last column of the data source (\`dataReliabilityComments\` and \`dataQuality\`).
4. **Actionable Call-to-Action for Donors**: A clear recommendation on resource re-allocation, M&E strengthening, or political support based on active RAG indicators.

Write in a highly professional, strategic, and encouraging tone. Use elegant markdown styling with bold labels.

CRITICAL FORMATTING AND STRUCTURE MANDATES:
- Prioritize strict accuracy over style: never fabricate data or data sources. Only cite values and comments present in the provided KPI dataset and uploaded documents.
- Start directly with the main narrative or first heading. Do NOT include any introductory placeholders, headers, or blockquote meta-lines.
- Do NOT include any formal memo fields (such as "To:", "From:", "Date:", "Subject:", "Focus:", or "Recipient:").
- Do NOT include any formal greeting, salutations, sign-offs, or signature lines.
- Do NOT output stray formatting markers or empty list elements.
- Avoid clinical developer jargon or referencing internal database fields. Emphasize visual alignment and real progress.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini briefing generation failed:", error);
    return NextResponse.json(
      {
        error: "Failed to generate briefing.",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
