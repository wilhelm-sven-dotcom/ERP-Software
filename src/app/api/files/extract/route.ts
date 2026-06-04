import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { analyzeDocument, isDocIntelConfigured } from "@/lib/ai/doc-intelligence";

// Auslese kann etwas dauern (Azure-Polling) — längere Laufzeit erlauben.
export const maxDuration = 60;

/**
 * Robuste Dokument-Auslese per Azure AI Document Intelligence (EU).
 * Nimmt die Datei (multipart) und liefert sauberen Text (+ Tabellen-Anzahl).
 * Ohne Azure-Keys: { enabled:false } → der Client nutzt die pdf.js-Auslese.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isDocIntelConfigured()) return NextResponse.json({ enabled: false });

  let bytes: ArrayBuffer;
  let contentType = "application/octet-stream";
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return NextResponse.json({ enabled: true, text: null });
    contentType = file.type || contentType;
    bytes = await file.arrayBuffer();
  } catch {
    return NextResponse.json({ enabled: true, text: null });
  }

  // Sehr große Dateien überspringen (Kosten/Laufzeit) → Fallback beim Client.
  if (bytes.byteLength > 20 * 1024 * 1024) return NextResponse.json({ enabled: true, text: null });

  const result = await analyzeDocument(bytes, contentType);
  if (!result) return NextResponse.json({ enabled: true, text: null });
  return NextResponse.json({ enabled: true, text: result.text, tableCount: result.tableCount });
}
