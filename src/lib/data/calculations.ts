import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Calculation } from "@/lib/types";
import type { CalcPosition } from "@/lib/calc/types";

/** Gespeicherte Eingaben (im totals-jsonb mitgeführt). */
export interface StoredCalcMeta {
  pauschalRabattPercent: number;
  nachlass: number;
  mwstPercent: number;
  skontoPercent: number;
}

export function readPositions(calc: Calculation | null): CalcPosition[] {
  if (!calc || !Array.isArray(calc.positions)) return [];
  return calc.positions as unknown as CalcPosition[];
}

export function readMeta(calc: Calculation | null): StoredCalcMeta {
  const t = (calc?.totals ?? {}) as Record<string, unknown>;
  const n = (v: unknown, d: number) => (typeof v === "number" ? v : d);
  return {
    pauschalRabattPercent: n(t.pauschalRabattPercent, 0),
    nachlass: n(t.nachlass, 0),
    mwstPercent: n(t.mwstSatz ?? t.mwstPercent, 0),
    skontoPercent: n(t.skontoPercent, 0),
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
