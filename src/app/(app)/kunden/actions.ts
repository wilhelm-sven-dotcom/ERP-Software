"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { findCustomerDuplicates } from "@/lib/data/customers";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";
import { customerName } from "@/lib/format";

function s(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/** Anlegen ODER Bearbeiten (abhängig vom versteckten Feld `id`). */
export async function saveCustomer(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const id = s(fd, "id");
  const kindRaw = s(fd, "kind");
  const payload = {
    kind: kindRaw === "privat" || kindRaw === "gewerbe" ? kindRaw : null,
    company: s(fd, "company"),
    salutation: s(fd, "salutation"),
    first_name: s(fd, "first_name"),
    last_name: s(fd, "last_name"),
    email: s(fd, "email"),
    phone: s(fd, "phone"),
    mobile: s(fd, "mobile"),
    street: s(fd, "street"),
    zip: s(fd, "zip"),
    city: s(fd, "city"),
    notes: s(fd, "notes"),
  };

  if (!payload.last_name && !payload.company) {
    return fail("Bitte mindestens Nachname oder Firma angeben.");
  }

  // Duplikatscheck (nur beim Neuanlegen, überspringbar via force=1)
  const force = s(fd, "force") === "1";
  if (!id && !force) {
    const dups = await findCustomerDuplicates({
      company: payload.company,
      lastName: payload.last_name,
      zip: payload.zip,
      city: payload.city,
    });
    if (dups.length > 0) {
      const names = dups.map((d) => customerName(d)).join(", ");
      return {
        ok: false,
        warning: `Möglicher Doppeleintrag gefunden: ${names}. Trotzdem anlegen?`,
      };
    }
  }

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id);
    if (error) return fail(error.message);
  } else {
    // Nächste Kundennummer ermitteln (fortlaufend).
    const { data: maxRow } = await supabase
      .from("customers")
      .select("customer_nr")
      .order("customer_nr", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const nextNr = (maxRow?.customer_nr ?? 1000) + 1;

    const { error } = await supabase
      .from("customers")
      .insert({ ...payload, customer_nr: nextNr });
    if (error) return fail(error.message);
  }

  revalidatePath("/kunden");
  if (id) revalidatePath(`/kunden/${id}`);
  return OK;
}

export async function deleteCustomer(fd: FormData): Promise<void> {
  const id = s(fd, "id");
  if (!id) return;
  if (ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("customers").delete().eq("id", id);
  revalidatePath("/kunden");
  redirect("/kunden");
}

export async function addActivity(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const customerId = s(fd, "customer_id");
  const title = s(fd, "title");
  if (!customerId) return fail("Kunde fehlt.");
  if (!title) return fail("Bitte einen Titel angeben.");

  const supabase = await createClient();
  const me = await getCurrentEmployee();
  const { error } = await supabase.from("activities").insert({
    customer_id: customerId,
    type: s(fd, "type") ?? "notiz",
    title,
    body: s(fd, "body"),
    employee_id: me?.id || null,
  });
  if (error) return fail(error.message);

  revalidatePath(`/kunden/${customerId}`);
  return OK;
}
