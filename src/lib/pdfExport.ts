import { jsPDF } from "jspdf";
import { domToCanvas } from "modern-screenshot";

/**
 * High-resolution PDF & Continuous PNG Exporter for RBM Partnership Impact Dashboard.
 * - Supports `cleanMatrixOnly: true` to export ONLY the Indicator Matrix heatmap table
 *   with zero summary stats, zero dashboard headers, and zero interactive UI prompts.
 * - Prevents bottom-row clipping in `<foreignObject>` by removing fixed inline heights on
 *   table/row/cell clones and adding bottom breathing room to the SVG canvas height.
 */

export interface ExportTabPDFOptions {
  element: HTMLElement | null;
  tabTitle: string;
  subtitle?: string;
  filenamePrefix?: string;
  orientation?: "portrait" | "landscape";
  cleanMatrixOnly?: boolean;
}

interface SavedStyle {
  node: HTMLElement;
  maxHeight: string;
  overflow: string;
  overflowY: string;
  overflowX: string;
  width: string;
  minWidth: string;
  paddingBottom: string;
  display: string;
}

interface RowBounds {
  topPx: number;
  bottomPx: number;
  isSectionHeader: boolean;
}

function prepareDomForCapture(
  element: HTMLElement,
  cleanMatrixOnly: boolean
): SavedStyle[] {
  const savedStyles: SavedStyle[] = [];

  const saveNode = (node: HTMLElement) => {
    savedStyles.push({
      node,
      maxHeight: node.style.maxHeight,
      overflow: node.style.overflow,
      overflowY: node.style.overflowY,
      overflowX: node.style.overflowX,
      width: node.style.width,
      minWidth: node.style.minWidth,
      paddingBottom: node.style.paddingBottom,
      display: node.style.display,
    });
  };

  // 1. Expand root element if cleanMatrixOnly so neither the right edge nor the bottom row is clipped
  saveNode(element);
  if (cleanMatrixOnly) {
    const tableEl = element.querySelector<HTMLElement>("table");
    const targetWidth = Math.max(
      element.scrollWidth,
      tableEl ? tableEl.scrollWidth + 16 : 1060,
      1060
    );
    element.style.width = `${targetWidth}px`;
    element.style.minWidth = `${targetWidth}px`;
    element.style.paddingBottom = "18px";
    element.style.overflow = "visible";
    element.style.overflowX = "visible";
    element.style.overflowY = "visible";
  }

  // 2. Hide all [data-pdf-ignore="true"] in live DOM before measuring row bounds & capturing
  const ignoredNodes = element.querySelectorAll<HTMLElement>(
    '[data-pdf-ignore="true"]'
  );
  ignoredNodes.forEach((node) => {
    saveNode(node);
    node.style.display = "none";
  });

  // 3. Unroll any scrollable or overflow-hidden containers inside element
  const allNodes = element.querySelectorAll<HTMLElement>("*");
  allNodes.forEach((node) => {
    const cls = typeof node.className === "string" ? node.className : "";
    if (
      cls.includes("max-h-") ||
      cls.includes("overflow-y-auto") ||
      cls.includes("overflow-x-auto") ||
      cls.includes("overflow-hidden")
    ) {
      saveNode(node);
      if (cls.includes("max-h-")) {
        node.style.maxHeight = "none";
      }
      if (
        cls.includes("overflow-y-auto") ||
        cls.includes("overflow-x-auto") ||
        cls.includes("overflow-hidden")
      ) {
        node.style.overflow = "visible";
        node.style.overflowY = "visible";
        node.style.overflowX = "visible";
      }
    }
  });

  return savedStyles;
}

function restoreDomAfterCapture(savedStyles: SavedStyle[]) {
  for (let i = savedStyles.length - 1; i >= 0; i--) {
    const {
      node,
      maxHeight,
      overflow,
      overflowY,
      overflowX,
      width,
      minWidth,
      paddingBottom,
      display,
    } = savedStyles[i];
    node.style.maxHeight = maxHeight;
    node.style.overflow = overflow;
    node.style.overflowY = overflowY;
    node.style.overflowX = overflowX;
    node.style.width = width;
    node.style.minWidth = minWidth;
    node.style.paddingBottom = paddingBottom;
    node.style.display = display;
  }
}

