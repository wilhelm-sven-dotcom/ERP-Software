import { extractTextFromPdf } from "@/lib/pdf/extract-images";

/**
 * Dokument-Text möglichst robust gewinnen:
 *  1) Azure AI Document Intelligence (Server-Route, falls konfiguriert) — liest
 *     auch Scans/Tabellen sauber aus.
 *  2) Fallback: lokale pdf.js-Auslese (nur PDFs, kein Scan-OCR).
 * Gibt im Zweifel "" zurück (nie Fehler werfen).
 */
export async function extractDocumentText(file: File): Promise<string> {
  // 1) Azure-Route versuchen (greift nur, wenn AZURE_DOCINTEL_* gesetzt ist).
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/files/extract", { method: "POST", body: fd });
    if (res.ok) {
      const data = (await res.json()) as { enabled?: boolean; text?: string | null };
      if (data.enabled && typeof data.text === "string" && data.text.trim().length > 0) {
        return data.text;
      }
    }
  } catch {
    /* Netz/Server-Problem → Fallback */
  }
  // 2) Fallback: pdf.js (nur PDFs).
  try {
    if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      return await extractTextFromPdf(file);
    }
  } catch {
    /* ignore */
  }
  return "";
}
