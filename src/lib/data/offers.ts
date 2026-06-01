import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { OfferTemplate } from "@/lib/types";

export async function getOfferTemplate(
  id: string,
): Promise<OfferTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getOfferTemplate:", error.message);
    return null;
  }
  return (data as OfferTemplate) ?? null;
}

export async function getDefaultOfferTemplate(): Promise<OfferTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("offer_templates")
    .select("*")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  return (data as OfferTemplate) ?? null;
}
