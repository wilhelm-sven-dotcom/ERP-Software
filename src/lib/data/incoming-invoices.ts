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
  project: { id: string; title: string | null } | null;
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
