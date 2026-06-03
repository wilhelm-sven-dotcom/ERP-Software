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

  void inserted;
  revalidatePath(`/projekte/${projectId}`);
  revalidatePath("/angebot");
  // Kein Redirect mehr: der Nutzer bleibt im Projekt (geführter Vorgang).
}

/** Angebot bearbeiten: Positionen (Reihenfolge/Inline) + Textbausteine speichern. */
export async function updateOffer(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  if (ensureConfigured()) return { ok: false, error: "Supabase nicht konfiguriert." };
  const id = String(fd.get("id") ?? "");
  if (!id) return { ok: false, error: "Angebot fehlt." };

  let payload: {
    positions?: CalcPosition[];
    blocks?: { kind: string; title: string | null; body: string | null }[];
  };
  try {
    payload = JSON.parse(String(fd.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "Ungültige Daten." };
  }

  const supabase = await createClient();
  const { data: offerRow } = await supabase
    .from("offers")
    .select("meta, project_id")
    .eq("id", id)
    .maybeSingle();
  if (!offerRow) return { ok: false, error: "Angebot nicht gefunden." };

  const m = (offerRow.meta as Record<string, unknown>) ?? {};
  const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);
  const mwstPerGroup =
    m.mwstPerGroup && typeof m.mwstPerGroup === "object"
      ? (m.mwstPerGroup as Record<string, number>)
      : undefined;
  const positions = (payload.positions ?? []) as CalcPosition[];
  const result = calculate({
    positions,
    pauschalRabattPercent: num(m.pauschalRabattPercent),
    nachlass: num(m.nachlass),
    mwstPercent: mwstPerGroup?.["Sonstiges"] ?? 19,
    mwstPerGroup,
    skontoPercent: num(m.skontoPercent),
  });

  const { error } = await supabase
    .from("offers")
    .update({
      positions,
      totals: result.totals,
      meta: { ...m, blocks: payload.blocks ?? m.blocks ?? null },
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/angebot/${id}`);
  if (offerRow.project_id) revalidatePath(`/projekte/${offerRow.project_id}`);
  return { ok: true };
}

export async function setOfferStatus(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!id || !status || ensureConfigured()) return;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("offers")
    .update({ status })
    .eq("id", id)
    .select("project_id")
    .maybeSingle();
  revalidatePath(`/angebot/${id}`);
  revalidatePath("/angebot");
  if (row?.project_id) revalidatePath(`/projekte/${row.project_id}`);
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
