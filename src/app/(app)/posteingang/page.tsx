import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { PosteingangDrop } from "@/components/posteingang/posteingang-drop";
import { getProjects } from "@/lib/data/projects";
import { getProducts } from "@/lib/data/products";
import { getCustomers } from "@/lib/data/customers";
import { getEmployees } from "@/lib/data/employees";
import { customerName } from "@/lib/format";
import { isAiConfigured } from "@/lib/ai/openai";
import { isDocIntelConfigured } from "@/lib/ai/doc-intelligence";

export const metadata: Metadata = { title: "Posteingang" };

export default async function PosteingangPage() {
  const [projects, products, customers, employees] = await Promise.all([
    getProjects(),
    getProducts(),
    getCustomers(),
    getEmployees(),
  ]);

  return (
    <div>
      <PageHeader
        title="Posteingang"
        description="Beliebige Dokumente reinwerfen — die KI erkennt das Ziel (Projekt, Kunde, Produkt, Mitarbeiter, Buchhaltung) und du bestätigst die Ablage."
        helpId="ai-classify"
      />
      <SupabaseNotice />
      <PosteingangDrop
        aiEnabled={isAiConfigured()}
        azureEnabled={isDocIntelConfigured()}
        projects={projects.map((p) => ({
          id: p.id,
          label: p.title ?? "Ohne Titel",
          sub: [p.customer ? customerName(p.customer) : null, p.city].filter(Boolean).join(" · ") || undefined,
        }))}
        products={products.map((p) => ({
          id: p.id,
          label: p.name,
          sub: p.manufacturer ?? undefined,
        }))}
        customers={customers.map((c) => ({
          id: c.id,
          label: customerName(c),
          sub: [c.customer_nr ? `Nr. ${c.customer_nr}` : null, c.city].filter(Boolean).join(" · ") || undefined,
        }))}
        employees={employees
          .filter((e) => e.active)
          .map((e) => ({
            id: e.id,
            label: e.name ?? ([e.first_name, e.last_name].filter(Boolean).join(" ") || "Mitarbeiter"),
          }))}
      />
    </div>
  );
}
