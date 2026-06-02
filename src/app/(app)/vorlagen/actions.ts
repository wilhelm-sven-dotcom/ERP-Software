"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

/** Angebots-Textbaustein anlegen/aktualisieren (nur Admin via RLS). */
export async function saveTextBlock(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "").trim();
  const kind = String(fd.get("kind") ?? "").trim();
  if (!kind) return fail("Art des Bausteins fehlt.");
  const ptRaw = String(fd.get("project_type") ?? "").trim();
  const projectType = ptRaw && ptRaw !== "__standard__" ? ptRaw : null;
  const payload = {
    project_type: projectType,
    kind,
    title: String(fd.get("title") ?? "").trim() || null,
    body: String(fd.get("body") ?? "").trim() || null,
    sort: Number(fd.get("sort") ?? 0) || 0,
  };
  const { error } = id
    ? await supabase.from("offer_text_blocks").update(payload).eq("id", id)
    : await supabase.from("offer_text_blocks").insert(payload);
  if (error) return fail(error.message);
  revalidatePath("/vorlagen");
  return OK;
}

export async function deleteTextBlock(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("offer_text_blocks").delete().eq("id", id);
  revalidatePath("/vorlagen");
}

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
