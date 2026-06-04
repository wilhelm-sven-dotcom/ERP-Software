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

export async function addSiteLogEntry(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const projectId = s(fd, "project_id");
  if (!projectId) return fail("Projekt fehlt.");
  const workDone = s(fd, "work_done");
  if (!workDone) return fail("Bitte die durchgeführten Arbeiten angeben.");

  const supabase = await createClient();
  let photoIds: string[] | null = null;
  const rawPhotos = s(fd, "photo_ids");
  if (rawPhotos) {
    try {
      const parsed = JSON.parse(rawPhotos);
      if (Array.isArray(parsed)) photoIds = parsed.filter((x) => typeof x === "string");
    } catch {
      photoIds = null;
    }
  }
  const { error } = await supabase.from("site_log").insert({
    project_id: projectId,
    log_date: s(fd, "log_date") ?? new Date().toISOString().slice(0, 10),
    weather: s(fd, "weather"),
    crew: s(fd, "crew"),
    work_done: workDone,
    note: s(fd, "note"),
    photo_ids: photoIds,
    ai_generated: fd.get("ai_generated") === "true",
    created_by: (await getCurrentEmployee())?.id ?? null,
  });
  if (error) return fail(error.message);
  await logActivity({ projectId, type: "bautagebuch", title: "Bautagebuch-Eintrag erfasst" });
  revalidatePath(`/projekte/${projectId}`);
  return OK;
}

export async function deleteSiteLogEntry(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("site_log").delete().eq("id", id);
  if (projectId) revalidatePath(`/projekte/${projectId}`);
}