async function captureDashboardCanvas(
  element: HTMLElement,
  scale = 2,
  bgColor = "#ffffff"
): Promise<{
  canvas: HTMLCanvasElement;
  rowBounds: RowBounds[];
  theadBottomPx: number;
}> {
  const tableEl = element.querySelector<HTMLElement>("table");
  const rootRect = element.getBoundingClientRect();
  const tableRect = tableEl ? tableEl.getBoundingClientRect() : rootRect;

  const fullWidth = Math.ceil(
    Math.max(
      rootRect.width,
      element.scrollWidth,
      tableEl ? tableEl.scrollWidth + 12 : 0
    )
  );
  // Include extra vertical buffer so sub-pixel row borders in <foreignObject> never clip the last row
  const fullHeight = Math.ceil(
    Math.max(
      rootRect.height,
      element.scrollHeight,
      tableRect.bottom - rootRect.top,
      tableEl ? tableEl.scrollHeight : 0
    ) + 28
  );

  const rowElements = element.querySelectorAll<HTMLElement>(
    "tbody tr, [data-pdf-avoid-break]"
  );
  const rowBounds: RowBounds[] = [];
  rowElements.forEach((rowEl) => {
    const r = rowEl.getBoundingClientRect();
    if (r.height > 6 && r.height < 450) {
      rowBounds.push({
        topPx: Math.max(0, Math.floor((r.top - rootRect.top) * scale)),
        bottomPx: Math.max(0, Math.ceil((r.bottom - rootRect.top) * scale)),
        isSectionHeader:
          rowEl.getAttribute("data-pdf-section-header") === "true",
      });
    }
  });

  const theadEl = element.querySelector<HTMLElement>("thead");
  let theadBottomPx = 0;
  if (theadEl) {
    const tr = theadEl.getBoundingClientRect();
    theadBottomPx = Math.max(0, Math.ceil((tr.bottom - rootRect.top) * scale));
  }

  const AUTO_HEIGHT_TAGS = new Set([
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "span",
    "strong",
    "p",
  ]);

  const canvas = await domToCanvas(element, {
    scale,
    width: fullWidth,
    height: fullHeight,
    backgroundColor: bgColor,
    timeout: 20000,
    filter: (node) => {
      if (
        node instanceof HTMLElement &&
        node.getAttribute("data-pdf-ignore") === "true"
      ) {
        return false;
      }
      return true;
    },
    onCloneEachNode: (cloned) => {
      if (cloned instanceof HTMLElement) {
        const tag = cloned.tagName.toLowerCase();
        if (AUTO_HEIGHT_TAGS.has(tag)) {
          cloned.style.removeProperty("height");
          cloned.style.removeProperty("block-size");
        }
      }
    },
    onCloneNode: (clonedRoot) => {
      if (clonedRoot instanceof HTMLElement) {
        clonedRoot.style.setProperty("height", "auto", "important");
        clonedRoot.style.setProperty("min-height", `${fullHeight}px`, "important");
        clonedRoot.style.setProperty("overflow", "visible", "important");
      }
    },
  });

  return { canvas, rowBounds, theadBottomPx };
}

/**
 * Exports the target element as a single continuous high-resolution PNG image (no page breaks).
 * When `cleanMatrixOnly` is true, exports ONLY the matrix with no headers, summary stats, or footers.
 */
