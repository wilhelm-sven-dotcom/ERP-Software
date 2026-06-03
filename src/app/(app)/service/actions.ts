"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getServiceTicket } from "@/lib/data/service";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

/** Ticket-Detail (Felder, Kommentare, Dateien) für den Karten-Dialog laden. */
export async function fetchServiceTicketDetail(id: string) {
  if (ensureConfigured() || !id) return null;
  return getServiceTicket(id);
}

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

export async function saveServiceTicket(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const title = s(fd, "title");
  if (!title) return fail("Bitte einen Titel angeben.");
  const payload = {
    title,
    customer_id: s(fd, "customer_id"),
    location: s(fd, "location"),
    status: s(fd, "status") ?? "Eingang",
    assignee_employee_id: s(fd, "assignee_employee_id"),
    due_date: s(fd, "due_date"),
    description: s(fd, "description"),
  };
  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("service_tickets").update(payload).eq("id", id)
    : await supabase
        .from("service_tickets")
        .insert({ ...payload, created_by: (await getCurrentEmployee())?.id ?? null });
  if (error) return fail(error.message);
  revalidatePath("/service");
  return OK;
}

/** Karte per Drag & Drop in eine andere Spalte (Status) verschieben. */
export async function moveServiceTicket(
  id: string,
  status: string,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!id || !status) return fail("Ungültige Daten.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_tickets")
    .update({ status })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/service");
  return OK;
}

export async function deleteServiceTicket(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("service_tickets").delete().eq("id", id);
  revalidatePath("/service");
}

export async function postServiceMessage(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const ticketId = s(fd, "ticket_id");
  const body = s(fd, "body");
  if (!ticketId || !body) return fail("Nachricht fehlt.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();
  const { error } = await supabase.from("service_ticket_messages").insert({
    ticket_id: ticketId,
    author_employee_id: me?.id ?? null,
    body,
    kind: "message",
  });
  if (error) return fail(error.message);
  revalidatePath("/service");
  return OK;
}

/** Hochgeladene Service-Datei registrieren (Foto/Anhang); optional als Cover. */
export async function registerServiceFile(input: {
  ticketId: string;
  name: string;
  storagePath: string;
  mime: string | null;
  size: number | null;
  asCover?: boolean;
  /** Extrahierter PDF-Text für die Inhaltssuche (optional). */
  textContent?: string | null;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.ticketId || !input.storagePath) return fail("Ungültige Daten.");
  const me = await getCurrentEmployee();
  const supabase = await createClient();
  const { error } = await supabase.from("service_ticket_files").insert({
    ticket_id: input.ticketId,
    name: input.name,
    storage_path: input.storagePath,
    mime: input.mime,
    size: input.size,
    text_content: input.textContent ?? null,
    uploaded_by: me?.id ?? null,
  });
  if (error) return fail(error.message);
  if (input.asCover) {
    await supabase
      .from("service_tickets")
      .update({ cover_path: input.storagePath })
      .eq("id", input.ticketId);
  }
  revalidatePath("/service");
  return OK;
}

export async function setServiceCover(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const path = String(fd.get("path") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("service_tickets").update({ cover_path: path || null }).eq("id", id);
  revalidatePath("/service");
}

export async function deleteServiceFile(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const path = String(fd.get("path") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  if (path) await supabase.storage.from("service-files").remove([path]);
  await supabase.from("service_ticket_files").delete().eq("id", id);
  revalidatePath("/service");
}
