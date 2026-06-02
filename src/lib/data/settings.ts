import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface CompanySettings {
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  /** Registereintrag, z. B. „Amtsgericht Weiden HRB 5725". */
  register: string;
  /** Geschäftsführung / Vertretungsberechtigte (für Unterschrift & Footer). */
  ceo: string;
  /** Bankverbindung (Freitext, z. B. Bankname). */
  bank: string;
  /** IBAN/BIC für den Rechnungsfuß. */
  iban: string;
  bic: string;
  /** Steuernummer und USt-IdNr. (Pflichtangaben auf Rechnungen). */
  tax_number: string;
  vat_id: string;
  /** Zuständiges Finanzamt (optional). */
  tax_office: string;
  logo_url: string | null;
}

const EMPTY_COMPANY: CompanySettings = {
  name: "",
  street: "",
  zip: "",
  city: "",
  phone: "",
  fax: "",
  email: "",
  website: "",
  register: "",
  ceo: "",
  bank: "",
  iban: "",
  bic: "",
  tax_number: "",
  vat_id: "",
  tax_office: "",
  logo_url: null,
};

/**
 * Roh-Lesezugriff auf einen settings-Key, pro Request dedupliziert
 * (React.cache → mehrfaches Lesen desselben Keys auf einer Seite = 1 Roundtrip).
 * Anfrage-bezogen, daher RLS-sicher (kein Cross-User-Cache).
 */
const readSettingRaw = cache(async (key: string): Promise<unknown> => {
  if (!isSupabaseConfigured()) return undefined;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return undefined;
  return data.value;
});

/** Wert eines settings-Keys (oder Fallback). */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const value = await readSettingRaw(key);
  return (value as T) ?? fallback;
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const value = await getSetting<Partial<CompanySettings>>("company", {});
  return { ...EMPTY_COMPANY, ...value };
}

export async function getDefaults(): Promise<{ vat_percent: number }> {
  return getSetting("defaults", { vat_percent: 19 });
}

/** Eine in settings hinterlegte Stringliste (oder Defaults). */
export async function getList(
  key: "units" | "categories",
  defaults: string[],
): Promise<string[]> {
  const value = await getSetting<string[]>(key, defaults);
  return Array.isArray(value) && value.length > 0 ? value : defaults;
}

/** Default-Aufschläge (Sicherheit/Marge in %) für die Preisbildung neuer Produkte. */
export async function getPriceDefaults(): Promise<{
  safety_pct: number;
  margin_pct: number;
}> {
  return getSetting("price_defaults", { safety_pct: 0, margin_pct: 20 });
}

/** Globaler Stundensatz (€/Std) als Fallback für die Nachkalkulation. */
export async function getLaborRate(): Promise<number> {
  const v = await getSetting<number>("labor_rate", 65);
  return typeof v === "number" && Number.isFinite(v) ? v : 65;
}

/** MwSt-Vorbelegung je Produktgruppe (§ 12 Abs. 3 UStG: PV+Speicher 0 %). */
export async function getVatPerGroup(): Promise<Record<string, number>> {
  return getSetting<Record<string, number>>("vat_per_group", {
    "PV-Anlage": 0,
    Speicher: 0,
    Wallbox: 19,
    Sonstiges: 19,
  });
}
