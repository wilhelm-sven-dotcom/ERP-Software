import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatJSON, isAiConfigured, type ContentPart } from "@/lib/ai/openai";

interface ClassifyBody {
  fileName?: string;
  text?: string;
  /** Gerenderte Seiten/Bild als DataURL — für die Vision-Auslese. */
  images?: string[];
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
  /** Bei Datenblättern: ausgelesene technische Kenndaten (key→Wert). */
  specs?: Record<string, string | number> | null;
  /** Mehrere Produkte je Datenblatt: technische Kenndaten je Produkt-ID. */
  productSpecs?: Record<string, Record<string, string | number>> | null;
  /** Falls kein passendes Produkt existiert: Vorschlag für ein neues Produkt. */
  product_suggestion?: { name?: string; manufacturer?: string; category?: string } | null;
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
  const images = (body.images ?? []).filter((u) => typeof u === "string" && u.startsWith("data:")).slice(0, 2);
  // Kandidatenlisten klein halten (Token-/Kostenkontrolle).
  const projects = (body.projects ?? []).slice(0, 80);
  const products = (body.products ?? []).slice(0, 60);

  // Nutzer-Nachricht: zuerst Daten/Text, dann das/die Seitenbild(er) für die
  // Vision-Auslese (funktioniert auch bei gescannten PDFs).
  const userContent: ContentPart[] = [
    {
      type: "text",
      text:
        "Klassifiziere und interpretiere dieses Dokument. Daten:\n" +
        JSON.stringify({ fileName, projects, products }) +
        (text ? `\n\nExtrahierter Text (Hilfe, evtl. unvollständig):\n${text}` : ""),
    },
    ...images.map((url): ContentPart => ({ type: "image_url", image_url: { url } })),
  ];

  const result = await chatJSON<ClassifyResult>(
    [
      {
        role: "system",
        content:
          "Du ordnest eine hochgeladene Datei in einem PV-/Speicher-CRM korrekt zu und " +
          "interpretierst Dokumente. Lies das Dokument PRIMÄR aus dem BILD (auch gescannte PDFs/ " +
          "Tabellen); der mitgelieferte Text ist nur Hilfe. Entscheide, ob die Datei zu einem " +
          "PRODUKT (z. B. Datenblatt, Produktbild) oder einem PROJEKT (z. B. Rechnung, Plan, Foto, " +
          "Dokument) gehört. WICHTIG: Ein DATENBLATT gehört IMMER zu Produkten (target='produkt'), " +
          "auch wenn kein passendes Produkt in der Liste steht. Ein Datenblatt kann MEHRERE Produkte " +
          "abdecken — wähle ALLE productIds aus der Liste, die im Dokument vorkommen (Modellnamen/ " +
          "Artikelnummern vergleichen). Steht ein Produkt im Datenblatt, das NICHT in der Liste ist, " +
          "fülle 'product_suggestion' { name, manufacturer, category } für ein neu anzulegendes Produkt. " +
          "Bei Projekten die beste projectId (oder null). Setze 'kind': für Produkte 'datasheet' oder " +
          "'image'; für Projekte eines von dokument|datenblatt|plan|foto|rechnung|sonstiges. Ist die " +
          "Datei ein Beleg/eine Rechnung, fülle 'document' mit docType ('eingangsrechnung'|" +
          "'ausgangsrechnung'|'lieferschein'|'angebot'), supplier, invoice_number, invoice_date " +
          "(YYYY-MM-DD), due_date (YYYY-MM-DD), amount (Bruttobetrag als Zahl), currency. Ist die Datei " +
          "ein DATENBLATT, fülle 'specs' mit den zentralen technischen Kenndaten (z. B. leistung_wp, " +
          "wirkungsgrad_prozent, kapazitaet_kwh, strom_a, spannung_v, masse, gewicht_kg, garantie_jahre, " +
          "hersteller, modell). Wenn das Datenblatt MEHRERE Produkte mit UNTERSCHIEDLICHEN Werten zeigt, " +
          "fülle zusätzlich 'productSpecs' als Objekt { <productId aus der Liste>: { kenndaten… } } je " +
          "Produkt. Nur was wirklich sichtbar/belegbar ist, nichts erfinden. confidence 0..1. Antworte " +
          "ausschließlich als JSON mit target, productIds, projectId, kind, confidence, reason, document, " +
          "specs, productSpecs, product_suggestion.",
      },
      { role: "user", content: userContent },
    ],
    { maxTokens: 1200 },
  );

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
    specs:
      result.specs && typeof result.specs === "object" && !Array.isArray(result.specs)
        ? result.specs
        : null,
    productSpecs:
      result.productSpecs && typeof result.productSpecs === "object" && !Array.isArray(result.productSpecs)
        ? result.productSpecs
        : null,
    product_suggestion:
      result.product_suggestion && typeof result.product_suggestion === "object"
        ? result.product_suggestion
        : null,
  };
  return NextResponse.json({ enabled: true, result: normalized });
}
