import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatJSON, isAiConfigured, type ContentPart } from "@/lib/ai/openai";

interface DraftResult {
  work_done?: string;
  weather?: string;
  crew?: string;
  note?: string;
}

/**
 * Baustellenfoto → Entwurf für einen Bautagebuch-Eintrag (Vision).
 * Liefert vorgeschlagene Felder; der Nutzer prüft/ergänzt und speichert selbst.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false });

  let image = "";
  try {
    const body = (await req.json()) as { image?: string };
    image = body.image ?? "";
  } catch {
    return NextResponse.json({ enabled: true, draft: null });
  }
  if (!image.startsWith("data:")) return NextResponse.json({ enabled: true, draft: null });

  const content: ContentPart[] = [
    {
      type: "text",
      text:
        "Das ist ein Foto von einer PV-/Bau-Baustelle. Beschreibe sachlich für ein Bautagebuch, " +
        "was zu sehen ist und welche Arbeiten erkennbar sind. Schätze, falls erkennbar, das Wetter. " +
        "Gib JSON zurück: { work_done: kurzer Absatz zu den Arbeiten/Fortschritt, weather: " +
        "Wetter falls erkennbar sonst leer, crew: leer lassen, note: optionale Auffälligkeiten/Mängel }. " +
        "Nur was wirklich sichtbar ist, nichts erfinden.",
    },
    { type: "image_url", image_url: { url: image } },
  ];

  const draft = await chatJSON<DraftResult>(
    [{ role: "user", content }],
    { maxTokens: 600 },
  );
  if (!draft) return NextResponse.json({ enabled: true, draft: null });
  return NextResponse.json({
    enabled: true,
    draft: {
      work_done: typeof draft.work_done === "string" ? draft.work_done : "",
      weather: typeof draft.weather === "string" ? draft.weather : "",
      crew: typeof draft.crew === "string" ? draft.crew : "",
      note: typeof draft.note === "string" ? draft.note : "",
    },
  });
}
