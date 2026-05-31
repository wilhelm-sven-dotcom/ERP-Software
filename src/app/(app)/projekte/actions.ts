"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}
function n(fd: FormData, key: string): number | null {
  const v = s(fd, key);
  if (v === null) return null;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

export async function saveProject(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const id = s(fd, "id");
  const title = s(fd, "title");
  if (!title) return fail("Bitte einen Projekttitel angeben.");

  const payload = {
    title,
    customer_id: s(fd, "customer_id"),
    status: s(fd, "status") ?? "Anfrage",
    assigned_employee_id: s(fd, "assigned_employee_id"),
    street: s(fd, "street"),
    zip: s(fd, "zip"),
    city: s(fd, "city"),
    system_size_kwp: n(fd, "system_size_kwp"),
    notes: s(fd, "notes"),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("projects").update(payload).eq("id", id)
    : await supabase.from("projects").insert(payload);
  if (error) return fail(error.message);

  revalidatePath("/projekte");
  revalidatePath("/pipeline");
  if (id) revalidatePath(`/projekte/${id}`);
  return OK;
}

/** Nur den Status setzen (Pipeline-Schnellwechsel). */
export async function setProjectStatus(fd: FormData): Promise<void> {
  const id = s(fd, "id");
  const status = s(fd, "status");
  if (!id || !status || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("projects").update({ status }).eq("id", id);
  revalidatePath("/pipeline");
  revalidatePath("/projekte");
  revalidatePath(`/projekte/${id}`);
}

export async function deleteProject(fd: FormData): Promise<void> {
  const id = s(fd, "id");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/projekte");
  revalidatePath("/pipeline");
  redirect("/projekte");
}

export async function addProjectActivity(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const projectId = s(fd, "project_id");
  const title = s(fd, "title");
  if (!projectId) return fail("Projekt fehlt.");
  if (!title) return fail("Bitte einen Titel angeben.");

  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    project_id: projectId,
    customer_id: s(fd, "customer_id"),
    type: s(fd, "type") ?? "notiz",
    title,
    body: s(fd, "body"),
  });
  if (error) return fail(error.message);

  revalidatePath(`/projekte/${projectId}`);
  return OK;
}
