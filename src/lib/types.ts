/**
 * Zentrale TypeScript-Typen (Goldene Regel #4).
 * Baseline aus CLAUDE.md §5 — wird je Modul (Phase 3) erweitert.
 * In dieser Phase bewusst schlank gehalten.
 */

export type Role = "admin" | "mitarbeiter";

export type CustomerKind = "privat" | "gewerbe";

/** Aktueller, eingeloggter Nutzer (aus Supabase Auth + employees). */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

/** Mitarbeiter (Tabelle `employees`). */
export interface Employee {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string;
  role: Role;
  active: boolean;
}

/** Kunde (Tabelle `customers`) — Baseline. */
export interface Customer {
  id: string;
  customer_nr: number | null;
  kind: CustomerKind | null;
  company: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
}

/** Projekt (Tabelle `projects`) — Baseline. */
export interface Project {
  id: string;
  customer_id: string;
  title: string | null;
  status: string | null;
  system_size_kwp: number | null;
}
