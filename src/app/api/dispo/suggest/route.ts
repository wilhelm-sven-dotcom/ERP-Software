import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Vorschlag „wer ist frei?" für die Plantafel: berücksichtigt genehmigte
 * Abwesenheiten (Urlaub/krank), aktuelle Auslastung am Tag und – falls ein
 * Skill gefragt ist – passende Qualifikationen. RLS-sicher (normaler Client).
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let date = "";
  let skill = "";
  try {
    const body = (await req.json()) as { date?: string; skill?: string };
    date = (body.date ?? "").slice(0, 10);
    skill = (body.skill ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ suggestions: [] });

  const supabase = await createClient();
  const [{ data: emps }, { data: absences }, { data: load }] = await Promise.all([
    supabase.from("employees").select("id, name, email, skills").eq("active", true),
    supabase
      .from("employee_absences")
      .select("employee_id, absence_type")
      .eq("status", "approved")
      .lte("start_date", date)
      .gte("end_date", date),
    supabase.from("dispo_entries").select("employee_id").eq("date", date),
  ]);

  const absentBy = new Map<string, string>();
  for (const a of absences ?? []) if (a.employee_id) absentBy.set(a.employee_id, a.absence_type);
  const loadBy = new Map<string, number>();
  for (const d of load ?? []) if (d.employee_id) loadBy.set(d.employee_id, (loadBy.get(d.employee_id) ?? 0) + 1);

  const suggestions = (emps ?? [])
    .map((e) => {
      const skills = Array.isArray(e.skills) ? (e.skills as string[]) : [];
      const absent = absentBy.has(e.id);
      const n = loadBy.get(e.id) ?? 0;
      const skillMatch = skill ? skills.some((s) => s.toLowerCase().includes(skill)) : false;
      // Score: verfügbar > Skill-Treffer > geringe Auslastung.
      let score = 0;
      if (!absent) score += 100;
      if (skillMatch) score += 30;
      score -= n * 10;
      const reasons: string[] = [];
      if (absent) reasons.push(`abwesend (${absentBy.get(e.id)})`);
      else reasons.push(n === 0 ? "frei" : `${n} Einsatz/Einsätze`);
      if (skillMatch) reasons.push(`Skill: ${skill}`);
      return {
        id: e.id,
        name: e.name ?? e.email ?? "Mitarbeiter",
        available: !absent,
        load: n,
        skillMatch,
        score,
        reason: reasons.join(" · "),
      };
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ suggestions });
}
