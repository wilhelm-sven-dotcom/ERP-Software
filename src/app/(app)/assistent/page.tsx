import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { isAiConfigured } from "@/lib/ai/openai";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getProjects, getMyLeads } from "@/lib/data/projects";
import { getProducts } from "@/lib/data/products";
import { getConversations } from "@/lib/data/ai-conversations";
import { getMyOpenTasks } from "@/lib/data/workflow";
import { getInbox } from "@/lib/data/notifications";
import { getDocumentsByKind } from "@/lib/data/documents";
import { getDueServiceContracts } from "@/lib/data/service-contracts";

export const metadata: Metadata = { title: "KI-Assistent" };

/** Vorname aus „Max Mustermann" → „Max". */
function firstNameOf(name: string | null, email: string): string {
  const base = (name ?? "").trim();
  if (base) return base.split(/\s+/)[0];
  return email.split("@")[0] ?? "";
}

export default async function AssistentPage() {
  const aiEnabled = isAiConfigured();
  const [me, projects, products, conversations] = await Promise.all([
    getCurrentEmployee(),
    getProjects(),
    getProducts(),
    getConversations(),
  ]);
  const firstName = me ? firstNameOf(me.name, me.email) : "";
  const projectOptions = projects.map((p) => ({ id: p.id, title: p.title ?? "Ohne Titel" }));
  const initialConversations = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    updated_at: c.updated_at,
  }));

  // Proaktiver Tagesüberblick: was steht heute an?
  const today = new Date().toISOString().slice(0, 10);
  const [myTasks, inbox, leads, invoices, dueMaint] = await Promise.all([
    me?.id ? getMyOpenTasks(me.id) : Promise.resolve([]),
    me?.id ? getInbox(me.id) : Promise.resolve({ offered: [], unread: [], overdue: [], total: 0 }),
    me?.id && me.is_sales ? getMyLeads(me.id) : Promise.resolve([]),
    getDocumentsByKind("rechnung"),
    getDueServiceContracts(14),
  ]);
  const overdueTasks = myTasks.filter((t) => t.due_date && t.due_date < today).length;
  const overdueInvoices = invoices.filter(
    (d) => d.payment_status !== "bezahlt" && d.due_date && d.due_date < today,
  ).length;
  const briefing: { label: string; href: string; tone?: "warn" }[] = [];
  if (overdueTasks > 0) briefing.push({ label: `${overdueTasks} überfällige Aufgabe(n)`, href: "/dashboard", tone: "warn" });
  if (inbox.offered.length > 0) briefing.push({ label: `${inbox.offered.length} dir angebotene Aufgabe(n)`, href: "/dashboard" });
  if (leads.length > 0) briefing.push({ label: `${leads.length} offene Leads`, href: "/pipeline" });
  if (overdueInvoices > 0) briefing.push({ label: `${overdueInvoices} überfällige Rechnung(en)`, href: "/buchhaltung", tone: "warn" });
  if (dueMaint.length > 0) briefing.push({ label: `${dueMaint.length} fällige Wartung(en)`, href: "/wartung" });

  if (!aiEnabled) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Die KI ist noch nicht aktiviert. Bitte <code>OPENAI_API_KEY</code> in den
          Umgebungsvariablen setzen (siehe <code>supabase/SETUP.md</code>).
        </CardContent>
      </Card>
    );
  }

  return (
    <AssistantChat
      firstName={firstName}
      projects={projectOptions}
      products={products}
      aiEnabled={aiEnabled}
      initialConversations={initialConversations}
      briefing={briefing}
      canIndex={me?.role === "admin"}
    />
  );
}
