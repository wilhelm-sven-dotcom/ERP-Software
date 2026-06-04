import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface IncomingInvoice {
  id: string;
  supplier: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount: number | null;
  currency: string;
  project_id: string | null;
  source_file_id: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  document_path: string | null;
  document_name: string | null;
  project: { id: string; title: string | null } | null;
}

/** Signierte Download-Links (1 h) für die hinterlegten Beleg-PDFs. */
export async function getInvoiceFileUrls(
  invoices: IncomingInvoice[],
): Promise<Record<string, string>> {
  const withFile = invoices.filter((i) => i.document_path);
  if (withFile.length === 0 || !isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const out: Record<string, string> = {};
  await Promise.all(
    withFile.map(async (i) => {
      const { data } = await supabase.storage
        .from("entity-documents")
        .createSignedUrl(i.document_path!, 3600);
      if (data?.signedUrl) out[i.id] = data.signedUrl;
    }),
  );
  return out;
}

/** Kennzahlen offener Eingangsrechnungen (Anzahl, Summe, überfällig). */
export async function getIncomingInvoiceStats(): Promise<{
  openCount: number;
  openSum: number;
  overdueCount: number;
}> {
  if (!isSupabaseConfigured()) return { openCount: 0, openSum: 0, overdueCount: 0 };
  const supabase = await createClient();
  const { data } = await supabase
    .from("incoming_invoices")
    .select("amount, due_date, status")
    .neq("status", "bezahlt");
  const today = new Date().toISOString().slice(0, 10);
  const rows = (data ?? []) as { amount: number | null; due_date: string | null; status: string }[];
  return {
    openCount: rows.length,
    openSum: rows.reduce((s, r) => s + (typeof r.amount === "number" ? r.amount : 0), 0),
    overdueCount: rows.filter((r) => r.due_date != null && r.due_date < today).length,
  };
}

/** Alle Eingangsrechnungen (neueste zuerst), inkl. Projekt-Titel. */
export async function getIncomingInvoices(): Promise<IncomingInvoice[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incoming_invoices")
    .select("*, project:projects(id, title)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("getIncomingInvoices:", error.message);
    return [];
  }
  return (data ?? []) as unknown as IncomingInvoice[];
}

/** IDs der bereits verbuchten Quell-Belege (project_files) — zum Ausblenden. */
export async function getBookedFileIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("incoming_invoices")
    .select("source_file_id")
    .not("source_file_id", "is", null);
  return new Set((data ?? []).map((r) => r.source_file_id as string));
}
