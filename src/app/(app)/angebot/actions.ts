"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
import { calculate } from "@/lib/calc/engine";
import { readMeta, readPositions } from "@/lib/data/calculations";
import { ensureConfigured } from "@/lib/actions";
import type { Calculation } from "@/lib/types";
import type { CalcPosition } from "@/lib/calc/types";

/** Aus einer Kalkulations-Variante ein Angebot erzeugen (Werte eingefroren). */
export async function createOfferFromCalculation(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const calcId = String(fd.get("calc_id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!calcId || !projectId) return;

  const supabase = await createClient();
  const { data: calcRow } = await supabase
    .from("calculations")
    .select("*")
    .eq("id", calcId)
    .maybeSingle();
  const calc = calcRow as Calculation | null;
  if (!calc) return;

  const positions = readPositions(calc);
  const meta = readMeta(calc);
  const result = calculate({
    positions: positions as CalcPosition[],
    pauschalRabattPercent: meta.pauschalRabattPercent,
    nachlass: meta.nachlass,
    mwstPercent: meta.mwstPercent,
    mwstPerGroup: meta.mwstPerGroup ?? undefined,
    skontoPercent: meta.skontoPercent,
    systemSizeKwp: calc.system_size_kwp,
    storageKwh: calc.storage_kwh,
  });

  // Fortlaufende Angebotsnummer (max+1, ab 1000) — wie Kundennummern.
  const { data: maxRow } = await supabase
    .from("offers")
    .select("offer_number")
    .order("offer_number", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextNr = (maxRow?.offer_number ?? 1000) + 1;

  const me = await getCurrentEmployee();
  const valid = new Date();
  valid.setDate(valid.getDate() + 30);

  const { data: inserted } = await supabase
    .from("offers")
    .insert({
      project_id: projectId,
      calculation_id: calcId,
      offer_number: nextNr,
      title: calc.name ?? "Angebot",
      status: "Entwurf",
      positions,
      totals: result.totals,
      meta: {
        pauschalRabattPercent: meta.pauschalRabattPercent,
        nachlass: meta.nachlass,
        skontoPercent: meta.skontoPercent,
        mwstPerGroup: meta.mwstPerGroup ?? null,
        system_size_kwp: calc.system_size_kwp,
        storage_kwh: calc.storage_kwh,
      },
      valid_until: valid.toISOString().slice(0, 10),
      created_by: me?.id || null,
    })
    .select("id")
    .single();

  await logActivity({
    projectId,
    type: "angebot",
    title: `Angebot Nr. ${nextNr} erstellt (${calc.name ?? "Variante"})`,
  });

  revalidatePath(`/projekte/${projectId}`);
  revalidatePath("/angebot");
  if (inserted) redirect(`/angebot/${inserted.id}`);
}

export async function setOfferStatus(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!id || !status || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("offers").update({ status }).eq("id", id);
  revalidatePath(`/angebot/${id}`);
  revalidatePath("/angebot");
}

export async function deleteOffer(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("offers").delete().eq("id", id);
  revalidatePath("/angebot");
  if (projectId) {
    revalidatePath(`/projekte/${projectId}`);
    redirect(`/projekte/${projectId}`);
  }
  redirect("/angebot");
}
