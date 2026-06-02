"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
import { ensureConfigured } from "@/lib/actions";
import type { DocumentKind, InvoiceType, Offer } from "@/lib/types";

type Totals = Record<string, unknown> & {
  netto?: number;
  brutto?: number;
  mwstSatz?: number;
  mwstBetrag?: number;
  mwstSaetze?: { rate: number; betrag: number; netto: number }[];
};
const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);

/** Summen anteilig skalieren (für Abschlagsrechnungen). */
function scaleTotals(t: Totals, f: number): Totals {
  const arr = (t.mwstSaetze ?? []).map((m) => ({
    rate: m.rate,
    betrag: num(m.betrag) * f,
    netto: num(m.netto) * f,
  }));
  return {
    ...t,
    netto: num(t.netto) * f,
    brutto: num(t.brutto) * f,
    mwstBetrag: num(t.mwstBetrag) * f,
    mwstSaetze: arr.length ? arr : undefined,
  };
}

/** Nächste fortlaufende Nummer je Dokumentart (AB ab 1000, LS ab 1000). */
async function nextDocNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: DocumentKind,
): Promise<number> {
  const { data } = await supabase
    .from("documents")
    .select("doc_number")
    .eq("kind", kind)
    .order("doc_number", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data?.doc_number ?? 1000) + 1;
}

/** Aus einem angenommenen Angebot eine Auftragsbestätigung erzeugen. */
export async function createOrderConfirmation(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const offerId = String(fd.get("offer_id") ?? "");
  if (!offerId) return;

  const supabase = await createClient();
  const { data: offerRow } = await supabase
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  const offer = offerRow as Offer | null;
  if (!offer) return;

  const me = await getCurrentEmployee();
  const nr = await nextDocNumber(supabase, "auftragsbestaetigung");
  const { data: inserted } = await supabase
    .from("documents")
    .insert({
      project_id: offer.project_id,
      kind: "auftragsbestaetigung",
      doc_number: nr,
      source_offer_id: offer.id,
      status: "Entwurf",
      title: offer.title ?? "Auftragsbestätigung",
      positions: offer.positions,
      totals: offer.totals,
      meta: offer.meta,
      created_by: me?.id || null,
    })
    .select("id")
    .single();

  // Projekt auf „Auftrag" setzen (Pipeline rückt vor).
  await supabase.from("projects").update({ status: "Auftrag" }).eq("id", offer.project_id);
  await logActivity({
    projectId: offer.project_id,
    type: "auftrag",
    title: `Auftragsbestätigung Nr. ${nr} erstellt`,
  });

  revalidatePath(`/projekte/${offer.project_id}`);
  revalidatePath("/auftrag");
  if (inserted) redirect(`/auftrag/${inserted.id}`);
}

/** Aus einer Auftragsbestätigung einen Lieferschein erzeugen. */
export async function createDeliveryNote(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const abId = String(fd.get("document_id") ?? "");
  if (!abId) return;

  const supabase = await createClient();
  const { data: abRow } = await supabase
    .from("documents")
    .select("*")
    .eq("id", abId)
    .maybeSingle();
  if (!abRow) return;

  const me = await getCurrentEmployee();
  const nr = await nextDocNumber(supabase, "lieferschein");
  const { data: inserted } = await supabase
    .from("documents")
    .insert({
      project_id: abRow.project_id,
      kind: "lieferschein",
      doc_number: nr,
      source_document_id: abRow.id,
      source_offer_id: abRow.source_offer_id,
      status: "Entwurf",
      title: abRow.title ?? "Lieferschein",
      positions: abRow.positions,
      totals: abRow.totals,
      meta: abRow.meta,
      commission: abRow.commission,
      created_by: me?.id || null,
    })
    .select("id")
    .single();

  await logActivity({
    projectId: abRow.project_id,
    type: "lieferschein",
    title: `Lieferschein Nr. ${nr} erstellt`,
  });

  revalidatePath(`/projekte/${abRow.project_id}`);
  revalidatePath("/lieferschein");
  if (inserted) redirect(`/lieferschein/${inserted.id}`);
}

