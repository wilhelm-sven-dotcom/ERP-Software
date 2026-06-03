import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatJSON, isAiConfigured } from "@/lib/ai/openai";

interface ClassifyBody {
  fileName?: string;
  text?: string;
  projects?: { id: string; title: string }[];
  products?: { id: string; name: string; sku?: string | null; manufacturer?: string | null }[];
}

export interface ClassifyResult {
  target: "produkt" | "projekt";
  productIds: string[];
  projectId: string | null;
  kind: string;
  confidence: number;
  reason: string;
  document?: {
    docType?: string;
    supplier?: string;
    invoice_number?: string;
    invoice_date?: string;
    due_date?: string;
    amount?: number | string;
    currency?: string;
  } | null;
}

/**
 * KI-gestützte Datei-Zuordnung + Dokument-/Rechnungs-Interpretation.
 * Liefert einen Vorschlag (Ziel, Produkt(e)/Projekt, Ablage-Art) sowie
 * — bei Belegen — ausgelesene Felder (Lieferant, Nummer, Datum, Betrag).
 * Der Nutzer bestätigt den Vorschlag (1-Klick). Ohne Key/Login: aus.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false });

  let body: ClassifyBody;
  try {
    body = (await req.json()) as ClassifyBody;
  } catch {
    return NextResponse.json({ enabled: true, result: null });
  }

  const fileName = (body.fileName ?? "").slice(0, 300);
  const text = (body.text ?? "").slice(0, 6000);
  // Kandidatenlisten klein halten (Token-/Kostenkontrolle).
  const projects = (body.projects ?? []).slice(0, 80);
  const products = (body.products ?? []).slice(0, 60);

  const result = await chatJSON<ClassifyResult>([
    {
      role: "system",
      content:
        "Du ordnest eine hochgeladene Datei in einem PV-/Speicher-CRM korrekt zu und " +
        "interpretierst Dokumente. Entscheide anhand von Dateiname und Textinhalt, ob die Datei " +
        "zu einem PRODUKT (z. B. Datenblatt, Produktbild) oder einem PROJEKT (z. B. Rechnung, " +
        "Plan, Foto, Dokument) gehört. Wähle bei Produkten passende productIds aus der Liste " +
        "(nur wirklich passende, sonst leer); bei Projekten die beste projectId (oder null). " +
        "Setze 'kind': für Produkte 'datasheet' oder 'image'; für Projekte eines von " +
        "dokument|datenblatt|plan|foto|rechnung|sonstiges. Ist die Datei ein Beleg/eine Rechnung, " +
        "fülle 'document' mit docType (z. B. 'eingangsrechnung','ausgangsrechnung','lieferschein'," +
        "'angebot'), supplier, invoice_number, invoice_date (YYYY-MM-DD), due_date (YYYY-MM-DD), " +
        "amount (Bruttobetrag als Zahl), currency. Unbekannte Felder weglassen, nichts erfinden. " +
        "confidence 0..1. Antworte ausschließlich als JSON mit den Feldern target, productIds, " +
        "projectId, kind, confidence, reason, document.",
    },
    {
      role: "user",
      content: JSON.stringify({ fileName, text, projects, products }),
    },
  ]);

  if (!result) return NextResponse.json({ enabled: true, result: null });

  // Defensiv normalisieren.
  const normalized: ClassifyResult = {
    target: result.target === "produkt" ? "produkt" : "projekt",
    productIds: Array.isArray(result.productIds) ? result.productIds : [],
    projectId: result.projectId ?? null,
    kind: typeof result.kind === "string" ? result.kind : "dokument",
    confidence: typeof result.confidence === "number" ? result.confidence : 0,
    reason: typeof result.reason === "string" ? result.reason : "",
    document: result.document ?? null,
  };
  return NextResponse.json({ enabled: true, result: normalized });
}
