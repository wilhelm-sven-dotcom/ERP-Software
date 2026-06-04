"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
import { ensureConfigured, fail, type ActionResult } from "@/lib/actions";
import { calculate } from "@/lib/calc/engine";
import { computeServicePrice } from "@/lib/calc/service-pricing";
import type { CalcInput, CalcPosition } from "@/lib/calc/types";

/** Anlagen-/Speichergröße aus den Positionen ableiten (Wp bzw. kWh je Einheit). */
function deriveSizes(positions: CalcPosition[]): {
  kwp: number | null;
  kwh: number | null;
} {
  const wp = positions.reduce(
    (s, p) => s + (Number(p.menge) || 0) * (Number(p.moduleWp) || 0),
    0,
  );
  const kwh = positions.reduce(
    (s, p) => s + (Number(p.menge) || 0) * (Number(p.kwhPerUnit) || 0),
    0,
  );
  return {
    kwp: wp > 0 ? Math.round(wp / 10) / 100 : null,
    kwh: kwh > 0 ? Math.round(kwh * 100) / 100 : null,
  };
}

/**
 * Kalkulation (Variante) speichern. Summen werden serverseitig neu berechnet;
 * Name und die aus den Positionen abgeleitete Größe (kWp/kWh) werden mitgespeichert.
 * Ist die Variante „ausgewählt" (oder die einzige), werden kWp/kWh ins Projekt
 * übernommen.
 */
export async function saveCalculation(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return fail("Projekt fehlt.");

  let input: CalcInput;
  try {
    input = JSON.parse(String(fd.get("payload") ?? "{}")) as CalcInput;
  } catch {
    return fail("Ungültige Kalkulationsdaten.");
  }

  const sizes = deriveSizes(input.positions ?? []);
  const effKwp = sizes.kwp ?? input.systemSizeKwp ?? null;
  // Dienstleistungs-Positionen serverseitig anhand der Anlagengröße bepreisen.
  input.positions = (input.positions ?? []).map((p) =>
    p.servicePricing
      ? { ...p, menge: 1, einzelpreis: computeServicePrice(p.servicePricing, effKwp) }
      : p,
  );
  const result = calculate({
    ...input,
    systemSizeKwp: effKwp,
    storageKwh: sizes.kwh ?? input.storageKwh ?? null,
  });
  const totals = {
    ...result.totals,
    pauschalRabattPercent: input.pauschalRabattPercent ?? 0,
    nachlass: input.nachlass ?? 0,
    skontoPercent: input.skontoPercent ?? 0,
    mwstPercent: input.mwstPercent ?? 0,
    mwstPerGroup: input.mwstPerGroup ?? null,
    gruppenRabatte: input.gruppenRabatte ?? {},
  };

  const supabase = await createClient();
  const existingId = String(fd.get("calc_id") ?? "");
  const name = String(fd.get("name") ?? "").trim() || "Standard";
  const row = {
    project_id: projectId,
    name,
    positions: input.positions,
    totals,
    margin: result.totals.margeProzent,
    system_size_kwp: sizes.kwp,
    storage_kwh: sizes.kwh,
  };

  let savedId = existingId;
  let created = false;
  if (existingId) {
    const { error } = await supabase
      .from("calculations")
      .update(row)
      .eq("id", existingId);
    if (error) return fail(error.message);
  } else {
    const me = await getCurrentEmployee();
    const { data, error } = await supabase
      .from("calculations")
      .insert({ ...row, created_by: me?.id || null })
      .select("id")
      .single();
    if (error || !data) return fail(error?.message ?? "Speichern fehlgeschlagen");
    savedId = data.id;
    created = true;
  }

  await logActivity({
    projectId,
    type: "kalkulation",
    title: `Kalkulation „${name}" ${created ? "erstellt" : "geändert"}`,
  });

  // Größe ins Projekt übernehmen, wenn diese Variante ausgewählt ist
  // (oder die einzige Variante des Projekts).
  const { data: variants } = await supabase
    .from("calculations")
    .select("id, is_selected")
    .eq("project_id", projectId);
  const selected = (variants ?? []).find((v) => v.is_selected);
  const isSelected = selected
    ? selected.id === savedId
    : (variants?.length ?? 0) <= 1;
  if (isSelected) {
    await supabase
      .from("projects")
      .update({ system_size_kwp: sizes.kwp, storage_kwh: sizes.kwh })
      .eq("id", projectId);
  }

  revalidatePath(`/kalkulation/${projectId}`);
  revalidatePath("/kalkulation");
  revalidatePath(`/projekte/${projectId}`);
  return { ok: true, id: savedId };
}

/** Neue leere Variante anlegen und in deren Editor springen. */
export async function createVariant(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return;
  const supabase = await createClient();
  const me = await getCurrentEmployee();
  const { count } = await supabase
    .from("calculations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  const { data } = await supabase
    .from("calculations")
    .insert({
      project_id: projectId,
      name: `Variante ${(count ?? 0) + 1}`,
      positions: [],
      totals: {},
      created_by: me?.id || null,
    })
    .select("id")
    .single();
  revalidatePath(`/kalkulation/${projectId}`);
  redirect(`/kalkulation/${projectId}${data ? `?calc=${data.id}` : ""}`);
}

/** Variante als „ausgewählt" markieren und deren kWp/kWh ins Projekt schreiben. */
export async function selectVariant(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const calcId = String(fd.get("calc_id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!calcId || !projectId) return;
  const supabase = await createClient();
  await supabase
    .from("calculations")
    .update({ is_selected: false })
    .eq("project_id", projectId);
  await supabase
    .from("calculations")
    .update({ is_selected: true })
    .eq("id", calcId);
  const { data: calc } = await supabase
    .from("calculations")
    .select("system_size_kwp, storage_kwh")
    .eq("id", calcId)
    .maybeSingle();
  if (calc) {
    await supabase
      .from("projects")
      .update({
        system_size_kwp: calc.system_size_kwp,
        storage_kwh: calc.storage_kwh,
      })
      .eq("id", projectId);
  }
  revalidatePath(`/kalkulation/${projectId}`);
  revalidatePath(`/projekte/${projectId}`);
}
