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
 * Produkte im (klein geschriebenen) Volltext eines Datenblatts erkennen.
 * Trefferregeln: Artikelnummer (SKU, ≥ 4 Zeichen) kommt im Text vor → sicher;
 * ODER der vollständige Produktname kommt vor; ODER genügend Name-Tokens
 * (inkl. einer Modellnummer mit Ziffern) tauchen auf, gestützt vom Hersteller.
 * Liefert die IDs aller erkannten Produkte (für Mehrfach-Vorauswahl).
 */
export function matchProductsInText(text: string, products: Product[]): string[] {
  const hay = text.toLowerCase();
  if (hay.trim().length < 10) return [];
  const ids: string[] = [];

  for (const p of products) {
    const sku = p.sku?.toLowerCase().trim();
    if (sku && sku.length >= 4 && hay.includes(sku)) {
      ids.push(p.id);
      continue;
    }
    const name = normalize(p.name ?? "");
    if (name.length >= 5 && hay.includes(name)) {
      ids.push(p.id);
      continue;
    }
    const nameTokens = tokens(name).filter((t) => t.length >= 3);
    if (nameTokens.length === 0) continue;
    const present = nameTokens.filter((t) => hay.includes(t));
    const hasModelNumber = present.some((t) => /\d/.test(t) && t.length >= 3);
    const man = normalize(p.manufacturer ?? "");
    const manPresent = man.length >= 3 && hay.includes(man);
    // Modellnummer im Text ODER (Hersteller + mehrere Name-Tokens) treffen.
    if (hasModelNumber || (manPresent && present.length >= 2)) {
      ids.push(p.id);
    }
  }
  return ids;
}
