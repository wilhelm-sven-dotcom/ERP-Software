import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatRaw, isAiConfigured } from "@/lib/ai/openai";

/**
 * Allzweck-Textgenerierung (Angebotstexte, Mahntexte, E-Mails …).
 * Erwartet { prompt, context? } und liefert reinen Text auf Deutsch.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false });

  let prompt = "";
  let context = "";
  try {
    const body = (await req.json()) as { prompt?: string; context?: string };
    prompt = (body.prompt ?? "").slice(0, 2000);
    context = (body.context ?? "").slice(0, 2000);
  } catch {
    return NextResponse.json({ enabled: true, text: null });
  }
  if (prompt.trim().length < 3) return NextResponse.json({ enabled: true, text: null });

  const msg = await chatRaw(
    [
      {
        role: "system",
        content:
          "Du bist Texter für einen PV-/Speicher-Handwerksbetrieb. Schreibe professionelle, " +
          "freundliche, klare Texte auf Deutsch (Sie-Form). Gib NUR den fertigen Text zurück, " +
          "ohne Vorrede, ohne Anführungszeichen, ohne Platzhalter in eckigen Klammern.",
      },
      {
        role: "user",
        content: context ? `Kontext:\n${context}\n\nAufgabe: ${prompt}` : prompt,
      },
    ],
    { maxTokens: 700 },
  );
  return NextResponse.json({ enabled: true, text: msg?.content ?? "" });
}
