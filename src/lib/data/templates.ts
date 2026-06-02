import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { CalcTemplate, OfferTemplate } from "@/lib/types";

export async function getOfferTemplates(): Promise<OfferTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("getOfferTemplates:", error.message);
    return [];
  }
  return (data ?? []) as OfferTemplate[];
}

export async function getCalcTemplates(): Promise<CalcTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calc_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("getCalcTemplates:", error.message);
    return [];
  }
  return (data ?? []) as CalcTemplate[];
}

export async function getCalcTemplate(
  id: string,
): Promise<CalcTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calc_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getCalcTemplate:", error.message);
    return null;
  }
  return (data as CalcTemplate) ?? null;
}
