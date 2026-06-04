"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, fail, type ActionResult } from "@/lib/actions";
import type { DocumentEntityType } from "@/lib/data/entity-documents";

const ymd = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * Ein Dokument einer Entität (Kunde/Mitarbeiter/allgemein) registrieren.
 * Datei liegt im Storage-Bucket `entity-documents`; hier nur die Metadaten.
 */
export async function registerDocument(input: {
  entityType: DocumentEntityType;
  entityId: string | null;
  name: string;
  storagePath: string;
  mime?: string | null;
  kind?: string;
  docMeta?: Record<string, unknown> | null;
  textContent?: string | null;
}): Promise<ActionResult & { id?: string }> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.name || !input.storagePath) return fail("Datei fehlt.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entity_documents")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      name: input.name,
      storage_path: input.storagePath,
      mime: input.mime ?? null,
      kind: input.kind ?? "dokument",
      doc_meta: input.docMeta ?? null,
      text_content: input.textContent ?? null,
      uploaded_by: me?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Speichern fehlgeschlagen.");
  if (input.entityType === "kunde" && input.entityId) revalidatePath(`/kunden/${input.entityId}`);
  if (input.entityType === "mitarbeiter" && input.entityId)
    revalidatePath(`/mitarbeiter/${input.entityId}`);
  return { ok: true, id: data.id };
}

/** Eine Eingangsrechnung (offener Posten) aus ausgelesenen Feldern anlegen. */
export async function createIncomingInvoice(input: {
  supplier?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  projectId?: string | null;
  sourceFileId?: string | null;
}): Promise<ActionResult & { id?: string }> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const me = await getCurrentEmployee();
  const amount =
    typeof input.amount === "number"
      ? input.amount
      : input.amount
        ? Number(String(input.amount).replace(",", "."))
        : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incoming_invoices")
    .insert({
      supplier: input.supplier ?? null,
      invoice_number: input.invoice_number ?? null,
      invoice_date: ymd(input.invoice_date),
      due_date: ymd(input.due_date),
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      currency: input.currency ?? "EUR",
      project_id: input.projectId ?? null,
      source_file_id: input.sourceFileId ?? null,
      created_by: me?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Verbuchen fehlgeschlagen.");
  revalidatePath("/buchhaltung");
  return { ok: true, id: data.id };
}
