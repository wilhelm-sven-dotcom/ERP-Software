import "server-only";

/**
 * Schlanke OpenAI-Anbindung (ohne zusätzliche Abhängigkeit) für die
 * intelligente Suche/Assistenz und die KI-gestützte Datei-Zuordnung.
 *
 * Goldene Regel: ohne `OPENAI_API_KEY` ist die KI schlicht aus — alle
 * Aufrufer prüfen `isAiConfigured()` und verhalten sich sonst wie bisher.
 */

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBED_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-small"; // 1536 Dimensionen

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function aiModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

/** Inhalts-Teil einer Nachricht: Text oder Bild (für Vision-fähige Modelle). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

/** Werkzeug-Definition für Function-Calling. */
export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
}

/**
 * Ein einzelner Chat-Aufruf, der ein JSON-Objekt zurückgibt
 * (`response_format: json_object`). Fehlertolerant: bei Problemen `null`,
 * damit die UI sauber auf das bisherige Verhalten zurückfällt.
 */
export async function chatJSON<T = Record<string, unknown>>(
  messages: ChatMessage[],
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<T | null> {
  if (!isAiConfigured()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: aiModel(),
        temperature: 0,
        max_tokens: opts.maxTokens ?? 800,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("OpenAI-Fehler:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch (e) {
    if ((e as Error).name !== "AbortError") console.error("OpenAI-Aufruf fehlgeschlagen:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Embedding-Vektor für einen Text (für die semantische Dokumentsuche).
 * Fehlertolerant → null. Text wird gekürzt (Tokenlimit/Kosten).
 */
export async function embed(text: string, timeoutMs = 20000): Promise<number[] | null> {
  if (!isAiConfigured() || !text.trim()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("OpenAI-Embedding-Fehler:", res.status);
      return null;
    }
    const data = (await res.json()) as { data?: { embedding?: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch (e) {
    if ((e as Error).name !== "AbortError") console.error("Embedding fehlgeschlagen:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ein Chat-Aufruf mit optionalem Function-Calling. Gibt die rohe
 * Assistant-Nachricht zurück (inkl. tool_calls), damit der Aufrufer eine
 * Werkzeug-Schleife (Agent) fahren kann. `messages` darf auch Tool-Ergebnisse
 * enthalten (role: "tool", tool_call_id, content). Fehlertolerant → null.
 */
export async function chatRaw(
  messages: unknown[],
  opts: { tools?: ChatTool[]; maxTokens?: number; timeoutMs?: number } = {},
): Promise<AssistantMessage | null> {
  if (!isAiConfigured()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: aiModel(),
        temperature: 0,
        max_tokens: opts.maxTokens ?? 1200,
        messages,
        ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("OpenAI-Fehler:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: AssistantMessage }[];
    };
    return data.choices?.[0]?.message ?? null;
  } catch (e) {
    if ((e as Error).name !== "AbortError") console.error("OpenAI-Aufruf fehlgeschlagen:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
