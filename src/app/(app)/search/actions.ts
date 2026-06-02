"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface SearchHit {
  type: "Kunde" | "Projekt" | "Angebot" | "Produkt" | "Mitarbeiter";
  id: string;
  label: string;
  sub?: string;
  href: string;
}

export interface SearchResults {
  customers: SearchHit[];
  projects: SearchHit[];
  offers: SearchHit[];
  products: SearchHit[];
  employees: SearchHit[];
}

const EMPTY: SearchResults = {
  customers: [],
  projects: [],
  offers: [],
  products: [],
  employees: [],
};

/** Für das or()-Filter unsichere Zeichen entfernen. */
function clean(q: string): string {
  return q.replace(/[,()*%]/g, " ").trim();
}

/**
 * Globale Suche über Kunden, Projekte, Angebote, Produkte und Mitarbeiter.
 * RLS bleibt die Wahrheit — Mitarbeiter sehen nur erlaubte Datensätze.
 */
export async function searchAll(query: string): Promise<SearchResults> {
  const q = clean(query);
  if (!isSupabaseConfigured() || q.length < 2) return EMPTY;
  const supabase = await createClient();
  const like = `%${q}%`;
  const numeric = /^\d+$/.test(q) ? Number(q) : null;

  const [customers, projects, offers, products, employees] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_nr, first_name, last_name, company, city")
      .or(
        `first_name.ilike.${like},last_name.ilike.${like},company.ilike.${like},city.ilike.${like},email.ilike.${like}`,
      )
      .limit(6),
    supabase
      .from("projects")
      .select("id, title, city, status")
      .or(`title.ilike.${like},city.ilike.${like},status.ilike.${like}`)
      .limit(6),
    supabase
      .from("offers")
      .select("id, offer_number, title, status")
      .or(
        numeric !== null
          ? `title.ilike.${like},offer_number.eq.${numeric}`
          : `title.ilike.${like}`,
      )
      .limit(6),
    supabase
      .from("products")
      .select("id, name, manufacturer, sku")
      .or(`name.ilike.${like},manufacturer.ilike.${like},sku.ilike.${like}`)
      .limit(6),
    supabase
      .from("employees")
      .select("id, name, email")
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(5),
  ]);

  return {
    customers: (customers.data ?? []).map((c) => ({
      type: "Kunde" as const,
      id: c.id,
      label:
        c.company ||
        [c.first_name, c.last_name].filter(Boolean).join(" ") ||
        "Kunde",
      sub: [c.customer_nr ? `Nr. ${c.customer_nr}` : "", c.city]
        .filter(Boolean)
        .join(" · "),
      href: `/kunden/${c.id}`,
    })),
    projects: (projects.data ?? []).map((p) => ({
      type: "Projekt" as const,
      id: p.id,
      label: p.title ?? "Projekt",
      sub: [p.status, p.city].filter(Boolean).join(" · "),
      href: `/projekte/${p.id}`,
    })),
    offers: (offers.data ?? []).map((o) => ({
      type: "Angebot" as const,
      id: o.id,
      label: `Nr. ${o.offer_number ?? "–"} · ${o.title ?? "Angebot"}`,
      sub: o.status,
      href: `/angebot/${o.id}`,
    })),
    products: (products.data ?? []).map((p) => ({
      type: "Produkt" as const,
      id: p.id,
      label: p.name,
      sub: [p.manufacturer, p.sku].filter(Boolean).join(" · "),
      href: `/produkte`,
    })),
    employees: (employees.data ?? []).map((e) => ({
      type: "Mitarbeiter" as const,
      id: e.id,
      label: e.name ?? e.email ?? "Mitarbeiter",
      sub: e.email ?? "",
      href: `/mitarbeiter`,
    })),
  };
}
