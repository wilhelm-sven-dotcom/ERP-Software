"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** Firmendaten (settings-Key 'company') speichern. Nur Admin. */
export async function saveCompanySettings(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const me = await getCurrentEmployee();
  if (me?.role !== "admin") {
    return fail("Nur Administratoren dürfen die Einstellungen ändern.");
  }

  const value = {
    name: s(fd, "name"),
    street: s(fd, "street"),
    zip: s(fd, "zip"),
    city: s(fd, "city"),
    phone: s(fd, "phone"),
    email: s(fd, "email"),
    logo_url: s(fd, "logo_url") || null,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "company", value }, { onConflict: "key" });
  if (error) return fail(error.message);

  revalidatePath("/einstellungen");
  return OK;
}