export async function exportElementToPNG({
  element,
  tabTitle,
  subtitle = "RBM Partnership To End Malaria — Unity 30 & Big Push Strategic Framework",
  filenamePrefix = "RBM_Impact_Dashboard",
  cleanMatrixOnly = false,
}: ExportTabPDFOptions): Promise<void> {
  if (!element || typeof window === "undefined") return;

  const safeTabSlug = tabTitle
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${safeTabSlug}_${dateSlug}.png`;
  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const savedStyles = prepareDomForCapture(element, cleanMatrixOnly);
  const scale = 2;

  try {
    const { canvas } = await captureDashboardCanvas(
      element,
      scale,
      cleanMatrixOnly ? "#ffffff" : "#f5f7fa"
    );

    let outCanvas: HTMLCanvasElement;

    if (cleanMatrixOnly) {
      // Pure Matrix Image: Tight top margin (2px) and clean bottom margin so nothing is clipped
      const padX = 4 * scale;
      const padTop = 2 * scale;
      const padBottom = 6 * scale;
      outCanvas = document.createElement("canvas");
      outCanvas.width = canvas.width + padX * 2;
      outCanvas.height = canvas.height + padTop + padBottom;
      const ctx = outCanvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
      ctx.drawImage(canvas, padX, padTop);
    } else {
      const pad = 20 * scale;
      const headerHeight = 68 * scale;
      const headerGap = 14 * scale;
      const footerHeight = 28 * scale;

      outCanvas = document.createElement("canvas");
      outCanvas.width = canvas.width + pad * 2;
      outCanvas.height =
        pad + headerHeight + headerGap + canvas.height + footerHeight + pad;

      const ctx = outCanvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#f5f7fa";
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

      const bannerX = pad;
      const bannerY = pad;
      const bannerW = canvas.width;
      const bannerH = headerHeight;

      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8 * scale);
      ctx.fill();

      ctx.fillStyle = "#2563eb";
      ctx.fillRect(
        bannerX,
        bannerY + bannerH - 4 * scale,
        bannerW,
        4 * scale
      );

      ctx.fillStyle = "#93c5fd";
      ctx.font = `bold ${10 * scale}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(
        "RBM PARTNERSHIP IMPACT DASHBOARD  ·  CONTINUOUS HIGH-RES EXPORT",
        bannerX + 18 * scale,
        bannerY + 20 * scale
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${18 * scale}px sans-serif`;
      ctx.fillText(tabTitle, bannerX + 18 * scale, bannerY + 42 * scale);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = `${11 * scale}px sans-serif`;
      ctx.fillText(subtitle, bannerX + 18 * scale, bannerY + 58 * scale);

      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${11 * scale}px sans-serif`;
      ctx.fillText(
        `Exported: ${exportDate}`,
        bannerX + bannerW - 18 * scale,
        bannerY + 34 * scale
      );
      ctx.fillStyle = "#94a3b8";
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.fillText(
        "2026 Reported vs 2030 Target",
        bannerX + bannerW - 18 * scale,
        bannerY + 52 * scale
      );

      const contentY = bannerY + bannerH + headerGap;
      ctx.drawImage(canvas, pad, contentY);

      const footerY = contentY + canvas.height + 18 * scale;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(pad, footerY - 11 * scale);
      ctx.lineTo(outCanvas.width - pad, footerY - 11 * scale);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = "#64748b";
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.fillText(
        "RBM Partnership to End Malaria — Unity 30 & Big Push Impact Reporting Framework",
        pad,
        footerY
      );

      ctx.textAlign = "right";
      ctx.fillText(
        "Continuous Full-View PNG",
        outCanvas.width - pad,
        footerY
      );
    }

    const blob: Blob | null = await new Promise((resolve) =>
      outCanvas.toBlob((b) => resolve(b), "image/png", 1.0)
    );
    if (!blob) return;

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } finally {
    restoreDomAfterCapture(savedStyles);
  }
}

