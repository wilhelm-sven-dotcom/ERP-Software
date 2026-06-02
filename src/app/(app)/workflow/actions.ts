"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/** Workflow-Schritt anlegen/aktualisieren (nur Admin via RLS). */
export async function saveWorkflowStep(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const templateId = s(fd, "template_id");
  const title = s(fd, "title");
  if (!templateId || !title) return fail("Vorlage und Titel angeben.");
  const payload = {
    template_id: templateId,
    title,
    description: s(fd, "description"),
    role: s(fd, "role"),
    offset_days: Number(fd.get("offset_days") ?? 0) || 0,
    sort: Number(fd.get("sort") ?? 0) || 0,
  };
  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("workflow_steps").update(payload).eq("id", id)
    : await supabase.from("workflow_steps").insert(payload);
  if (error) return fail(error.message);
  revalidatePath("/workflow");
  return OK;
}

export async function deleteWorkflowStep(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("workflow_steps").delete().eq("id", id);
  revalidatePath("/workflow");
}

/**
 * Aus der zum Anlagentyp passenden Vorlage Aufgaben für ein Projekt erzeugen.
 * Fälligkeit = heute + offset_days; Verantwortlicher = zugewiesener Bearbeiter.
 */
export async function startWorkflow(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, project_type, assigned_employee_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return;

  // Passende Vorlage: zuerst typ-spezifisch, sonst irgendeine aktive.
  const { data: templates } = await supabase
    .from("workflow_templates")
    .select("id, project_type")
    .eq("active", true);
  const tmpl =
    (templates ?? []).find((t) => t.project_type === project.project_type) ??
    (templates ?? [])[0];
  if (!tmpl) return;

  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq("template_id", tmpl.id)
    .order("sort", { ascending: true });
  if (!steps || steps.length === 0) return;

  const me = await getCurrentEmployee();
  const today = new Date();
  const rows = steps.map((st, i) => {
    const due = new Date(today);
    due.setDate(due.getDate() + (Number(st.offset_days) || 0));
    return {
      project_id: projectId,
      title: st.title,
      description: st.description,
      assignee_employee_id: project.assigned_employee_id ?? null,
      due_date: due.toISOString().slice(0, 10),
      status: "offen",
      sort: i,
      created_by: me?.id || null,
    };
  });
  const { error } = await supabase.from("project_tasks").insert(rows);
  if (error) {
    console.error("startWorkflow:", error.message);
    return;
  }
  await logActivity({
    projectId,
    type: "workflow",
    title: `Projektablauf gestartet (${rows.length} Aufgaben)`,
  });
  revalidatePath(`/projekte/${projectId}`);
}

/** Aufgabe abhaken / wieder öffnen. */
export async function toggleTask(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  const done = String(fd.get("done") ?? "") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("project_tasks")
    .update({
      status: done ? "erledigt" : "offen",
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (projectId) revalidatePath(`/projekte/${projectId}`);
  revalidatePath("/dashboard");
}

/** Verantwortlichen / Fälligkeit einer Aufgabe ändern. */
export async function updateTask(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("project_tasks")
    .update({
      assignee_employee_id: s(fd, "assignee_employee_id"),
      due_date: s(fd, "due_date"),
    })
    .eq("id", id);
  if (projectId) revalidatePath(`/projekte/${projectId}`);
}

export async function deleteTask(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("project_tasks").delete().eq("id", id);
  if (projectId) revalidatePath(`/projekte/${projectId}`);
}

/** Einzelne Aufgabe manuell zu einem Projekt hinzufügen. */
export async function addTask(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const projectId = s(fd, "project_id");
  const title = s(fd, "title");
  if (!projectId || !title) return fail("Projekt und Titel angeben.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").insert({
    project_id: projectId,
    title,
    description: s(fd, "description"),
    assignee_employee_id: s(fd, "assignee_employee_id"),
    due_date: s(fd, "due_date"),
    status: "offen",
    sort: 999,
    created_by: me?.id || null,
  });
  if (error) return fail(error.message);
  revalidatePath(`/projekte/${projectId}`);
  return OK;
}
