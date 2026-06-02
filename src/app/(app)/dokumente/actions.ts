"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
import { ensureConfigured } from "@/lib/actions";
import type { DocumentKind, Offer } from "@/lib/types";

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

export async function setDocumentStatus(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  const kind = String(fd.get("kind") ?? "");
  if (!id || !status || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("documents").update({ status }).eq("id", id);
  if (kind === "lieferschein") revalidatePath(`/lieferschein/${id}`);
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
  redirect(kind === "lieferschein" ? "/lieferschein" : "/auftrag");
}
