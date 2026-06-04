import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { isAiConfigured } from "@/lib/ai/openai";

/**
 * Sprach-Transkription (OpenAI Whisper). Nimmt eine Audiodatei (multipart
 * „file") und liefert den erkannten Text — für die Spracheingabe im Assistenten.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ enabled: true, text: null });
  }
  if (!file) return NextResponse.json({ enabled: true, text: null });

  const out = new FormData();
  out.set("file", file, file.name || "audio.webm");
  out.set("model", "whisper-1");
  out.set("language", "de");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: out,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("Whisper-Fehler:", res.status);
      return NextResponse.json({ enabled: true, text: null });
    }
    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ enabled: true, text: data.text ?? "" });
  } catch (e) {
    if ((e as Error).name !== "AbortError") console.error("Transkription fehlgeschlagen:", e);
    return NextResponse.json({ enabled: true, text: null });
  } finally {
    clearTimeout(timeout);
  }
}