export async function exportElementToPDF({
  element,
  tabTitle,
  subtitle = "RBM Partnership To End Malaria — Unity 30 & Big Push Strategic Framework",
  filenamePrefix = "RBM_Impact_Dashboard",
  orientation = "landscape",
  cleanMatrixOnly = false,
}: ExportTabPDFOptions): Promise<void> {
  if (!element || typeof window === "undefined") return;

  const safeTabSlug = tabTitle
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${safeTabSlug}_${dateSlug}.pdf`;
  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const savedStyles = prepareDomForCapture(element, cleanMatrixOnly);
  const scale = 2;

  try {
    const { canvas, rowBounds } = await captureDashboardCanvas(
      element,
      scale,
      cleanMatrixOnly ? "#ffffff" : "#f5f7fa"
    );

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // In cleanMatrixOnly mode, use a minimal 2mm top margin and fit the entire matrix onto 1 single page
    if (cleanMatrixOnly) {
      const marginX = 3;
      const topMargin = 2;
      const bottomMargin = 3;
      const availPageWidth = pageWidth - marginX * 2;
      const availPageHeight = pageHeight - topMargin - bottomMargin;

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      const imgAspect = canvas.width / canvas.height;

      let renderW = availPageWidth;
      let renderH = availPageWidth / imgAspect;

      if (renderH > availPageHeight) {
        renderH = availPageHeight;
        renderW = availPageHeight * imgAspect;
      }

      const offsetX = marginX + (availPageWidth - renderW) / 2;
      const offsetY = topMargin;

      const fullDataUrl = canvas.toDataURL("image/png");
      pdf.addImage(
        fullDataUrl,
        "PNG",
        offsetX,
        offsetY,
        renderW,
        renderH,
        undefined,
        "FAST"
      );

      const blob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    }

    const margin = 5;
    const availPageWidth = pageWidth - margin * 2;
    const contentWidth = availPageWidth;
    const footerHeight = 5.5;
    const headerBannerHeight = 15.5;
    const startYPage1 = margin + headerBannerHeight + 2.5;
    const startYSubsequent = margin;

    const pxPerMm = canvas.width / contentWidth;
    const availMmPage1 = pageHeight - startYPage1 - margin - footerHeight;
    const availMmSubsequent =
      pageHeight - startYSubsequent - margin - footerHeight;

    const pxPage1 = Math.max(1, Math.floor(availMmPage1 * pxPerMm));
    const pxSubsequent = Math.max(1, Math.floor(availMmSubsequent * pxPerMm));

    const pageSlices: { startPx: number; endPx: number; isFirstPage: boolean }[] = [];
    let cursorPx = 0;
    let isFirst = true;

    while (cursorPx < canvas.height) {
      const maxSlice = isFirst ? pxPage1 : pxSubsequent;
      let targetEndPx = Math.min(canvas.height, cursorPx + maxSlice);

      if (targetEndPx < canvas.height) {
        for (let i = 0; i < rowBounds.length; i++) {
          const rb = rowBounds[i];
          if (rb.topPx < targetEndPx && rb.bottomPx > targetEndPx) {
            if (rb.topPx > cursorPx + 40) {
              targetEndPx = rb.topPx;
              if (i > 0 && rowBounds[i - 1].isSectionHeader) {
                if (rowBounds[i - 1].topPx > cursorPx + 40) {
                  targetEndPx = rowBounds[i - 1].topPx;
                }
              }
            }
            break;
          }
        }
      }

      pageSlices.push({
        startPx: cursorPx,
        endPx: targetEndPx,
        isFirstPage: isFirst,
      });

      cursorPx = targetEndPx;
      isFirst = false;
    }

    const totalPages = pageSlices.length;

    pageSlices.forEach((slice, idx) => {
      const pageIndex = idx + 1;
      if (pageIndex > 1) {
        pdf.addPage("a4", orientation);
      }

      pdf.setFillColor(245, 247, 250);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      const startY = slice.isFirstPage ? startYPage1 : startYSubsequent;

      if (slice.isFirstPage) {
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(
          margin,
          margin,
          contentWidth,
          headerBannerHeight,
          2,
          2,
          "F"
        );

        pdf.setFillColor(37, 99, 235);
        pdf.rect(
          margin,
          margin + headerBannerHeight - 1,
          contentWidth,
          1,
          "F"
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.8);
        pdf.setTextColor(147, 197, 253);
        pdf.text(
          "RBM PARTNERSHIP IMPACT DASHBOARD  ·  OFFICIAL PDF EXPORT",
          margin + 4,
          margin + 4.3
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text(tabTitle, margin + 4, margin + 9.4);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(203, 213, 225);
        const truncatedSub =
          subtitle.length > 145 ? subtitle.slice(0, 142) + "..." : subtitle;
        pdf.text(truncatedSub, margin + 4, margin + 13.3);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(
          `Exported: ${exportDate}`,
          pageWidth - margin - 4,
          margin + 7.5,
          { align: "right" }
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          "2026 Reported vs 2030 Target",
          pageWidth - margin - 4,
          margin + 12,
          { align: "right" }
        );
      }

      const availMm = slice.isFirstPage ? availMmPage1 : availMmSubsequent;
      const slicePxHeight = Math.max(1, slice.endPx - slice.startPx);
      const sliceMmHeight = slicePxHeight / pxPerMm;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = slicePxHeight;
      const sliceCtx = sliceCanvas.getContext("2d");

      if (sliceCtx) {
        sliceCtx.fillStyle = "#f5f7fa";
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(
          canvas,
          0,
          slice.startPx,
          canvas.width,
          slicePxHeight,
          0,
          0,
          canvas.width,
          slicePxHeight
        );

        const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(
          sliceDataUrl,
          "JPEG",
          margin,
          startY,
          contentWidth,
          Math.min(sliceMmHeight, availMm),
          undefined,
          "FAST"
        );
      }

      const footerY = pageHeight - margin + 1.2;
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.2);
      pdf.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        "RBM Partnership to End Malaria — Unity 30 & Big Push Impact Reporting Framework",
        margin,
        footerY
      );
      pdf.text(
        `Page ${pageIndex} of ${totalPages}`,
        pageWidth - margin,
        footerY,
        { align: "right" }
      );
    });

    const blob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } finally {
    restoreDomAfterCapture(savedStyles);
  }
}
