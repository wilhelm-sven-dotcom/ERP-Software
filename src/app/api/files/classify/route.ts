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
  customers?: { id: string; name: string; city?: string | null; nr?: number | null }[];
  employees?: { id: string; name: string }[];
}

export type ClassifyTarget = "produkt" | "projekt" | "kunde" | "mitarbeiter" | "buchhaltung";

export interface ClassifyResult {
  target: ClassifyTarget;
  productIds: string[];
  projectId: string | null;
  /** Ziel-Kunde (bei target='kunde' oder zur Verknüpfung einer Rechnung). */
  customerId?: string | null;
  /** Ziel-Mitarbeiter (bei target='mitarbeiter'). */
  employeeId?: string | null;
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
  // Titel-/Kopfbereich (Dateiname + Textanfang) — hier steht das HAUPTPRODUKT
  // des Datenblatts; Zubehör wird meist nur im Fließtext erwähnt.
  const title = `${fileName}\n${(body.text ?? "").slice(0, 600)}`.trim();
  const images = (body.images ?? []).filter((u) => typeof u === "string" && u.startsWith("data:")).slice(0, 2);
  // Kandidatenlisten klein halten (Token-/Kostenkontrolle).
  const projects = (body.projects ?? []).slice(0, 80);
  // Mehr Kandidaten zulassen; der Client schickt die relevantesten zuerst.
  const products = (body.products ?? []).slice(0, 140);
  const customers = (body.customers ?? []).slice(0, 120);
  const employees = (body.employees ?? []).slice(0, 60);
  const customerIds = new Set(customers.map((c) => c.id));
  const employeeIds = new Set(employees.map((e) => e.id));

