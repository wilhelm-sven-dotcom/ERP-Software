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

/**
 * Produkte im Volltext eines Datenblatts erkennen — STRENG präzisionsorientiert.
 * Nur eindeutige Belege zählen, damit Geschwister-Modelle (z. B. „…3.0/4.0")
 * oder fremde Linien NICHT fälschlich vormarkiert werden, nur weil ihre Ziffern
 * irgendwo im Text vorkommen:
 *
 *   (a) ARTIKELNUMMER (SKU, ≥ 4 Zeichen) als exakter Substring, ODER
 *   (b) der vollständige PRODUKTNAME als ZUSAMMENHÄNGENDE Phrase (Wortgrenzen).
 *
 * Verstreute Einzel-Tokens (Wort hier, Zahl dort) reichen bewusst NICHT mehr.
 * Recall übernimmt die KI-Stufe; hier zählt Genauigkeit (keine Vorab-Häkchen-Flut).
 */
export function matchProductsInText(text: string, products: Product[]): string[] {
  const hay = text.toLowerCase();
  if (hay.trim().length < 10 || products.length === 0) return [];
  // Normalisierter Heuhaufen (Trenner/Punkte → Leerzeichen), mit Rand-Spaces für
  // Wortgrenzen-Vergleich. So matcht „sma sunny tripower 10 0" als Phrase, aber
  // nicht über verstreute Zahlen.
  const hayNorm = ` ${normalize(text)} `;

  const ids: string[] = [];
  for (const p of products) {
    // (a) Artikelnummer exakt → stärkster, eindeutiger Beleg.
    const sku = p.sku?.toLowerCase().trim();
    if (sku && sku.length >= 4 && hay.includes(sku)) {
      ids.push(p.id);
      continue;
    }
    // (b) Vollständiger Produktname als zusammenhängende Phrase mit Wortgrenzen.
    const name = normalize(p.name ?? "");
    if (name.length >= 6 && hayNorm.includes(` ${name} `)) {
      ids.push(p.id);
    }
  }
  return ids;
}

