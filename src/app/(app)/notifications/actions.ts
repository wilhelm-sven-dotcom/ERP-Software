"use server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getInbox, type Inbox } from "@/lib/data/notifications";

const EMPTY: Inbox = { offered: [], unread: [], total: 0 };

/** Posteingang des aktuellen Mitarbeiters (für die Glocke). */
export async function fetchMyInbox(): Promise<Inbox> {
  const me = await getCurrentEmployee();
  if (!me?.id) return EMPTY;
  return getInbox(me.id);
}
