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

/** Alle Kalkulations-Varianten eines Projekts (älteste zuerst). */
export async function getCalculationsByProject(
  projectId: string,
): Promise<Calculation[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calculations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getCalculationsByProject:", error.message);
    return [];
  }
  return (data ?? []) as Calculation[];
}

export type CalcSummary = Pick<
  Calculation,
  "id" | "project_id" | "name" | "is_selected" | "system_size_kwp" | "storage_kwh"
>;

/** Schlanke Varianten-Übersicht aller Projekte (für die Kalkulations-Liste). */
export async function getAllCalculations(): Promise<CalcSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calculations")
    .select("id, project_id, name, is_selected, system_size_kwp, storage_kwh")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getAllCalculations:", error.message);
    return [];
  }
  return (data ?? []) as CalcSummary[];
}

export async function getCalculation(id: string): Promise<Calculation | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calculations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getCalculation:", error.message);
    return null;
  }
  return (data as Calculation) ?? null;
}
