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
    iban: s(fd, "iban"),
    bic: s(fd, "bic"),
    tax_number: s(fd, "tax_number"),
    vat_id: s(fd, "vat_id"),
    tax_office: s(fd, "tax_office"),
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

/** Wirtschaftlichkeits-Defaults speichern (Strompreis, Einspeisung, Ertrag …). */
export async function saveWirtschaftDefaults(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const me = await getCurrentEmployee();
  if (me?.role !== "admin") return fail("Nur Administratoren dürfen die Einstellungen ändern.");

  const num = (k: string, d: number) => {
    const v = fd.get(k);
    if (v === null || String(v).trim() === "") return d;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : d;
  };
  const value = {
    ertragKwhProKwp: num("ertragKwhProKwp", 950),
    eigenverbrauchsAnteil: num("eigenverbrauchsAnteil", 30),
    strompreis: num("strompreis", 0.32),
    einspeiseverguetung: num("einspeiseverguetung", 0.0786),
    strompreissteigerung: num("strompreissteigerung", 3.0),
    degradation: num("degradation", 0.5),
    laufzeit: num("laufzeit", 25),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "wirtschaft", value }, { onConflict: "key" });
  if (error) return fail(error.message);

  revalidatePath("/einstellungen");
  return OK;
}
