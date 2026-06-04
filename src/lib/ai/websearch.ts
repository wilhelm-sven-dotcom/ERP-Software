import "server-only";

/**
 * Schlanke Web-Such-Anbindung für die Produkt-Datenanreicherung
 * („technische Daten aus dem Netz ziehen"). Provider-agnostisch über Env:
 *
 *   WEB_SEARCH_API_KEY   – API-Schlüssel (Pflicht, sonst Funktion aus)
 *   WEB_SEARCH_PROVIDER  – "tavily" (Default) | "brave"
 *
 * Goldene Regel: ohne Key ist die Web-Suche schlicht aus — Aufrufer prüfen
 * `isWebSearchConfigured()` und verhalten sich sonst wie bisher.
 */

export interface WebResult {
  title: string;
  url: string;
  /** Bereinigter Seiteninhalt (soweit vom Provider geliefert) bzw. Snippet. */
  content: string;
}

export function isWebSearchConfigured(): boolean {
  return Boolean(process.env.WEB_SEARCH_API_KEY);
}

function provider(): "tavily" | "brave" {
  return process.env.WEB_SEARCH_PROVIDER === "brave" ? "brave" : "tavily";
}

/**
 * Websuche → Liste relevanter Treffer mit (möglichst) Volltext. Fehlertolerant:
 * bei Problemen leeres Array, damit die UI sauber zurückfällt.
 */
export async function webSearch(
  query: string,
  opts: { maxResults?: number; timeoutMs?: number } = {},
): Promise<WebResult[]> {
  if (!isWebSearchConfigured() || !query.trim()) return [];
  const maxResults = opts.maxResults ?? 5;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    if (provider() === "brave") return await braveSearch(query, maxResults, controller.signal);
    return await tavilySearch(query, maxResults, controller.signal);
  } catch (e) {
    if ((e as Error).name !== "AbortError") console.error("Websuche fehlgeschlagen:", e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function tavilySearch(query: string, maxResults: number, signal: AbortSignal): Promise<WebResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.WEB_SEARCH_API_KEY,
      query,
      search_depth: "advanced",
      max_results: maxResults,
      include_raw_content: true,
    }),
    signal,
  });
  if (!res.ok) {
    console.error("Tavily-Fehler:", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string; raw_content?: string }[];
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    content: (r.raw_content || r.content || "").slice(0, 6000),
  }));
}

async function braveSearch(query: string, maxResults: number, signal: AbortSignal): Promise<WebResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.WEB_SEARCH_API_KEY ?? "",
    },
    signal,
  });
  if (!res.ok) {
    console.error("Brave-Fehler:", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = (await res.json()) as {
    web?: { results?: { title?: string; url?: string; description?: string }[] };
  };
  // Brave liefert nur Snippets (kein Volltext) — reicht der KI als Ausgangspunkt.
  return (data.web?.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    content: (r.description ?? "").slice(0, 2000),
  }));
}

/**
 * Bild-Suche (für Produktfotos). Aktuell nur über Tavily (`include_images`).
 * Liefert direkte Bild-URLs. Fehlertolerant → leeres Array.
 */
export async function webImageSearch(
  query: string,
  opts: { maxResults?: number; timeoutMs?: number } = {},
): Promise<string[]> {
  if (!isWebSearchConfigured() || !query.trim() || provider() !== "tavily") return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.WEB_SEARCH_API_KEY,
        query,
        search_depth: "basic",
        include_images: true,
        max_results: opts.maxResults ?? 5,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { images?: (string | { url?: string })[] };
    return (data.images ?? [])
      .map((i) => (typeof i === "string" ? i : i?.url ?? ""))
      .filter((u) => /^https?:\/\//.test(u));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
