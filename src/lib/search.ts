import type { Product } from "@/lib/types";

/**
 * Tokenisierte Produktsuche: Die Eingabe wird an Leerzeichen in Tokens zerlegt;
 * ein Produkt passt, wenn **jedes** Token irgendwo in Name, Hersteller, SKU oder
 * Kategorie vorkommt (Token-UND). So findet „SICK Energy 10" auch „SICK Energy
 * AC 10", obwohl die Wörter nicht zusammenhängend stehen.
 */
export function productMatches(p: Product, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [p.name, p.manufacturer, p.sku, p.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}
