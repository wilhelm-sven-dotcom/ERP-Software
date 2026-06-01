import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface CompanySettings {
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  logo_url: string | null;
}

const EMPTY_COMPANY: CompanySettings = {
  name: "",
  street: "",
  zip: "",
  city: "",
  phone: "",
  email: "",
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
