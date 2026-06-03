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
    group_label: s(fd, "group_label"),
    offset_days: Number(fd.get("offset_days") ?? 0) || 0,
    sort: Number(fd.get("sort") ?? 0) || 0,
  };
  const supabase = await createClient();
  const id = s(fd, "id");

  let stepId = id;
  if (id) {
    const { error } = await supabase
      .from("workflow_steps")
      .update(payload)
      .eq("id", id);
    if (error) return fail(error.message);
  } else {
    const { data, error } = await supabase
      .from("workflow_steps")
      .insert(payload)
      .select("id")
      .single();
    if (error) return fail(error.message);
    stepId = data.id;
  }

  // Vorgänger (Abhängigkeiten) ersetzen — CSV der Schritt-IDs, Selbstbezug raus.
  if (stepId) {
    const deps = String(fd.get("depends_on") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x && x !== stepId);
    await supabase.from("workflow_step_deps").delete().eq("step_id", stepId);
    if (deps.length > 0) {
      await supabase.from("workflow_step_deps").insert(
        deps.map((depends_on_step_id) => ({
          step_id: stepId,
          depends_on_step_id,
        })),
      );
    }
  }

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

/** Neue Ablaufvorlage anlegen (Name, Phase, optional Anlagentyp als Freitext). */
export async function createWorkflowTemplate(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const name = s(fd, "name");
  if (!name) return fail("Bitte einen Namen angeben.");
  const phase = s(fd, "phase") === "vertrieb" ? "vertrieb" : "projekt";
  const projectType = phase === "vertrieb" ? null : s(fd, "project_type");
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflow_templates")
    .insert({ name, phase, project_type: projectType, active: true });
  if (error) return fail(error.message);
  revalidatePath("/workflow");
  return OK;
}

export async function toggleTemplateActive(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const active = String(fd.get("active") ?? "") === "true";
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("workflow_templates").update({ active }).eq("id", id);
  revalidatePath("/workflow");
}

export async function deleteWorkflowTemplate(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("workflow_templates").delete().eq("id", id);
  revalidatePath("/workflow");
}

/**
 * Aus der passenden Vorlage Aufgaben für ein Projekt erzeugen — abhängigkeits-
 * bewusst: Schritte mit Vorgängern starten als 'wartet', Wurzeln als 'offen'.
 * Fälligkeit = heute + offset_days; Verantwortlicher = zugewiesener Bearbeiter.
 * Gibt die IDs der Wurzel-Aufgaben (ohne Vorgänger) zurück.
 */
