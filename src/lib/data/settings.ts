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

/** Wert eines settings-Keys (oder Fallback). */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return fallback;
  return (data.value as T) ?? fallback;
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const value = await getSetting<Partial<CompanySettings>>("company", {});
  return { ...EMPTY_COMPANY, ...value };
}

export async function getDefaults(): Promise<{ vat_percent: number }> {
  return getSetting("defaults", { vat_percent: 19 });
}
