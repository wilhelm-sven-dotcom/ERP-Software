import type { Product } from "@/lib/types";

/** Dateiname normalisieren: Endung weg, Trenner zu Leerzeichen, klein. */
function normalize(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function tokens(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length >= 2);
}

export interface MatchCandidate {
  product: Product;
  score: number;
}

/**
 * Produkte für einen Dateinamen ranken. Höchstes Gewicht hat die Artikelnummer
 * (SKU), dann Hersteller + Name-Tokens. Liefert die besten Treffer absteigend.
 */
export function rankProductsForFilename(
  filename: string,
  products: Product[],
  limit = 5,
): MatchCandidate[] {
  const fname = normalize(filename);
  const fTokens = tokens(fname);
  if (fTokens.length === 0) return [];

  const scored: MatchCandidate[] = [];
  for (const p of products) {
    let score = 0;
    const sku = p.sku?.toLowerCase().trim();
    if (sku && sku.length >= 3 && fname.includes(sku)) score += 100;

    const nameTokens = tokens(normalize(p.name ?? ""));
    const manTokens = tokens(normalize(p.manufacturer ?? ""));
    for (const ft of fTokens) {
      if (nameTokens.includes(ft)) score += 5;
      if (manTokens.includes(ft)) score += 4;
      // Teiltreffer (z. B. Modellnummer im längeren Token).
      else if (nameTokens.some((nt) => nt.includes(ft) || ft.includes(nt)))
        score += 2;
    }
    if (score > 0) scored.push({ product: p, score });
  }
  scored.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
  return scored.slice(0, limit);
}

/** Wenig aussagekräftige Wörter (Marken-/Domänen-Vokabular). */
const STOPWORDS = new Set([
  "energy", "energie", "system", "systeme", "hybrid", "controller", "control",
  "inverter", "wechselrichter", "charger", "ladestation", "ladesaeule", "ladesäule",
  "wallbox", "modul", "module", "panel", "speicher", "battery", "batterie", "storage",
  "solar", "photovoltaik", "pv", "ac", "dc", "kw", "kwp", "kwh", "kva", "watt", "wp",
  "pro", "plus", "max", "mini", "smart", "home", "set", "single", "phase", "phasig",
  "dreiphasig", "einphasig", "serie", "series", "gmbh", "datenblatt", "datasheet",
  "the", "und", "and", "der", "die", "das", "für", "fuer", "mit", "von",
]);

const hasDigit = (t: string) => /\d/.test(t);

/**
 * Produkte im Volltext eines Datenblatts erkennen — präzisionsorientiert.
 * Nur die Produkte, für die das Datenblatt tatsächlich gilt, werden geliefert.
 *
 * Idee: Tokens, die in VIELEN Produkten vorkommen (Serien-/Markenwörter wie
 * „sigen", „energy"), sind nicht unterscheidend und werden ignoriert. Ein
 * Produkt matcht nur, wenn seine ARTIKELNUMMER, sein vollständiger NAME oder
 * ALLE seine DISTINKTIVEN Tokens (Modellnummern/seltene Wörter) im Text stehen.
 *
 * Zusätzlich: reine WORT-Treffer (ohne Modellnummer) gelten nur, wenn sie im
 * TITEL-/Kopfbereich des Dokuments stehen. So werden kompatible Zubehörteile,
 * die ein Datenblatt nur im Fließtext nennt (z. B. „SMA Energy Meter",
 * „Home Manager"), NICHT fälschlich als Datenblatt-Produkt markiert — während
 * echte Mehrfach-Datenblätter (Modellnummern wie 5.0/6.0/8.0) weiter greifen.
 */
export function matchProductsInText(text: string, products: Product[]): string[] {
  const hay = text.toLowerCase();
  if (hay.trim().length < 10 || products.length === 0) return [];
  // Titel-/Kopfbereich: erste ~500 Zeichen (Produktname/Modell des Datenblatts).
  const title = hay.slice(0, 500);

  // Dokumentfrequenz je Token über alle Produktnamen.
  const df = new Map<string, number>();
  const manTokensAll = new Set<string>();
  const nameTokensByProduct = new Map<string, string[]>();
  for (const p of products) {
    // Namens-Tokens ab 3 Zeichen ODER reine Modellnummern (z. B. „10") behalten.
    const nt = Array.from(
      new Set(tokens(normalize(p.name ?? "")).filter((t) => t.length >= 3 || /^\d+$/.test(t))),
    );
    nameTokensByProduct.set(p.id, nt);
    for (const t of nt) df.set(t, (df.get(t) ?? 0) + 1);
    for (const mt of tokens(normalize(p.manufacturer ?? ""))) manTokensAll.add(mt);
  }
  const n = products.length;
  // „Häufig" = kommt in ≥ 40 % der Produkte (und in ≥ 3) vor → nicht unterscheidend.
  const commonThreshold = Math.max(3, Math.ceil(n * 0.4));
  const isGeneric = (t: string) =>
    STOPWORDS.has(t) || manTokensAll.has(t) || (df.get(t) ?? 0) >= commonThreshold;
  // „Spezifisch" = Ziffern-Modellnummer oder sehr seltenes Wort (≤ 2 Produkte).
  const isSpecific = (t: string) => hasDigit(t) || (df.get(t) ?? 0) <= 2;

  const ids: string[] = [];
  for (const p of products) {
    const sku = p.sku?.toLowerCase().trim();
    if (sku && sku.length >= 4 && hay.includes(sku)) {
      ids.push(p.id);
      continue;
    }
    const name = normalize(p.name ?? "");
    // Vollständiger Name: als zusammenhängender Substring ODER alle Namens-Tokens
    // im Text (toleriert Zeilenumbrüche/Umformatierung im PDF). Akzeptiert nur,
    // wenn der Name eine Modellnummer (Ziffer) enthält oder im Titel steht — so
    // matchen echte Produkte (auch umformatiert), Zubehör im Fließtext nicht.
    const nameTokensAll = tokens(name);
    const nameTokensPresent =
      nameTokensAll.length > 0 && nameTokensAll.every((t) => hay.includes(t));
    if (
      name.length >= 6 &&
      (hay.includes(name) || nameTokensPresent) &&
      (hasDigit(name) || title.includes(name))
    ) {
      ids.push(p.id);
      continue;
    }
    const nt = nameTokensByProduct.get(p.id) ?? [];
    // Distinktive Tokens: Ziffern-Tokens immer, sonst nur nicht-generische.
    const distinctive = nt.filter((t) => hasDigit(t) || !isGeneric(t));
    if (distinctive.length === 0) continue;
    const allPresent = distinctive.every((t) => hay.includes(t));
    if (!allPresent) continue;
    // Akzeptiere nur mit echtem Beleg: eine Modellnummer (Ziffern-Token) irgendwo
    // im Text ODER ein spezifisches Wort im TITEL-/Kopfbereich. Reine Zubehör-
    // Erwähnungen im Fließtext (Wort ohne Modellnummer) zählen nicht.
    const hasDigitToken = distinctive.some((t) => hasDigit(t) && hay.includes(t));
    const specificWordInTitle = distinctive.some((t) => !hasDigit(t) && isSpecific(t) && title.includes(t));
    if (hasDigitToken || specificWordInTitle) ids.push(p.id);
  }
  return ids;
}

