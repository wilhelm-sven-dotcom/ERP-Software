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

/** Großhändler anlegen oder bearbeiten. */
export async function saveWholesaler(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const name = s(fd, "name");
  if (!name) return fail("Bitte einen Namen angeben.");

  const id = s(fd, "id");
  const payload = {
    name,
    contact: s(fd, "contact"),
    email: s(fd, "email"),
    phone: s(fd, "phone"),
    notes: s(fd, "notes"),
  };

  const supabase = await createClient();
  let error;
  if (id) {
    ({ error } = await supabase
      .from("wholesalers")
      .update(payload)
      .eq("id", id));
  } else {
    const me = await getCurrentEmployee();
    ({ error } = await supabase
      .from("wholesalers")
      .insert({ ...payload, created_by: me?.id || null }));
  }
  if (error) return fail(error.message);

  revalidatePath("/grosshaendler");
  return OK;
}

export async function deleteWholesaler(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("wholesalers").delete().eq("id", id);
  revalidatePath("/grosshaendler");
}