  // Nutzer-Nachricht: zuerst Daten/Text, dann das/die Seitenbild(er) für die
  // Vision-Auslese (funktioniert auch bei gescannten PDFs).
  const userContent: ContentPart[] = [
    {
      type: "text",
      text:
        "Klassifiziere und interpretiere dieses Dokument. Daten:\n" +
        JSON.stringify({ fileName, titel: title, projects, products, customers, employees }) +
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
          "Tabellen); der mitgelieferte Text ist nur Hilfe. Bestimme das beste 'target' aus: " +
          "'produkt' (Datenblatt, Produktbild), 'projekt' (Beleg/Plan/Foto/Schriftverkehr mit klarem " +
          "Projektbezug), 'kunde' (Kundendokument ohne Projektbezug: z. B. Stromrechnung, Ausweis, " +
          "Lageplan, Korrespondenz → fülle 'customerId' aus der Kundenliste), 'mitarbeiter' " +
          "(Personaldokument: Arbeitsvertrag, Bescheinigung, Lohnabrechnung → fülle 'employeeId' aus der " +
          "Mitarbeiterliste), 'buchhaltung' (EINGANGS-/Lieferantenrechnung → fülle 'document' und, wenn " +
          "erkennbar, projectId/customerId). Bevorzuge bei Belegen mit klarem Projekt/Kunde die jeweilige " +
          "ID; eine Lieferanten-Eingangsrechnung gehört nach 'buchhaltung'. " +
          "WICHTIG: Ein DATENBLATT gehört IMMER zu Produkten (target='produkt'), " +
          "auch wenn kein passendes Produkt in der Liste steht. Ein Datenblatt kann MEHRERE Produkte " +
          "abdecken — wähle ALLE productIds aus der Liste, deren MODELLNAME oder ARTIKELNUMMER WÖRTLICH " +
          "im Dokument vorkommt. STRENG: Wähle ein Produkt NIEMALS nur, weil es vom selben Hersteller " +
          "oder aus derselben Kategorie stammt (z. B. ein SMA-Datenblatt darf KEINE Sigenergy-/Fox-/ " +
          "Huawei-Produkte markieren). Prüfe zuerst den Hersteller im Dokument und schließe alle " +
          "Produkte anderer Hersteller aus. WICHTIG: Das HAUPTPRODUKT des Datenblatts steht im Titel/Kopf " +
          "(Feld 'titel' = Dateiname + Textanfang). Kommt der NAME oder die MODELLNUMMER eines Kandidaten " +
          "aus der Liste wörtlich im 'titel'/Dateinamen vor, ist es SEHR WAHRSCHEINLICH das Hauptprodukt — " +
          "dann WÄHLE diese productId (nicht auslassen!). " +
          "Schließe NUR Produkte AUS, die EXPLIZIT als kompatibles Zubehör / Energiezähler (Energy " +
          "Meter) / Home Manager / Smart Meter / Monitoring / Backup-Box / im Lieferumfang ODER in einer " +
          "Kompatibilitätsliste genannt werden UND NICHT im Titel stehen — diese sind nicht der " +
          "Gegenstand des Datenblatts. " +
          "Wenn KEIN Produkt aus der Liste das Hauptprodukt ist, gib " +
          "productIds: [] zurück. Steht das Hauptprodukt des Datenblatts NICHT in der Liste, " +
          "fülle IMMER 'product_suggestion' { name, manufacturer, category } für ein neu anzulegendes " +
          "Produkt (category z. B. 'Wechselrichter'|'Modul'|'Speicher'|'Wallbox'|'Zubehör'). " +
          "Bei Projekten die beste projectId (oder null). Setze 'kind': für Produkte 'datasheet' oder " +
          "'image'; für Projekte eines von dokument|datenblatt|plan|foto|rechnung|sonstiges. Ist die " +
          "Datei ein Beleg/eine Rechnung, fülle 'document' mit docType ('eingangsrechnung'|" +
          "'ausgangsrechnung'|'lieferschein'|'angebot'), supplier, invoice_number, invoice_date " +
          "(YYYY-MM-DD), due_date (YYYY-MM-DD), amount (Bruttobetrag als Zahl), currency. Ist die Datei " +
          "ein DATENBLATT, fülle 'specs' so VOLLSTÄNDIG wie belegbar mit den technischen Kenndaten. " +
          "Nutze, wo passend, diese englischen Schlüssel (Zahlen ohne Einheit): manufacturer, model, " +
          "module_wp (PV-Modul Wp), inverter_kw (WR-Nennleistung kW), storage_kwh (Speicher kWh), " +
          "efficiency_pct (Wirkungsgrad %), max_dc_voltage, mppt_count, max_input_current_a, " +
          "max_output_current_a, phases, nominal_voltage_v, dimensions (BxHxT als Text), weight_kg, " +
          "warranty_years, ip_rating, operating_temp, cell_type. Weitere belegte Kenndaten als " +
          "zusätzliche Schlüssel erlaubt. Wenn das Datenblatt MEHRERE Produkte mit UNTERSCHIEDLICHEN Werten zeigt, " +
          "fülle zusätzlich 'productSpecs' als Objekt { <productId aus der Liste>: { kenndaten… } } je " +
          "Produkt. Nur was wirklich sichtbar/belegbar ist, nichts erfinden. confidence 0..1. Antworte " +
          "ausschließlich als JSON mit target ('produkt'|'projekt'|'kunde'|'mitarbeiter'|'buchhaltung'), " +
          "productIds, projectId, customerId, employeeId, kind, confidence, reason, document, " +
          "specs, productSpecs, product_suggestion.",
      },
      { role: "user", content: userContent },
    ],
    { maxTokens: 1200 },
  );

  if (!result) return NextResponse.json({ enabled: true, result: null });

  // Defensiv normalisieren.
  const allowedTargets: ClassifyTarget[] = ["produkt", "projekt", "kunde", "mitarbeiter", "buchhaltung"];
  const target = allowedTargets.includes(result.target) ? result.target : "projekt";
  const customerId =
    typeof result.customerId === "string" && customerIds.has(result.customerId) ? result.customerId : null;
  const employeeId =
    typeof result.employeeId === "string" && employeeIds.has(result.employeeId) ? result.employeeId : null;
  const normalized: ClassifyResult = {
    target,
    productIds: Array.isArray(result.productIds) ? result.productIds : [],
    projectId: result.projectId ?? null,
    customerId,
    employeeId,
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
