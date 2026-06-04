"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured } from "@/lib/actions";

function s(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}
const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Einen ausgelesenen Beleg als Eingangsrechnung (offener Posten) verbuchen. */
export async function bookIncomingInvoice(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const me = await getCurrentEmployee();
  const amountRaw = s(fd, "amount");
  const amount = amountRaw === null ? null : Number(amountRaw.replace(",", "."));
  const supabase = await createClient();
  await supabase.from("incoming_invoices").insert({
    supplier: s(fd, "supplier"),
    invoice_number: s(fd, "invoice_number"),
    invoice_date: ymd(s(fd, "invoice_date")),
    due_date: ymd(s(fd, "due_date")),
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    currency: s(fd, "currency") ?? "EUR",
    project_id: s(fd, "project_id"),
    source_file_id: s(fd, "source_file_id"),
    created_by: me?.id ?? null,
  });
  revalidatePath("/buchhaltung");
}

export async function markIncomingPaid(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("incoming_invoices")
    .update({ status: "bezahlt", paid_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/buchhaltung");
}

export async function deleteIncomingInvoice(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("incoming_invoices").delete().eq("id", id);
  revalidatePath("/buchhaltung");
}
