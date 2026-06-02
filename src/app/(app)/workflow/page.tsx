import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStepManager } from "@/components/workflow/workflow-step-manager";
import {
  getWorkflowTemplates,
  getAllWorkflowSteps,
  getAllWorkflowStepDeps,
} from "@/lib/data/workflow";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import type { WorkflowStep, WorkflowTemplate } from "@/lib/types";

export const metadata: Metadata = { title: "Ablauf-Vorlagen" };

export default async function WorkflowPage() {
  const [templates, steps, deps, me] = await Promise.all([
    getWorkflowTemplates(),
    getAllWorkflowSteps(),
    getAllWorkflowStepDeps(),
    getCurrentEmployee(),
  ]);

  if (me?.role !== "admin") {
    return (
      <div>
        <PageHeader title="Ablauf-Vorlagen" description="Projektablauf je Anlagentyp." />
        <EmptyState
          title="Nur für Administratoren"
          description="Die Ablauf-Vorlagen können nur von Administratoren bearbeitet werden."
        />
      </div>
    );
  }

  const stepsByTemplate = new Map<string, WorkflowStep[]>();
  for (const s of steps) {
    (stepsByTemplate.get(s.template_id) ?? stepsByTemplate.set(s.template_id, []).get(s.template_id)!).push(s);
  }
  // Vorgänger je Schritt (step_id → depends_on[]).
  const depsByStep: Record<string, string[]> = {};
  for (const d of deps) {
    (depsByStep[d.step_id] ??= []).push(d.depends_on_step_id);
  }

  const sales = templates.filter((t) => (t.phase ?? "projekt") === "vertrieb");
  const projekt = templates.filter((t) => (t.phase ?? "projekt") !== "vertrieb");

  function TemplateCard({ tmpl }: { tmpl: WorkflowTemplate }) {
    const tSteps = stepsByTemplate.get(tmpl.id) ?? [];
    return (
      <Card key={tmpl.id}>
        <CardHeader>
          <CardTitle className="text-base">
            {tmpl.phase === "vertrieb" ? tmpl.name : tmpl.project_type ?? "Allgemein"}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {tmpl.phase === "vertrieb" ? "Vertriebsablauf" : tmpl.name}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowStepManager
            templateId={tmpl.id}
            steps={tSteps}
            depsByStep={depsByStep}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Ablauf-Vorlagen"
        description="Schritte werden beim Start des Ablaufs zu Aufgaben — mit Vorgängern für die richtige Reihenfolge."
      />
      <SupabaseNotice />

      {templates.length === 0 ? (
        <EmptyState
          title="Keine Vorlagen"
          description="Führe die Migrationen 20260531121600 und 20260531122200 aus, um Standard-Vorlagen anzulegen."
        />
      ) : (
        <div className="space-y-6">
          {sales.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Vertriebsablauf (vorgelagert)</h3>
              {sales.map((tmpl) => (
                <TemplateCard key={tmpl.id} tmpl={tmpl} />
              ))}
            </div>
          ) : null}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Projektabläufe je Anlagentyp</h3>
            {projekt.map((tmpl) => (
              <TemplateCard key={tmpl.id} tmpl={tmpl} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
