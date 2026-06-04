import "server-only";

/**
 * Anbindung an **Azure AI Document Intelligence** (EU-fähig) zur robusten
 * Auslese von PDFs/Bildern — auch Scans und Tabellen. Liefert sauberen Text
 * (Markdown) als Grundlage für Klassifizierung/Anreicherung.
 *
 * Env (EU-Region wählen, DSGVO):
 *   AZURE_DOCINTEL_ENDPOINT  z. B. https://<name>.cognitiveservices.azure.com
 *   AZURE_DOCINTEL_KEY       Schlüssel 1 der Ressource
 *
 * Ohne Keys ist die Funktion aus (Aufrufer prüfen `isDocIntelConfigured()` und
 * fallen auf die bisherige pdf.js-Auslese zurück).
 */

const API_VERSION = "2024-11-30";

export function isDocIntelConfigured(): boolean {
  return Boolean(process.env.AZURE_DOCINTEL_ENDPOINT && process.env.AZURE_DOCINTEL_KEY);
}

export interface DocIntelResult {
  text: string;
  tableCount: number;
}

/**
 * Ein Dokument (PDF/Bild) analysieren → bereinigter Text (Markdown). Nutzt das
 * „prebuilt-layout"-Modell (Text + Tabellen). Fehlertolerant → `null`.
 */
export async function analyzeDocument(
  bytes: ArrayBuffer,
  contentType: string,
  opts: { timeoutMs?: number } = {},
): Promise<DocIntelResult | null> {
  if (!isDocIntelConfigured()) return null;
  const endpoint = process.env.AZURE_DOCINTEL_ENDPOINT!.replace(/\/+$/, "");
  const key = process.env.AZURE_DOCINTEL_KEY!;
  const deadline = Date.now() + (opts.timeoutMs ?? 55000);

  try {
    // 1) Analyse anstoßen (binär), Ausgabe als Markdown.
    const analyzeUrl =
      `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze` +
      `?api-version=${API_VERSION}&outputContentFormat=markdown`;
    const start = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": contentType || "application/octet-stream",
      },
      body: bytes,
    });
    if (start.status !== 202) {
      console.error("Azure DI analyze:", start.status, await start.text().catch(() => ""));
      return null;
    }
    const opLocation = start.headers.get("operation-location");
    if (!opLocation) return null;

    // 2) Auf Ergebnis pollen.
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await fetch(opLocation, { headers: { "Ocp-Apim-Subscription-Key": key } });
      if (!poll.ok) {
        console.error("Azure DI poll:", poll.status);
        return null;
      }
      const data = (await poll.json()) as {
        status?: string;
        analyzeResult?: { content?: string; tables?: unknown[] };
      };
      if (data.status === "succeeded") {
        return {
          text: (data.analyzeResult?.content ?? "").slice(0, 16000),
          tableCount: Array.isArray(data.analyzeResult?.tables) ? data.analyzeResult!.tables!.length : 0,
        };
      }
      if (data.status === "failed") {
        console.error("Azure DI failed");
        return null;
      }
    }
    return null; // Timeout
  } catch (e) {
    console.error("Azure DI Aufruf fehlgeschlagen:", e);
    return null;
  }
}
