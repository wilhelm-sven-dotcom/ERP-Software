import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { analyzeDocument, isDocIntelConfigured } from "@/lib/ai/doc-intelligence";

// Auslese kann etwas dauern (Azure-Polling) — längere Laufzeit erlauben.
export const maxDuration = 60;

/**
 * Selbsttest (im Browser aufrufbar): zeigt, ob Azure DI in der Produktion
 * erkannt wird — ohne die Schlüssel preiszugeben. Nur für eingeloggte Nutzer.
 */
export async function GET() {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const configured = isDocIntelConfigured();
  // Nur den Host des Endpoints zeigen (kein Geheimnis), zur Sichtprüfung.
  let endpointHost: string | null = null;
  try {
    if (process.env.AZURE_DOCINTEL_ENDPOINT) {
      endpointHost = new URL(process.env.AZURE_DOCINTEL_ENDPOINT).host;
    }
  } catch {
    endpointHost = "ungültige URL in AZURE_DOCINTEL_ENDPOINT";
  }
  return NextResponse.json({
    azure_configured: configured,
    endpointHost,
    hinweis: configured
      ? "Azure ist aktiv. Lade ein gescanntes Datenblatt im Posteingang hoch, um die Auslese zu testen."
      : "Azure-Keys werden nicht erkannt — AZURE_DOCINTEL_ENDPOINT/_KEY in Vercel prüfen und neu deployen.",
  });
}

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
