"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { disconnect as disconnectGoogleIntegration } from "@/lib/google/calendar";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

/** Google-Kalender-Verbindung des aktuellen Mitarbeiters trennen. */
export async function disconnectGoogle(): Promise<void> {
  if (ensureConfigured()) return;
  const me = await getCurrentEmployee();
  if (!me?.id) return;
  await disconnectGoogleIntegration(me.id);
  revalidatePath("/einstellungen");
}

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
    fax: s(fd, "fax"),
    email: s(fd, "email"),
    website: s(fd, "website"),
    register: s(fd, "register"),
    ceo: s(fd, "ceo"),
    bank: s(fd, "bank"),
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
