import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { createRueckfrage } from "@/app/(app)/workflow/actions";

/**
 * Führt eine vom Assistenten vorgeschlagene Aktion aus — erst NACH Bestätigung
 * durch den Nutzer. RLS bleibt die Wahrheit (die Aktion läuft im Kontext des
 * angemeldeten Nutzers).
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });

  let body: {
    action?: string;
    task?: {
      title?: string;
      body?: string;
      employeeIds?: string[];
      projectId?: string | null;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Daten." }, { status: 400 });
  }

  if (body.action === "create_task") {
    const t = body.task ?? {};
    if (!t.title) return NextResponse.json({ ok: false, error: "Betreff fehlt." });
    if (!t.employeeIds || t.employeeIds.length === 0)
      return NextResponse.json({ ok: false, error: "Kein Kollege ausgewählt." });

    const fd = new FormData();
    fd.set("title", t.title);
    fd.set("body", t.body ?? "");
    fd.set("employee_ids", t.employeeIds.join(","));
    if (t.projectId) fd.set("project_id", t.projectId);

    const res = await createRueckfrage({ ok: false }, fd);
    return NextResponse.json({ ok: res.ok, error: res.error ?? null });
  }

  return NextResponse.json({ ok: false, error: "Unbekannte Aktion." }, { status: 400 });
}
