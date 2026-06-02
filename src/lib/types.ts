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
  /** Kennzeichen „Vertrieb" — erscheint bei der Anfragen-Zuweisung. */
  is_sales?: boolean;
  /** Interner Stundensatz (€/Std) für die Nachkalkulation. */
  cost_rate?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  employee_id: string | null;
  work_date: string;
  hours: number;
  activity: string | null;
  description: string | null;
  hourly_rate: number | null;
  source: "manual" | "import" | string;
  external_id: string | null;
  created_by: string | null;
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
  /** Quelle der Anfrage (LEAD_SOURCES: Telefon/Web/Empfehlung …). */
  source: string | null;
  /** Anlagentyp (PROJECT_TYPES) — steuert Angebots-Bausteine & Ablauf-Vorlagen. */
  project_type: string | null;
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

export interface WorkflowTemplate {
  id: string;
  project_type: string | null;
  name: string;
  active: boolean;
  /** 'projekt' (Standard) | 'vertrieb' (vorgelagerter Vertriebsablauf). */
  phase: "projekt" | "vertrieb" | string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  role: string | null;
  offset_days: number;
  sort: number;
  /** Phase/Bündel für die Aufgaben-Gruppierung (z. B. „Planung"). */
  group_label: string | null;
}

/** Vorgänger-Beziehung zwischen Vorlagen-Schritten. */
export interface WorkflowStepDep {
  step_id: string;
  depends_on_step_id: string;
}

/** Vorgänger-Beziehung zwischen konkreten Aufgaben. */
export interface ProjectTaskDep {
  task_id: string;
  depends_on_task_id: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_employee_id: string | null;
  due_date: string | null;
  status: "wartet" | "offen" | "angeboten" | "erledigt" | string;
  /** Optionale Bündelung paralleler Aufgaben (z. B. „Vorbereitung"). */
  group_label: string | null;
  sort: number;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCandidate {
  task_id: string;
  employee_id: string;
  created_at: string;
}

export interface TaskMessage {
  id: string;
  task_id: string;
  author_employee_id: string | null;
  body: string;
  kind: "message" | "event" | string;
  created_at: string;
}

export type TaskMessageWithAuthor = TaskMessage & {
  author?: { name: string | null } | null;
};

export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  storage_path: string;
  mime: string | null;
  kind: string;
  size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export type DocumentKind =
  | "auftragsbestaetigung"
  | "lieferschein"
  | "rechnung"
  | "mahnung";

/** Rechnungstyp (in document.meta.invoice_type). */
export type InvoiceType = "voll" | "abschlag" | "schluss";

export interface DocumentRecord {
  id: string;
  project_id: string;
  kind: DocumentKind | string;
  doc_number: number | null;
  source_offer_id: string | null;
  source_document_id: string | null;
  status: string;
  title: string | null;
  positions: unknown[];
  totals: Record<string, unknown>;
  meta: Record<string, unknown>;
  commission: string | null;
  /** Rechnungs-Felder (nur bei kind='rechnung'/'mahnung'). */
  invoice_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  payment_status: string | null;
  paid_amount: number | null;
  percentage: number | null;
  reminder_level: number | null;
  last_reminder_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TextBlockKind =
  | "intro"
  | "art_der_anlage"
  | "leistung"
  | "nicht_enthalten"
  | "zahlungsbedingungen"
  | "gewaehrleistung"
  | "gueltigkeit"
  | "liefertermin"
  | "optionale_leistungen"
  | "schluss";

export interface OfferTextBlock {
  id: string;
  /** NULL = Standard für alle Anlagentypen. */
  project_type: string | null;
  kind: TextBlockKind | string;
  title: string | null;
  body: string | null;
  sort: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Measurement {
  id: string;
  project_id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  area: number | null;
  note: string | null;
  sort: number;
  created_by: string | null;
  created_at: string;
}

export interface ServiceContract {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  title: string;
  start_date: string | null;
  interval_months: number;
  next_due: string | null;
  price: number | null;
  status: "aktiv" | "pausiert" | "beendet" | string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Wartungsvertrag mit eingebettetem Kundennamen (für Listen). */
export type ServiceContractWithCustomer = ServiceContract & {
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  } | null;
};

export interface DispoEntry {
  id: string;
  project_id: string | null;
  employee_id: string | null;
  date: string;
  title: string;
  kind: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Dispo-Eintrag mit eingebettetem Projekttitel (für die Plantafel). */
export type DispoEntryWithProject = DispoEntry & {
  project: { id: string; title: string | null } | null;
};

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
