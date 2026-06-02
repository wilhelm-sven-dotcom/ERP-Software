import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface InboxItem {
  task_id: string;
  title: string;
  project_id: string | null;
  reason: "angeboten" | "nachricht";
  at: string;
}

export interface Inbox {
  offered: InboxItem[];
  unread: InboxItem[];
  total: number;
}

const EMPTY: Inbox = { offered: [], unread: [], total: 0 };

/**
 * Posteingang des aktuellen Mitarbeiters:
 * - „offered": ihm angebotene Aufgaben (noch nicht angenommen).
 * - „unread": Aufgaben-Threads mit neuen Nachrichten (an denen er beteiligt ist).
 */
export async function getInbox(employeeId: string): Promise<Inbox> {
  if (!isSupabaseConfigured() || !employeeId) return EMPTY;
  const supabase = await createClient();

  // 1) Mir angebotene Aufgaben (Status 'angeboten').
  const { data: offeredRows } = await supabase
    .from("task_candidates")
    .select("task_id, created_at, task:project_tasks!inner(id, title, project_id, status)")
    .eq("employee_id", employeeId);
  const offered: InboxItem[] = (offeredRows ?? [])
    .filter((r) => {
      const t = r.task as unknown as { status?: string };
      return t?.status === "angeboten";
    })
    .map((r) => {
      const t = r.task as unknown as { id: string; title: string; project_id: string | null };
      return {
        task_id: t.id,
        title: t.title,
        project_id: t.project_id,
        reason: "angeboten" as const,
        at: r.created_at,
      };
    });

  // 2) Aufgaben, an denen ich beteiligt bin (Owner/Ersteller/Kandidat/Autor).
  const involved = new Set<string>();
  const [asgn, creat, cand, auth] = await Promise.all([
    supabase.from("project_tasks").select("id").eq("assignee_employee_id", employeeId),
    supabase.from("project_tasks").select("id").eq("created_by", employeeId),
    supabase.from("task_candidates").select("task_id").eq("employee_id", employeeId),
    supabase.from("task_messages").select("task_id").eq("author_employee_id", employeeId),
  ]);
  (asgn.data ?? []).forEach((r) => involved.add(r.id));
  (creat.data ?? []).forEach((r) => involved.add(r.id));
  (cand.data ?? []).forEach((r) => involved.add(r.task_id));
  (auth.data ?? []).forEach((r) => involved.add(r.task_id));
  const taskIds = [...involved];

  const unread: InboxItem[] = [];
  if (taskIds.length > 0) {
    const [{ data: msgs }, { data: reads }] = await Promise.all([
      supabase
        .from("task_messages")
        .select("task_id, author_employee_id, created_at, task:project_tasks!inner(title, project_id)")
        .in("task_id", taskIds)
        .order("created_at", { ascending: false }),
      supabase.from("task_reads").select("task_id, last_read_at").eq("employee_id", employeeId),
    ]);
    const lastRead = new Map((reads ?? []).map((r) => [r.task_id, r.last_read_at]));
    const seen = new Set<string>();
    for (const m of msgs ?? []) {
      if (seen.has(m.task_id)) continue; // nur die jeweils neueste Nachricht
      seen.add(m.task_id);
      if (m.author_employee_id === employeeId) continue; // eigene zählen nicht
      const read = lastRead.get(m.task_id);
      if (read && new Date(read) >= new Date(m.created_at)) continue;
      const t = m.task as unknown as { title: string; project_id: string | null };
      unread.push({
        task_id: m.task_id,
        title: t?.title ?? "Aufgabe",
        project_id: t?.project_id ?? null,
        reason: "nachricht",
        at: m.created_at,
      });
    }
  }

  return { offered, unread, total: offered.length + unread.length };
}