export async function instantiateWorkflowForProject(
  projectId: string,
  phase: "projekt" | "vertrieb" = "projekt",
): Promise<{ rootTaskIds: string[]; count: number }> {
  if (!projectId) return { rootTaskIds: [], count: 0 };
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, project_type, assigned_employee_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { rootTaskIds: [], count: 0 };

  // Passende Vorlage je Phase: Vertrieb → erste aktive Vertriebsvorlage;
  // Projekt → zuerst typ-spezifisch, sonst irgendeine aktive Projektvorlage.
  const { data: templates } = await supabase
    .from("workflow_templates")
    .select("id, project_type, phase")
    .eq("active", true);
  const inPhase = (templates ?? []).filter(
    (t) => (t.phase ?? "projekt") === phase,
  );
  const tmpl =
    phase === "vertrieb"
      ? inPhase[0]
      : inPhase.find((t) => t.project_type === project.project_type) ??
        inPhase[0];
  if (!tmpl) return { rootTaskIds: [], count: 0 };

  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq("template_id", tmpl.id)
    .order("sort", { ascending: true });
  if (!steps || steps.length === 0) return { rootTaskIds: [], count: 0 };

  const stepIds = steps.map((s2) => s2.id);
  const { data: stepDeps } = await supabase
    .from("workflow_step_deps")
    .select("step_id, depends_on_step_id")
    .in("step_id", stepIds);
  const depsByStep = new Map<string, string[]>();
  for (const d of stepDeps ?? []) {
    (depsByStep.get(d.step_id) ?? depsByStep.set(d.step_id, []).get(d.step_id)!).push(
      d.depends_on_step_id,
    );
  }

  const me = await getCurrentEmployee();
  const today = new Date();
  const stepToTask = new Map<string, string>();
  const rootTaskIds: string[] = [];

  // Aufgaben einzeln anlegen, um die Schritt→Aufgabe-Zuordnung zu kennen.
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    const due = new Date(today);
    due.setDate(due.getDate() + (Number(st.offset_days) || 0));
    const hasPredecessor = (depsByStep.get(st.id) ?? []).length > 0;
    const { data: row, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title: st.title,
        description: st.description,
        assignee_employee_id: hasPredecessor
          ? null
          : project.assigned_employee_id ?? null,
        due_date: due.toISOString().slice(0, 10),
        status: hasPredecessor ? "wartet" : "offen",
        group_label: st.group_label ?? null,
        sort: i,
        created_by: me?.id || null,
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("instantiateWorkflow:", error?.message);
      continue;
    }
    stepToTask.set(st.id, row.id);
    if (!hasPredecessor) rootTaskIds.push(row.id);
  }

  // Aufgaben-Vorgänger aus den Schritt-Vorgängern ableiten.
  const taskDepRows: { task_id: string; depends_on_task_id: string }[] = [];
  for (const d of stepDeps ?? []) {
    const taskId = stepToTask.get(d.step_id);
    const depId = stepToTask.get(d.depends_on_step_id);
    if (taskId && depId) taskDepRows.push({ task_id: taskId, depends_on_task_id: depId });
  }
  if (taskDepRows.length > 0) {
    await supabase.from("project_task_deps").insert(taskDepRows);
  }

  return { rootTaskIds, count: stepToTask.size };
}

