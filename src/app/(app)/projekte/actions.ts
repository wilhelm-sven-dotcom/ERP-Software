"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
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

/** Adresse → Lat/Lon via OpenStreetMap Nominatim (fehlertolerant). */
async function geocode(
  street: string | null,
  zip: string | null,
  city: string | null,
): Promise<{ lat: number; lon: number } | null> {
  const q = [street, [zip, city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  if (!q) return null;
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de&q=" +
      encodeURIComponent(q);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ip3-pv-tool/1.0 (Projekt-Geocoding)",
        "Accept-Language": "de",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const hit = data[0];
    if (!hit?.lat || !hit?.lon) return null;
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch {
    return null;
  }
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

  const payload: Record<string, unknown> = {
    title,
    customer_id: s(fd, "customer_id"),
    status: s(fd, "status") ?? "Anfrage",
    project_type: s(fd, "project_type"),
    assigned_employee_id: s(fd, "assigned_employee_id"),
    street: s(fd, "street"),
    zip: s(fd, "zip"),
    city: s(fd, "city"),
    system_size_kwp: n(fd, "system_size_kwp"),
    storage_kwh: n(fd, "storage_kwh"),
    notes: s(fd, "notes"),
  };

  const supabase = await createClient();

  // Geokoordinaten für die Karte: nur ermitteln, wenn eine Adresse vorhanden ist
  // und (neu angelegt oder Adresse geändert) — schont die Nominatim-Nutzung.
  const street = payload.street as string | null;
  const zip = payload.zip as string | null;
  const city = payload.city as string | null;
  let needGeocode = Boolean(street && city);
  if (needGeocode && id) {
    const { data: existing } = await supabase
      .from("projects")
      .select("street, zip, city, lat, lon")
      .eq("id", id)
      .maybeSingle();
    const unchanged =
      existing &&
      existing.street === street &&
      existing.zip === zip &&
      existing.city === city &&
      existing.lat != null &&
      existing.lon != null;
    if (unchanged) needGeocode = false;
  }
  if (needGeocode) {
    const coords = await geocode(street, zip, city);
    if (coords) {
      payload.lat = coords.lat;
      payload.lon = coords.lon;
    }
  }

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

/** Status per Drag & Drop in der Pipeline setzen (typisiert, optimistisch). */
export async function moveProjectStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!id || !status) return fail("Projekt oder Status fehlt.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/pipeline");
  revalidatePath("/projekte");
  revalidatePath(`/projekte/${id}`);
  return OK;
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
  const me = await getCurrentEmployee();
  const { error } = await supabase.from("activities").insert({
    project_id: projectId,
    customer_id: s(fd, "customer_id"),
    type: s(fd, "type") ?? "notiz",
    title,
    body: s(fd, "body"),
    employee_id: me?.id || null,
  });
  if (error) return fail(error.message);

  revalidatePath(`/projekte/${projectId}`);
  return OK;
}

/** Metadaten einer hochgeladenen Projekt-Datei speichern. */
export async function registerProjectFile(input: {
  projectId: string;
  name: string;
  storagePath: string;
  mime: string | null;
  size: number | null;
  kind?: string;
  /** Extrahierter PDF-Text für die Inhaltssuche (optional). */
  textContent?: string | null;
  /** KI-interpretierte Beleg-Felder (Lieferant, Betrag, Datum …). */
  docMeta?: Record<string, unknown> | null;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.projectId || !input.storagePath) return fail("Ungültige Daten.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();
  const { error } = await supabase.from("project_files").insert({
    project_id: input.projectId,
    name: input.name,
    storage_path: input.storagePath,
    mime: input.mime,
    size: input.size,
    kind: input.kind ?? "dokument",
    text_content: input.textContent ?? null,
    doc_meta: input.docMeta ?? null,
    uploaded_by: me?.id ?? null,
  });
  if (error) return fail(error.message);
  await logActivity({
    projectId: input.projectId,
    type: "datei",
    title: `Datei hochgeladen: ${input.name}`,
  });
  revalidatePath(`/projekte/${input.projectId}`);
  return OK;
}

export async function deleteProjectFile(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const path = String(fd.get("path") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  if (path) await supabase.storage.from("project-files").remove([path]);
  await supabase.from("project_files").delete().eq("id", id);
  if (projectId) revalidatePath(`/projekte/${projectId}`);
}
