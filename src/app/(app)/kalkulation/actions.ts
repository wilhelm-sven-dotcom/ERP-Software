"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";
import { calculate } from "@/lib/calc/engine";
import type { CalcInput } from "@/lib/calc/types";

/**
 * Kalkulation eines Projekts speichern (insert/update).
 * Eingaben kommen als JSON; die Summen werden serverseitig neu berechnet
 * (Single Source of Truth) und mit den Eingaben in totals abgelegt.
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

  const result = calculate(input);
  const totals = {
    ...result.totals,
    // Eingaben mitspeichern, damit der Editor sie wieder vorbelegt
    pauschalRabattPercent: input.pauschalRabattPercent ?? 0,
    nachlass: input.nachlass ?? 0,
    skontoPercent: input.skontoPercent ?? 0,
    gruppenRabatte: input.gruppenRabatte ?? {},
  };

  const supabase = await createClient();
  const existingId = String(fd.get("calc_id") ?? "");
  const row = {
    project_id: projectId,
    positions: input.positions,
    totals,
    margin: result.totals.margeProzent,
  };

  const { error } = existingId
    ? await supabase.from("calculations").update(row).eq("id", existingId)
    : await supabase.from("calculations").insert(row);
  if (error) return fail(error.message);

  revalidatePath(`/kalkulation/${projectId}`);
  revalidatePath("/kalkulation");
  return OK;
}