/** Projektablauf am Projekt starten (Formular-Action). */
export async function startWorkflow(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return;
  const phaseRaw = String(fd.get("phase") ?? "projekt");
  const phase = phaseRaw === "vertrieb" ? "vertrieb" : "projekt";

  const { count } = await instantiateWorkflowForProject(projectId, phase);
  if (count === 0) return;
  await logActivity({
    projectId,
    type: "workflow",
    title:
      phase === "vertrieb"
        ? `Vertriebsablauf gestartet (${count} Aufgaben)`
        : `Projektablauf gestartet (${count} Aufgaben)`,
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

/** Titel + Projekt + Status einer Aufgabe laden (für Events/Logbuch/Kaskade). */
async function taskInfo(
  supabase: DB,
  id: string,
): Promise<{ title: string; project_id: string; status: string } | null> {
  const { data } = await supabase
    .from("project_tasks")
    .select("title, project_id, status")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/**
 * Nach dem Erledigen einer Aufgabe: direkte Nachfolger, deren Vorgänger nun
 * ALLE erledigt sind, von 'wartet' auf aktiv schalten (offen bzw. angeboten).
 */
async function unblockAfterComplete(
  supabase: DB,
  taskId: string,
  meId: string | null,
): Promise<void> {
  const { data: dependents } = await supabase
    .from("project_task_deps")
    .select("task_id")
    .eq("depends_on_task_id", taskId);
  for (const dep of dependents ?? []) {
    const childId = dep.task_id;
    const { data: child } = await supabase
      .from("project_tasks")
      .select("id, status, assignee_employee_id, project_id")
      .eq("id", childId)
      .maybeSingle();
    if (!child || child.status !== "wartet") continue;

    // Alle Vorgänger des Nachfolgers erledigt?
    const { data: preds } = await supabase
      .from("project_task_deps")
      .select("depends_on_task_id")
      .eq("task_id", childId);
    const predIds = (preds ?? []).map((p) => p.depends_on_task_id);
    let allDone = true;
    if (predIds.length > 0) {
      const { data: predTasks } = await supabase
        .from("project_tasks")
        .select("id, status")
        .in("id", predIds);
      allDone = (predTasks ?? []).every((p) => p.status === "erledigt");
    }
    if (!allDone) continue;

    // Wurde die Aufgabe bereits mehreren angeboten? → 'angeboten', sonst 'offen'.
    const { data: cands } = await supabase
      .from("task_candidates")
      .select("employee_id")
      .eq("task_id", childId);
    const offered = (cands?.length ?? 0) > 0;
    let assignee = child.assignee_employee_id;
    if (!offered && !assignee) {
      const { data: proj } = await supabase
        .from("projects")
        .select("assigned_employee_id")
        .eq("id", child.project_id)
        .maybeSingle();
      assignee = proj?.assigned_employee_id ?? null;
    }
    await supabase
      .from("project_tasks")
      .update({
        status: offered ? "angeboten" : "offen",
        assignee_employee_id: offered ? null : assignee,
      })
      .eq("id", childId);
    await postEvent(supabase, childId, meId, "Fällig — Vorgänger erledigt");
  }
}

/**
 * Nach dem Wiederöffnen (Revidieren) einer Aufgabe: abhängige Nachfolger wieder
 * auf 'wartet' setzen. Bereits erledigte Nachfolger werden zusätzlich rekursiv
 * nachgezogen, sodass die Wiedervorlage durch die ganze Kette kaskadiert.
 */
async function reblockAfterReopen(
  supabase: DB,
  taskId: string,
  meId: string | null,
): Promise<void> {
  const queue = [taskId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    const { data: dependents } = await supabase
      .from("project_task_deps")
      .select("task_id")
      .eq("depends_on_task_id", current);
    for (const dep of dependents ?? []) {
      const childId = dep.task_id;
      if (visited.has(childId)) continue;
      visited.add(childId);
      const { data: child } = await supabase
        .from("project_tasks")
        .select("status")
        .eq("id", childId)
        .maybeSingle();
      if (!child || child.status === "wartet") continue;
      const wasDone = child.status === "erledigt";
      await supabase
        .from("project_tasks")
        .update({ status: "wartet", done_at: null })
        .eq("id", childId);
      await postEvent(supabase, childId, meId, "Wieder offen — Vorgänger revidiert");
      if (wasDone) queue.push(childId);
    }
  }
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
  // Lead-Ownership: hat das Projekt noch keinen Bearbeiter, übernimmt der
  // annehmende (Vertriebs-)Mitarbeiter den Strang.
  if (info) {
    const { data: proj } = await supabase
      .from("projects")
      .select("assigned_employee_id")
      .eq("id", info.project_id)
      .maybeSingle();
    if (proj && !proj.assigned_employee_id) {
      await supabase
        .from("projects")
        .update({ assigned_employee_id: me.id })
        .eq("id", info.project_id);
    }
  }
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
  if (!title) return fail("Betreff angeben.");
  if (ids.length === 0) return fail("Mindestens einen Kollegen wählen.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();

  const offered = ids.length > 1;
  const { data: task, error } = await supabase
    .from("project_tasks")
    .insert({
      project_id: projectId, // darf null sein (projektlose Rückfrage)
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
    projectId: projectId ?? null,
    type: "aufgabe",
    title: `Rückfrage „${title}" an ${ids.length > 1 ? `${ids.length} Kollegen` : "Kollegen"}`,
  });
  if (projectId) revalidatePath(`/projekte/${projectId}`);
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

  // Blockierte Aufgaben können nicht erledigt werden (offene Vorgänger).
  const before = await taskInfo(supabase, id);
  if (done && before?.status === "wartet") return;

  await supabase
    .from("project_tasks")
    .update({
      status: done ? "erledigt" : "offen",
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);

  // Abhängigkeiten nachziehen: erledigen → Nachfolger freigeben;
  // wieder öffnen → abhängige (erledigte) Nachfolger erneut fällig stellen.
  if (done) await unblockAfterComplete(supabase, id, me?.id ?? null);
  else await reblockAfterReopen(supabase, id, me?.id ?? null);

  const info = before ?? (await taskInfo(supabase, id));
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
  if (!done && info)
    await logActivity({
      projectId: info.project_id,
      type: "aufgabe",
      title: `Aufgabe „${info.title}" revidiert (wieder geöffnet)`,
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
