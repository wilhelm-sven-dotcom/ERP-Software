"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}
function num(fd: FormData, k: string): number | null {
  const v = s(fd, k);
  if (v === null) return null;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

/** Zeiteintrag anlegen/aktualisieren. */
export async function saveTimeEntry(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const projectId = s(fd, "project_id");
  const hours = num(fd, "hours");
  if (!projectId) return fail("Bitte ein Projekt wählen.");
  if (hours === null || hours <= 0) return fail("Bitte gültige Stunden angeben.");

  const me = await getCurrentEmployee();
  const supabase = await createClient();
  const id = s(fd, "id");
  const payload = {
    project_id: projectId,
    employee_id: s(fd, "employee_id") ?? me?.id ?? null,
    work_date: s(fd, "work_date") ?? new Date().toISOString().slice(0, 10),
    hours,
    activity: s(fd, "activity"),
    description: s(fd, "description"),
    hourly_rate: num(fd, "hourly_rate"),
  };
  const { error } = id
    ? await supabase.from("time_entries").update(payload).eq("id", id)
    : await supabase
        .from("time_entries")
        .insert({ ...payload, created_by: me?.id ?? null });
  if (error) return fail(error.message);
  revalidatePath("/zeiterfassung");
  revalidatePath(`/projekte/${projectId}`);
  return OK;
}

export async function deleteTimeEntry(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("time_entries").delete().eq("id", id);
  revalidatePath("/zeiterfassung");
  if (projectId) revalidatePath(`/projekte/${projectId}`);
}

export interface ImportTimeRow {
  external_id?: string;
  project_id: string;
  employee_id?: string | null;
  work_date?: string;
  hours: number;
  activity?: string;
  description?: string;
}

export interface ImportResult extends ActionResult {
  imported?: number;
  skipped?: number;
}

/** Stunden aus der Altsoftware importieren (Dedupe über source+external_id). */
export async function importTimeEntries(
  rows: ImportTimeRow[],
): Promise<ImportResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!Array.isArray(rows) || rows.length === 0) return fail("Keine Zeilen.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();

  let imported = 0;
  let skipped = 0;
  for (const r of rows) {
    if (!r.project_id || !(Number(r.hours) > 0)) {
      skipped++;
      continue;
    }
    const { error } = await supabase
      .from("time_entries")
      .upsert(
        {
          project_id: r.project_id,
          employee_id: r.employee_id ?? null,
          work_date: r.work_date ?? new Date().toISOString().slice(0, 10),
          hours: Number(r.hours),
          activity: r.activity ?? null,
          description: r.description ?? null,
          source: "import",
          external_id: r.external_id ?? null,
          created_by: me?.id ?? null,
        },
        { onConflict: "source,external_id", ignoreDuplicates: true },
      );
    if (error) skipped++;
    else imported++;
  }
  revalidatePath("/zeiterfassung");
  return { ok: true, imported, skipped };
}
