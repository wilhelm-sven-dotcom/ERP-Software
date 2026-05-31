import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Calculation } from "@/lib/types";
import type { CalcPosition } from "@/lib/calc/types";

/** Persistierte Kalkulationsdaten: Positionen + gespeicherte Eingaben (in totals). */
export interface StoredCalcMeta {
  mwstPercent: number;
  gesamtRabattPercent: number;
  zuschlaege: { bezeichnung: string; betrag: number }[];
}

export function readPositions(calc: Calculation | null): CalcPosition[] {
  if (!calc || !Array.isArray(calc.positions)) return [];
  return calc.positions as unknown as CalcPosition[];
}

export function readMeta(calc: Calculation | null): StoredCalcMeta {
  const t = (calc?.totals ?? {}) as Record<string, unknown>;
  return {
    mwstPercent: typeof t.mwstPercent === "number" ? t.mwstPercent : 0,
    gesamtRabattPercent:
      typeof t.gesamtRabattPercent === "number" ? t.gesamtRabattPercent : 0,
    zuschlaege: Array.isArray(t.zuschlaege)
      ? (t.zuschlaege as { bezeichnung: string; betrag: number }[])
      : [],
  };
}

/** Kalkulation eines Projekts (neueste). */
export async function getCalculationByProject(
  projectId: string,
): Promise<Calculation | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calculations")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getCalculationByProject:", error.message);
    return null;
  }
  return (data as Calculation) ?? null;
}
