import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { isAiConfigured } from "@/lib/ai/openai";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getProjects } from "@/lib/data/projects";
import { getProducts } from "@/lib/data/products";
import { getConversations } from "@/lib/data/ai-conversations";

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
    />
  );
}
