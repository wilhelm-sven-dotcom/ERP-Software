import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Offer, OfferTemplate } from "@/lib/types";

export async function getOffersByProject(projectId: string): Promise<Offer[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getOffersByProject:", error.message);
    return [];
  }
  return (data ?? []) as Offer[];
}

export async function getOffer(id: string): Promise<Offer | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getOffer:", error.message);
    return null;
  }
  return (data as Offer) ?? null;
}

export type OfferWithProject = Offer & {
  project: {
    id: string;
    title: string | null;
    system_size_kwp: number | null;
    storage_kwh: number | null;
    customer: {
      first_name: string | null;
      last_name: string | null;
      company: string | null;
    } | null;
  } | null;
};

/** Alle Angebote (für die Angebotsübersicht), mit Projekt + Kunde. */
export async function getAllOffers(): Promise<OfferWithProject[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select(
      "*, project:projects(id, title, system_size_kwp, storage_kwh, customer:customers(first_name, last_name, company))",
    )
    .order("offer_number", { ascending: false });
  if (error) {
    console.error("getAllOffers:", error.message);
    return [];
  }
  return (data ?? []) as unknown as OfferWithProject[];
}

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
