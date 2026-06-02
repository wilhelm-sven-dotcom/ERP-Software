import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";

/**
 * Eine Aktivität ins Logbuch schreiben (z. B. „Kalkulation erstellt/geändert").
 * Setzt automatisch den aktuellen Mitarbeiter als Urheber. Fehlertolerant —
 * ein fehlgeschlagenes Log darf die eigentliche Aktion nicht abbrechen.
 */
export async function logActivity(input: {
  projectId?: string | null;
  customerId?: string | null;
  type: string;
  title: string;
  body?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = await createClient();
    const me = await getCurrentEmployee();
    await supabase.from("activities").insert({
      project_id: input.projectId ?? null,
      customer_id: input.customerId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      employee_id: me?.id || null,
    });
  } catch (e) {
    console.error("logActivity:", e);
  }
}