/**
 * Aus einer Auftragsbestätigung (oder Angebot via AB) eine Rechnung erzeugen.
 * invoice_type: 'voll' (Vollrechnung) | 'abschlag' (Teilbetrag in %) |
 * 'schluss' (Schlussrechnung, listet vorherige Abschläge als Abzug).
 */
export async function createInvoice(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const sourceId = String(fd.get("source_id") ?? "");
  if (!sourceId) return;
  const typeRaw = String(fd.get("invoice_type") ?? "voll");
  const type: InvoiceType =
    typeRaw === "abschlag" ? "abschlag" : typeRaw === "schluss" ? "schluss" : "voll";
  const percent = Number(fd.get("percent") ?? 0) || 0;
  const label = String(fd.get("label") ?? "").trim();

  const supabase = await createClient();
  const { data: src } = await supabase
    .from("documents")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (!src) return;

  const me = await getCurrentEmployee();
  const nr = await nextDocNumber(supabase, "rechnung");
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  const srcTotals = (src.totals ?? {}) as Totals;

  let positions = src.positions;
  let totals: Totals = srcTotals;
  const meta: Record<string, unknown> = {
    ...((src.meta as Record<string, unknown>) ?? {}),
    invoice_type: type,
  };
  let title = "Rechnung";
  let percentage: number | null = null;

  if (type === "abschlag") {
    const f = percent / 100;
    totals = scaleTotals(srcTotals, f);
    percentage = percent;
    const lbl = label || `Abschlag ${percent}%`;
    positions = [
      {
        id: "abschlag",
        bezeichnung: `${lbl} gemäß Zahlungsplan (AB Nr. ${src.doc_number ?? "–"})`,
        menge: 1,
        einheit: "",
        einzelpreis: num(totals.netto),
        gruppe: "Sonstiges",
      },
    ];
    meta.label = lbl;
    meta.source_doc_number = src.doc_number;
    title = lbl;
  } else if (type === "schluss") {
    const { data: prior } = await supabase
      .from("documents")
      .select("doc_number, totals, meta")
      .eq("project_id", src.project_id)
      .eq("kind", "rechnung");
    const deductions = (prior ?? [])
      .filter((d) => (d.meta as Record<string, unknown>)?.invoice_type === "abschlag")
      .map((d) => ({
        doc_number: d.doc_number,
        label: (d.meta as Record<string, unknown>)?.label ?? "Abschlag",
        brutto: num((d.totals as Totals)?.brutto),
      }));
    meta.deductions = deductions;
    title = "Schlussrechnung";
  }

  const { data: inserted } = await supabase
    .from("documents")
    .insert({
      project_id: src.project_id,
      kind: "rechnung",
      doc_number: nr,
      source_offer_id: src.source_offer_id ?? null,
      source_document_id: src.id,
      status: "Entwurf",
      title,
      positions,
      totals,
      meta,
      commission: src.commission ?? null,
      invoice_date: today.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      payment_status: "offen",
      percentage,
      created_by: me?.id || null,
    })
    .select("id")
    .single();

  await logActivity({
    projectId: src.project_id,
    type: "rechnung",
    title: `${title} Nr. ${nr} erstellt`,
  });
  revalidatePath(`/projekte/${src.project_id}`);
  revalidatePath("/rechnung");
  if (inserted) redirect(`/rechnung/${inserted.id}`);
}

export async function setDocumentStatus(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  const kind = String(fd.get("kind") ?? "");
  if (!id || !status || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("documents").update({ status }).eq("id", id);
  if (kind === "lieferschein") revalidatePath(`/lieferschein/${id}`);
  else if (kind === "rechnung") revalidatePath(`/rechnung/${id}`);
  else revalidatePath(`/auftrag/${id}`);
}

export async function deleteDocument(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const kind = String(fd.get("kind") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("documents").delete().eq("id", id);
  if (projectId) revalidatePath(`/projekte/${projectId}`);
  redirect(
    kind === "lieferschein"
      ? "/lieferschein"
      : kind === "rechnung"
        ? "/rechnung"
        : "/auftrag",
  );
}
