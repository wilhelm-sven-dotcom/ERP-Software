"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/**
 * Mitarbeiter-Stammdaten/Rolle ändern.
 * Nur Admins dürfen schreiben (Defense-in-Depth zusätzlich zur RLS).
 */
export async function saveEmployee(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const me = await getCurrentEmployee();
  if (me?.role !== "admin") {
    return fail("Nur Administratoren dürfen Mitarbeiter verwalten.");
  }

  const id = s(fd, "id");
  if (!id) return fail("Mitarbeiter fehlt.");

  const roleRaw = s(fd, "role");
  const payload = {
    name: s(fd, "name"),
    role: roleRaw === "admin" ? "admin" : "mitarbeiter",
    active: fd.get("active") === "on" || fd.get("active") === "true",
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/mitarbeiter");
  return OK;
}
