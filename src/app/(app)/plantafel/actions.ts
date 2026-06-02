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

export async function saveDispoEntry(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const title = s(fd, "title");
  const date = s(fd, "date");
  if (!title || !date) return fail("Bitte Titel und Datum angeben.");

  const payload = {
    project_id: s(fd, "project_id"),
    employee_id: s(fd, "employee_id"),
    date,
    title,
    kind: s(fd, "kind") ?? "einsatz",
    note: s(fd, "note"),
  };
  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("dispo_entries").update(payload).eq("id", id)
    : await supabase
        .from("dispo_entries")
        .insert({ ...payload, created_by: (await getCurrentEmployee())?.id ?? null });
  if (error) return fail(error.message);
  revalidatePath("/plantafel");
  return OK;
}

/** Per Drag & Drop verschieben: neuer Mitarbeiter und/oder neues Datum. */
export async function moveDispoEntry(
  id: string,
  employeeId: string | null,
  date: string,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!id || !date) return fail("Ungültige Daten.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("dispo_entries")
    .update({ employee_id: employeeId, date })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/plantafel");
  return OK;
}

export async function deleteDispoEntry(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("dispo_entries").delete().eq("id", id);
  revalidatePath("/plantafel");
}
