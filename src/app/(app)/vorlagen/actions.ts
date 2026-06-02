"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

/** Leere Kalkulationsvorlage anlegen und in deren Editor springen. */
export async function createCalcTemplate(): Promise<void> {
  if (ensureConfigured()) return;
  const supabase = await createClient();
  const me = await getCurrentEmployee();
  const { data, error } = await supabase
    .from("calc_templates")
    .insert({
      name: "Neue Vorlage",
      positions: [],
      defaults: { mwstPercent: 0 },
      created_by: me?.id || null,
    })
    .select("id")
    .single();
  if (error || !data) return;
  revalidatePath("/vorlagen");
  redirect(`/vorlagen/${data.id}`);
}

/** Kalkulationsvorlage speichern (Name, Positionen, Defaults). */
export async function saveCalcTemplate(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const id = String(fd.get("id") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  if (!id) return fail("Vorlage fehlt.");
  if (!name) return fail("Bitte einen Namen angeben.");

  let positions: unknown = [];
  let defaults: unknown = {};
  try {
    positions = JSON.parse(String(fd.get("positions") ?? "[]"));
    defaults = JSON.parse(String(fd.get("defaults") ?? "{}"));
  } catch {
    return fail("Ungültige Positionsdaten.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("calc_templates")
    .update({ name, positions, defaults })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/vorlagen");
  revalidatePath(`/vorlagen/${id}`);
  return OK;
}

export async function deleteCalcTemplate(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("calc_templates").delete().eq("id", id);
  revalidatePath("/vorlagen");
  redirect("/vorlagen");
}
