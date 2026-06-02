/**
 * Zentrale TypeScript-Typen (Goldene Regel #4).
 * Spiegeln das Postgres-Schema aus supabase/migrations wider.
 * jsonb-Felder bleiben bewusst flexibel (Record/Array), bis die Fachmodule
 * (Phase 3) genauere Strukturen festlegen.
 */

export type Role = "admin" | "mitarbeiter";

export type CustomerKind = "privat" | "gewerbe";

/** Pipeline-Stufen (Legacy-Werte aus /legacy; ohne harten DB-CHECK). */
export type ProjectStatus =
  | "Anfrage"
  | "Angebot"
  | "Auftrag"
  | "Entwurf"
  | "gewonnen"
  | "verloren";

export type AuditAction = "create" | "update" | "delete";

/** Aktueller, eingeloggter Nutzer (aus Supabase Auth + employees). */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

export interface Employee {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string | null;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductGroup {
  id: string;
  name: string;
  parent_id: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_nr: number | null;
  kind: CustomerKind | null;
  company: string | null;
  salutation: string | null;
  academic_title: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  customer_id: string | null;
  title: string | null;
  status: ProjectStatus | string | null;
  assigned_employee_id: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  system_size_kwp: number | null;
  /** Speicherkapazität in kWh (für spezifischen Speicherpreis €/kWh). */
  storage_kwh: number | null;
  /** Geokoordinaten des Montageorts (für die Karten-Anzeige). */
  lat: number | null;
  lon: number | null;
  notes: string | null;
  details: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  project_id: string | null;
  customer_id: string | null;
  type: string | null;
  title: string | null;
  body: string | null;
  employee_id: string | null;
  occurred_at: string | null;
  created_at: string;
}

/** Aktivität samt eingebettetem Mitarbeiternamen (für die Timeline). */
export type ActivityWithEmployee = Activity & {
  employee?: { name: string | null } | null;
};

export interface Product {
  id: string;
  group_id: string | null;
  name: string;
  manufacturer: string | null;
  category: string | null;
  sku: string | null;
  price_purchase: number | null;
  price_sell: number | null;
  unit: string | null;
  specs: Record<string, unknown>;
  /** Manuelle Sortierung innerhalb der Gruppe (Drag & Drop). */
  sort: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductAsset {
  id: string;
  product_id: string | null;
  kind: string | null;
  name: string | null;
  storage_path: string | null;
  mime: string | null;
  created_at: string;
}

export interface Wholesaler {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Verknüpfung Produkt ↔ Großhändler mit Bestellnummer und EK je Händler. */
export interface ProductWholesaler {
  id: string;
  product_id: string;
  wholesaler_id: string;
  order_number: string | null;
  price_purchase: number | null;
  created_at: string;
  /** Eingebetteter Händler (bei Join). */
  wholesaler?: { name: string | null } | null;
}

export interface OfferTemplate {
  id: string;
  name: string;
  kind: string | null;
  is_default: boolean;
  content: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalcTemplate {
  id: string;
  name: string;
  is_default: boolean;
  positions: unknown[];
  defaults: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Calculation {
  id: string;
  project_id: string | null;
  name: string | null;
  is_selected: boolean;
  system_size_kwp: number | null;
  storage_kwh: number | null;
  positions: unknown[];
  totals: Record<string, unknown>;
  margin: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type OfferStatus =
  | "Entwurf"
  | "Versendet"
  | "Angenommen"
  | "Abgelehnt";

export interface Offer {
  id: string;
  project_id: string;
  calculation_id: string | null;
  offer_number: number | null;
  title: string | null;
  status: OfferStatus | string;
  positions: unknown[];
  totals: Record<string, unknown>;
  meta: Record<string, unknown>;
  valid_until: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface ChangeLogEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: AuditAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  employee_id: string | null;
  created_at: string;
}
