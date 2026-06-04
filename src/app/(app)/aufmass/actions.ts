"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
import { calculate } from "@/lib/calc/engine";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";
import type { CalcPosition } from "@/lib/calc/types";

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}
function n(fd: FormData, k: string): number | null {
  const v = s(fd, k);
  if (v === null) return null;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

export async function saveMeasurement(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const projectId = s(fd, "project_id");
  const label = s(fd, "label");
  if (!projectId || !label) return fail("Projekt und Bezeichnung angeben.");

  const payload = {
    project_id: projectId,
    label,
    quantity: n(fd, "quantity"),
    unit: s(fd, "unit"),
    area: n(fd, "area"),
    note: s(fd, "note"),
  };
  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("measurements").update(payload).eq("id", id)
    : await supabase
        .from("measurements")
        .insert({ ...payload, created_by: (await getCurrentEmployee())?.id ?? null });
  if (error) return fail(error.message);
  revalidatePath(`/projekte/${projectId}`);
  return OK;
}

export async function deleteMeasurement(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("measurements").delete().eq("id", id);
  if (projectId) revalidatePath(`/projekte/${projectId}`);
}

/** Aufmaß-Positionen als neue Kalkulationsvariante übernehmen. */
export async function pushMeasurementsToCalculation(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return;
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("measurements")
    .select("*")
    .eq("project_id", projectId)
    .order("sort", { ascending: true });
  if (!rows || rows.length === 0) return;

  const positions: CalcPosition[] = rows.map((r, i) => ({
    id: `m-${i}-${r.id.slice(0, 8)}`,
    bezeichnung: r.label,
    menge: Number(r.quantity ?? r.area ?? 1) || 1,
    einheit: r.unit ?? "",
    einzelpreis: 0,
    ek: 0,
    rabatt: 0,
    group: "Sonstiges",
  }));
  const result = calculate({ positions, mwstPercent: 19 });
  const totals = {
    ...result.totals,
    pauschalRabattPercent: 0,
    nachlass: 0,
    skontoPercent: 0,
    mwstPercent: 19,
    mwstPerGroup: null,
    gruppenRabatte: {},
  };

  const me = await getCurrentEmployee();
  await supabase.from("calculations").insert({
    project_id: projectId,
    name: "Aus Aufmaß",
    positions,
    totals,
    margin: result.totals.margeProzent,
    created_by: me?.id || null,
  });
  await logActivity({
    projectId,
    type: "kalkulation",
    title: `Kalkulationsvariante „Aus Aufmaß" (${positions.length} Positionen) erstellt`,
  });
  revalidatePath(`/kalkulation/${projectId}`);
  redirect(`/kalkulation/${projectId}`);
}
