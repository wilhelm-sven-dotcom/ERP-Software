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

// ── Kollaboration: Anbieten/Annehmen, Chat, Logbuch ────────────────────────

type DB = Awaited<ReturnType<typeof createClient>>;

/** System-Ereigniszeile in den Aufgaben-Thread schreiben. */
async function postEvent(
  supabase: DB,
  taskId: string,
  authorId: string | null,
  body: string,
): Promise<void> {
  await supabase
    .from("task_messages")
    .insert({ task_id: taskId, author_employee_id: authorId, body, kind: "event" });
}

/** Titel + Projekt einer Aufgabe laden (für Events/Logbuch). */
async function taskInfo(
  supabase: DB,
  id: string,
): Promise<{ title: string; project_id: string } | null> {
  const { data } = await supabase
    .from("project_tasks")
    .select("title, project_id")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/** Aufgabe mehreren Kollegen anbieten — wer zuerst annimmt, bekommt sie. */
export async function offerTask(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  const ids = String(fd.get("employee_ids") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!id || ids.length === 0) return;
  const me = await getCurrentEmployee();
  const supabase = await createClient();

  await supabase
    .from("project_tasks")
    .update({ status: "angeboten", assignee_employee_id: null })
    .eq("id", id);
  await supabase.from("task_candidates").delete().eq("task_id", id);
  await supabase
    .from("task_candidates")
    .insert(ids.map((employee_id) => ({ task_id: id, employee_id })));

  const info = await taskInfo(supabase, id);
  await postEvent(supabase, id, me?.id ?? null, `Aufgabe an ${ids.length} Kollegen angeboten`);
  if (info)
    await logActivity({
      projectId: info.project_id,
      type: "aufgabe",
      title: `Aufgabe „${info.title}" angeboten`,
    });
  revalidatePath("/dashboard");
  if (info) revalidatePath(`/projekte/${info.project_id}`);
}

/** Angebotene Aufgabe annehmen — race-sicher (erster gewinnt). */
export async function claimTask(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const me = await getCurrentEmployee();
  if (!me?.id) return;
  const supabase = await createClient();

  // Atomar: nur übernehmen, wenn noch niemand zugewiesen ist.
  const { data: won } = await supabase
    .from("project_tasks")
    .update({ assignee_employee_id: me.id, status: "offen" })
    .eq("id", id)
    .is("assignee_employee_id", null)
    .select("id")
    .maybeSingle();
  if (!won) return; // bereits vergeben

  await supabase.from("task_candidates").delete().eq("task_id", id);
  const info = await taskInfo(supabase, id);
  await postEvent(supabase, id, me.id, `${me.name ?? "Mitarbeiter"} hat die Aufgabe angenommen`);
  if (info)
    await logActivity({
      projectId: info.project_id,
      type: "aufgabe",
      title: `Aufgabe „${info.title}" von ${me.name ?? "Mitarbeiter"} angenommen`,
    });
  revalidatePath("/dashboard");
  if (info) revalidatePath(`/projekte/${info.project_id}`);
}

/** Aufgabe direkt einem Kollegen zuweisen. */
export async function assignTask(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  const employeeId = s(fd, "employee_id");
  if (!id || !employeeId) return;
  const me = await getCurrentEmployee();
  const supabase = await createClient();

  await supabase
    .from("project_tasks")
    .update({ assignee_employee_id: employeeId, status: "offen" })
    .eq("id", id);
  await supabase.from("task_candidates").delete().eq("task_id", id);

  const info = await taskInfo(supabase, id);
  const { data: emp } = await supabase
    .from("employees")
    .select("name")
    .eq("id", employeeId)
    .maybeSingle();
  await postEvent(supabase, id, me?.id ?? null, `Zugewiesen an ${emp?.name ?? "Kollegen"}`);
  if (info)
    await logActivity({
      projectId: info.project_id,
      type: "aufgabe",
      title: `Aufgabe „${info.title}" zugewiesen an ${emp?.name ?? "Kollegen"}`,
    });
  revalidatePath("/dashboard");
  if (info) revalidatePath(`/projekte/${info.project_id}`);
}

/** Aufgabe zurückgeben (Default: an den Ersteller). */
export async function handBackTask(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const me = await getCurrentEmployee();
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("project_tasks")
    .select("title, project_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!task) return;
  const target = s(fd, "employee_id") ?? task.created_by ?? null;
  await supabase
    .from("project_tasks")
    .update({ assignee_employee_id: target, status: "offen" })
    .eq("id", id);
  await postEvent(supabase, id, me?.id ?? null, `Aufgabe zurückgegeben`);
  await logActivity({
    projectId: task.project_id,
    type: "aufgabe",
    title: `Aufgabe „${task.title}" zurückgegeben`,
  });
  revalidatePath("/dashboard");
  revalidatePath(`/projekte/${task.project_id}`);
}

/** Nachricht in den Aufgaben-Thread schreiben (Chat, kein Logbuch-Eintrag). */
export async function postTaskMessage(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const id = s(fd, "task_id");
  const body = s(fd, "body");
  if (!id || !body) return fail("Nachricht fehlt.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();
  const { error } = await supabase.from("task_messages").insert({
    task_id: id,
    author_employee_id: me?.id ?? null,
    body,
    kind: "message",
  });
  if (error) return fail(error.message);
  return OK;
}

/** Thread als gelesen markieren (für Ungelesen-Zähler). */
export async function markTaskRead(taskId: string): Promise<void> {
  if (!taskId || ensureConfigured()) return;
  const me = await getCurrentEmployee();
  if (!me?.id) return;
  const supabase = await createClient();
  await supabase
    .from("task_reads")
    .upsert(
      { task_id: taskId, employee_id: me.id, last_read_at: new Date().toISOString() },
      { onConflict: "task_id,employee_id" },
    );
  revalidatePath("/dashboard");
}

/** Rückfrage an Kollegen: Aufgabe (direkt/angeboten) + erste Nachricht. */
export async function createRueckfrage(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const projectId = s(fd, "project_id");
  const title = s(fd, "title");
  const body = s(fd, "body");
  const ids = String(fd.get("employee_ids") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!projectId || !title) return fail("Projekt und Betreff angeben.");
  if (ids.length === 0) return fail("Mindestens einen Kollegen wählen.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();

  const offered = ids.length > 1;
  const { data: task, error } = await supabase
    .from("project_tasks")
    .insert({
      project_id: projectId,
      title,
      description: body,
      assignee_employee_id: offered ? null : ids[0],
      status: offered ? "angeboten" : "offen",
      sort: 999,
      created_by: me?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !task) return fail(error?.message ?? "Fehler.");

  if (offered)
    await supabase
      .from("task_candidates")
      .insert(ids.map((employee_id) => ({ task_id: task.id, employee_id })));
  if (body)
    await supabase.from("task_messages").insert({
      task_id: task.id,
      author_employee_id: me?.id ?? null,
      body,
      kind: "message",
    });
  await logActivity({
    projectId,
    type: "aufgabe",
    title: `Rückfrage „${title}" an ${ids.length > 1 ? `${ids.length} Kollegen` : "Kollegen"}`,
  });
  revalidatePath(`/projekte/${projectId}`);
  revalidatePath("/dashboard");
  return OK;
}

/** Aufgabe abhaken / wieder öffnen. */
export async function toggleTask(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  const done = String(fd.get("done") ?? "") === "true";
  if (!id) return;
  const me = await getCurrentEmployee();
  const supabase = await createClient();
  await supabase
    .from("project_tasks")
    .update({
      status: done ? "erledigt" : "offen",
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  const info = await taskInfo(supabase, id);
  await postEvent(
    supabase,
    id,
    me?.id ?? null,
    done ? "Als erledigt markiert" : "Wieder geöffnet",
  );
  if (done && info)
    await logActivity({
      projectId: info.project_id,
      type: "aufgabe",
      title: `Aufgabe „${info.title}" erledigt`,
    });
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
