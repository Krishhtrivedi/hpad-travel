"use client";

import type { jsPDF as JsPDF } from "jspdf";
import { BRAND } from "@/lib/brand";

/** Brand colour for PDF headers — keep in sync with --brand in globals.css. */
const BRAND_RGB: [number, number, number] = [31, 58, 95];

export async function newDocument(title: string, subtitle?: string, orientation: "portrait" | "landscape" = "portrait") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, w, 56, "F");
  doc.setTextColor(255, 255, 255);
  const logo = await loadLogo();
  if (logo) {
    const lh = 30;
    doc.addImage(logo, "PNG", 36, 13, lh * (BRAND.logoWidth / BRAND.logoHeight), lh);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(BRAND.name, 36, 34);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(title, w - 36, 30, { align: "right" });
  if (subtitle) doc.text(subtitle, w - 36, 44, { align: "right" });
  doc.setTextColor(26, 29, 35);
  return doc;
}

export function addFooter(doc: JsPDF) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const stamp = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: BRAND.timeZone }).format(new Date());
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(95, 102, 115);
    doc.text(`Generated ${stamp} IST · ${BRAND.appName}`, 36, h - 20);
    doc.text(`Page ${i} of ${pages}`, w - 36, h - 20, { align: "right" });
  }
}

export async function autoTable() {
  return (await import("jspdf-autotable")).default;
}

export const PDF_HEAD_STYLE = { fillColor: BRAND_RGB, textColor: 255, fontStyle: "bold" as const, fontSize: 9 };

/** The white logo sits on the brand-colour PDF header band. */
async function loadLogo(): Promise<string | null> {
  if (!BRAND.logoLightSrc) return null;
  try {
    const blob = await (await fetch(BRAND.logoLightSrc)).blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
