import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { WorkflowStepManager } from "@/components/workflow/workflow-step-manager";
import { TemplateCreateDialog } from "@/components/workflow/template-create-dialog";
import { VorlagenSectionTabs } from "@/components/vorlagen/section-tabs";
import {
  getWorkflowTemplates,
  getAllWorkflowSteps,
  getAllWorkflowStepDeps,
} from "@/lib/data/workflow";
import {
  toggleTemplateActive,
  deleteWorkflowTemplate,
} from "@/app/(app)/workflow/actions";
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
        <VorlagenSectionTabs />
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
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            {tmpl.phase === "vertrieb" ? tmpl.name : tmpl.project_type ?? "Allgemein"}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {tmpl.phase === "vertrieb" ? "Vertriebsablauf" : tmpl.name}
            </span>
            {!tmpl.active ? (
              <Badge variant="secondary" className="ml-2">inaktiv</Badge>
            ) : null}
          </CardTitle>
          <div className="flex items-center gap-1">
            <form action={toggleTemplateActive}>
              <input type="hidden" name="id" value={tmpl.id} />
              <input type="hidden" name="active" value={String(!tmpl.active)} />
              <Button variant="ghost" size="sm" type="submit">
                {tmpl.active ? "Deaktivieren" : "Aktivieren"}
              </Button>
            </form>
            <form action={deleteWorkflowTemplate}>
              <input type="hidden" name="id" value={tmpl.id} />
              <Button variant="ghost" size="icon" className="size-8" type="submit" title="Vorlage löschen">
                <Trash2 className="size-4" />
              </Button>
            </form>
          </div>
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
      >
        <TemplateCreateDialog />
      </PageHeader>
      <VorlagenSectionTabs />
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
