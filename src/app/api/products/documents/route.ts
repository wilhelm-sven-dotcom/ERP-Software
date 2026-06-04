import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatJSON, isAiConfigured } from "@/lib/ai/openai";
import { isWebSearchConfigured, webSearch, webImageSearch } from "@/lib/ai/websearch";

export const maxDuration = 60;

type DocKind = "datasheet" | "manual" | "certificate" | "image";

interface DocBody {
  name?: string;
  manufacturer?: string;
  wants?: DocKind[];
}

export interface FoundDocument {
  kind: DocKind;
  title: string;
  url: string;
}

const QUERY: Record<Exclude<DocKind, "image">, (n: string) => string> = {
  datasheet: (n) => `${n} Datenblatt datasheet filetype:pdf`,
  manual: (n) => `${n} Bedienungsanleitung Installationsanleitung manual filetype:pdf`,
  certificate: (n) => `${n} Konformitätserklärung CE Zertifikat declaration of conformity filetype:pdf`,
};
const LABEL: Record<DocKind, string> = {
  datasheet: "Datenblatt",
  manual: "Bedienungs-/Installationsanleitung",
  certificate: "Zertifikat / Konformität",
  image: "Produktbild",
};

/**
 * Sucht zu einem Produkt die echten Dokumente im Netz (Datenblatt, Anleitung,
 * Zertifikat) und ein Produktbild. Die KI wählt je Typ die beste, zum Modell
 * passende Quelle (bevorzugt Hersteller-Domain & PDF). Rückgabe: Kandidaten,
 * die der Nutzer prüft und anhängt. Ohne KI/Web-Suche: graceful aus.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false, reason: "KI nicht konfiguriert." });
  if (!isWebSearchConfigured())
    return NextResponse.json({ enabled: false, reason: "Web-Suche nicht konfiguriert." });

  let body: DocBody;
  try {
    body = (await req.json()) as DocBody;
  } catch {
    return NextResponse.json({ enabled: true, result: null });
  }
  const name = (body.name ?? "").trim().slice(0, 200);
  const manufacturer = (body.manufacturer ?? "").trim().slice(0, 100);
  if (!name) return NextResponse.json({ enabled: true, result: null, reason: "Produktname fehlt." });
  const wants: DocKind[] = Array.isArray(body.wants) && body.wants.length
    ? body.wants
    : ["datasheet", "manual", "certificate", "image"];
  const full = `${manufacturer} ${name}`.trim();

  // 1) Pro Dokumenttyp Web-Treffer sammeln; Bild separat über Bild-Suche.
  const docKinds = wants.filter((w): w is Exclude<DocKind, "image"> => w !== "image");
  const searches = await Promise.all(
    docKinds.map((k) => webSearch(QUERY[k](full), { maxResults: 5 })),
  );
  const candidates: { kind: DocKind; title: string; url: string }[] = [];
  docKinds.forEach((k, i) => {
    for (const h of searches[i]) if (h.url) candidates.push({ kind: k, title: h.title, url: h.url });
  });

  const documents: FoundDocument[] = [];

  // 2) KI wählt je Dokumenttyp die beste passende URL aus den Kandidaten.
  if (candidates.length > 0) {
    const picked = await chatJSON<{ documents?: FoundDocument[] }>(
      [
        {
          role: "system",
          content:
            "Du wählst zu einem PV-/Speicher-Produkt die jeweils BESTE Quelle pro Dokumenttyp aus einer " +
            "Kandidatenliste. Strikt: nur URLs, die WIRKLICH zum genannten Hersteller UND Modell gehören. " +
            "Bevorzuge die OFFIZIELLE Hersteller-Domain und direkte PDF-Links. Pro 'kind' (datasheet|" +
            "manual|certificate) höchstens EINE URL; wenn nichts sicher passt, lass den Typ weg. Niemals " +
            "URLs erfinden — nur aus der Liste. Antworte als JSON { documents: [{ kind, title, url }] }.",
        },
        {
          role: "user",
          content:
            `Produkt: ${full}\nGesuchte Typen: ${docKinds.join(", ")}\n\nKandidaten (JSON):\n` +
            JSON.stringify(candidates.slice(0, 40)),
        },
      ],
      { maxTokens: 500 },
    );
    const valid = new Set(candidates.map((c) => c.url));
    for (const d of picked?.documents ?? []) {
      if (d && typeof d.url === "string" && valid.has(d.url) && d.kind !== "image") {
        documents.push({ kind: d.kind, title: d.title || LABEL[d.kind], url: d.url });
      }
    }
  }

  // 3) Produktbild (direkte Bild-URL) über die Bild-Suche.
  if (wants.includes("image")) {
    const imgs = await webImageSearch(`${full} Produktfoto product photo`, { maxResults: 5 });
    if (imgs[0]) documents.push({ kind: "image", title: "Produktbild", url: imgs[0] });
  }

  return NextResponse.json({ enabled: true, result: { documents } });
}
