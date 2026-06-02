"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/** Nächste Fälligkeit = Basisdatum + interval_months. */
function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function saveContract(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const title = s(fd, "title");
  if (!title) return fail("Bitte einen Titel angeben.");

  const interval = Number(fd.get("interval_months") ?? 12) || 12;
  const startDate = s(fd, "start_date");
  const priceRaw = s(fd, "price");
  const price = priceRaw ? Number(priceRaw.replace(",", ".")) : null;
  let nextDue = s(fd, "next_due");
  if (!nextDue) {
    const base = startDate ?? new Date().toISOString().slice(0, 10);
    nextDue = addMonths(base, interval);
  }

  const payload = {
    customer_id: s(fd, "customer_id"),
    project_id: s(fd, "project_id"),
    title,
    start_date: startDate,
    interval_months: interval,
    next_due: nextDue,
    price: price !== null && Number.isFinite(price) ? price : null,
    status: s(fd, "status") ?? "aktiv",
    notes: s(fd, "notes"),
  };

  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("service_contracts").update(payload).eq("id", id)
    : await supabase
        .from("service_contracts")
        .insert({ ...payload, created_by: (await getCurrentEmployee())?.id ?? null });
  if (error) return fail(error.message);
  revalidatePath("/wartung");
  return OK;
}

/** Wartung als durchgeführt markieren → nächste Fälligkeit weiterschieben. */
export async function completeMaintenance(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("service_contracts")
    .select("interval_months, next_due, customer_id, title")
    .eq("id", id)
    .maybeSingle();
  if (!c) return;
  const today = new Date().toISOString().slice(0, 10);
  const base = c.next_due && c.next_due > today ? c.next_due : today;
  await supabase
    .from("service_contracts")
    .update({ next_due: addMonths(base, c.interval_months || 12) })
    .eq("id", id);
  await logActivity({
    customerId: c.customer_id,
    type: "wartung",
    title: `Wartung „${c.title}" durchgeführt`,
  });
  revalidatePath("/wartung");
}

export async function deleteContract(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("service_contracts").delete().eq("id", id);
  revalidatePath("/wartung");
}
