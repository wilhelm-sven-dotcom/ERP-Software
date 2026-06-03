import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { GlobalFileDrop } from "@/components/shared/global-file-drop";
import { isAiConfigured } from "@/lib/ai/openai";
import { getProjects } from "@/lib/data/projects";
import { getProducts } from "@/lib/data/products";

export const metadata: Metadata = { title: "KI-Assistent" };

export default async function AssistentPage() {
  const aiEnabled = isAiConfigured();
  const [projects, products] = await Promise.all([getProjects(), getProducts()]);
  const projectOptions = projects.map((p) => ({ id: p.id, title: p.title ?? "Ohne Titel" }));

  return (
    <div>
      <PageHeader
        title="KI-Assistent"
        description="Fragen stellen, Auswertungen erstellen, Aufgaben vergeben und Dokumente ablegen."
      />

      {!aiEnabled ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Die KI ist noch nicht aktiviert. Bitte <code>OPENAI_API_KEY</code> in den
            Umgebungsvariablen setzen (siehe <code>supabase/SETUP.md</code>).
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" /> Assistent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AssistantChat />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dokument ablegen</CardTitle>
            </CardHeader>
            <CardContent>
              <GlobalFileDrop projects={projectOptions} products={products} aiEnabled={aiEnabled} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
