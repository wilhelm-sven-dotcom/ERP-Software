-- ============================================================================
-- ip3 PV-Tool — NEUE Migrationen (Pakete 9 + 11–18) zum einmaligen Einspielen
-- Im Supabase SQL-Editor komplett ausführen. Alle Anweisungen sind idempotent
-- (if not exists / drop policy if exists), mehrfaches Ausführen ist unkritisch.
-- NICHT setup_all.sql verwenden, wenn das Grundschema bereits existiert.
-- ============================================================================

-- ===== 20260531122200_sales_and_task_dependencies.sql =====
-- ============================================================================
-- ip³ PV-Tool — Vertriebsprozess + Ablauf-Abhängigkeiten (UX-Paket 9)
--   • employees.is_sales  → Mitarbeiter als „Vertrieb" kennzeichnen
--   • projects.source      → Quelle der Anfrage (Telefon/Web/Empfehlung …)
--   • workflow_templates.phase ('vertrieb' | 'projekt')
--   • workflow_steps.group_label → Phase für die Aufgaben-Gruppierung
--   • workflow_step_deps / project_task_deps → Vorgänger (Abhängigkeiten)
--   • project_tasks.status erweitert um 'wartet' (reine Logik, kein CHECK)
--   • Seed: Vertriebsablauf-Vorlage + Vorgänger der Standard-Projektvorlagen
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

-- 1. Vertriebs-Kennzeichen je Mitarbeiter
alter table public.employees add column if not exists is_sales boolean not null default false;

-- 2. Quelle der Anfrage am Projekt
alter table public.projects add column if not exists source text;

-- 3. Phase der Vorlage: 'projekt' (Standard) oder 'vertrieb'
alter table public.workflow_templates add column if not exists phase text not null default 'projekt';

-- 4. Phasen-Label je Vorlagen-Schritt (gruppiert die Aufgaben in der Ansicht)
alter table public.workflow_steps add column if not exists group_label text;

-- 5. project_tasks.status kennt zusätzlich 'wartet' (blockiert durch Vorgänger).
--    Bleibt text — keine Schema-Änderung nötig.

-- 6. Abhängigkeiten zwischen Vorlagen-Schritten (Vorgänger)
create table if not exists public.workflow_step_deps (
  step_id             uuid not null references public.workflow_steps (id) on delete cascade,
  depends_on_step_id  uuid not null references public.workflow_steps (id) on delete cascade,
  primary key (step_id, depends_on_step_id)
);

-- 7. Abhängigkeiten zwischen konkreten Aufgaben (je Projekt)
create table if not exists public.project_task_deps (
  task_id             uuid not null references public.project_tasks (id) on delete cascade,
  depends_on_task_id  uuid not null references public.project_tasks (id) on delete cascade,
  primary key (task_id, depends_on_task_id)
);
create index if not exists project_task_deps_dep_idx on public.project_task_deps (depends_on_task_id);

alter table public.workflow_step_deps enable row level security;
alter table public.project_task_deps enable row level security;

-- Vorlagen-Abhängigkeiten: Personal liest, Admin verwaltet.
drop policy if exists "wsd_select" on public.workflow_step_deps;
create policy "wsd_select" on public.workflow_step_deps for select using (public.is_staff());
drop policy if exists "wsd_write" on public.workflow_step_deps;
create policy "wsd_write" on public.workflow_step_deps for all using (public.is_admin()) with check (public.is_admin());

-- Aufgaben-Abhängigkeiten: Personal liest/schreibt (entstehen beim Ablauf-Start).
drop policy if exists "ptd_select" on public.project_task_deps;
create policy "ptd_select" on public.project_task_deps for select using (public.is_staff());
drop policy if exists "ptd_write" on public.project_task_deps;
create policy "ptd_write" on public.project_task_deps for all using (public.is_staff()) with check (public.is_staff());

-- ── Seed: Vertriebsablauf-Vorlage (nur, wenn noch keine 'vertrieb'-Vorlage da) ──
insert into public.workflow_templates (project_type, name, phase)
select null, 'Vertriebsablauf — Standard', 'vertrieb'
where not exists (select 1 from public.workflow_templates where phase = 'vertrieb');

insert into public.workflow_steps (template_id, title, description, role, offset_days, sort, group_label)
select wt.id, s.title, s.description, 'vertrieb', s.offset_days, s.sort, 'Vertrieb'
from public.workflow_templates wt
cross join (values
  ('Kontaktaufnahme',          'Erstkontakt herstellen (Anruf/E-Mail).',                 0, 0),
  ('2. Kontaktaufnahme',       'Nachfassen, falls kein Erstkontakt zustande kam.',       3, 1),
  ('Telefongespräch',          'Bedarf und Eckdaten telefonisch klären.',                5, 2),
  ('Bedarf / Qualifizierung',  'Anlagengröße, Budget und Zeithorizont qualifizieren.',   7, 3),
  ('Vor-Ort-Termin',           'Beratung / Aufnahme vor Ort.',                          10, 4),
  ('Angebot vorbereiten',      'Kalkulation und Angebot erstellen.',                    14, 5),
  ('Nachfassen',               'Angebot nachverfolgen.',                                21, 6),
  ('Abschluss / Auftrag',      'Auftrag gewinnen oder Absage dokumentieren.',           28, 7)
) as s(title, description, offset_days, sort)
where wt.phase = 'vertrieb'
  and not exists (select 1 from public.workflow_steps ws where ws.template_id = wt.id);

-- Vertriebsschritte laufen sequenziell: jeder hängt am vorigen.
insert into public.workflow_step_deps (step_id, depends_on_step_id)
select cur.id, prev.id
from public.workflow_templates wt
join public.workflow_steps cur  on cur.template_id  = wt.id
join public.workflow_steps prev on prev.template_id = wt.id and prev.sort = cur.sort - 1
where wt.phase = 'vertrieb'
on conflict do nothing;

-- ── Seed: Phasen-Labels für die Standard-Projektschritte (nur wo noch leer) ──
update public.workflow_steps ws
set group_label = m.grp
from (values
  ('Aufmaß / Vor-Ort-Termin',         'Planung'),
  ('Planung & Auslegung',             'Planung'),
  ('Netzanmeldung',                   'Vorbereitung'),
  ('Materialbestellung',              'Vorbereitung'),
  ('Terminierung / Gerüst',           'Vorbereitung'),
  ('Montage',                         'Umsetzung'),
  ('Elektroinstallation & Anschluss', 'Umsetzung'),
  ('Inbetriebnahme',                  'Abschluss'),
  ('Marktstammdatenregister',         'Abschluss'),
  ('Dokumentation & Übergabe',        'Abschluss')
) as m(title, grp)
join public.workflow_templates wt on wt.id = ws.template_id and wt.phase = 'projekt'
where ws.title = m.title and ws.group_label is null;

-- ── Seed: Vorgänger der Standard-Projektschritte (Titel-Matching je Vorlage) ──
-- Ergibt eine Mischung aus Reihenfolge und Parallelität, z. B. nach „Planung"
-- laufen Netzanmeldung und Materialbestellung parallel. (project_task_deps wird
-- erst je Projekt beim Ablauf-Start aus diesen Schritt-Vorgängern erzeugt.)
insert into public.workflow_step_deps (step_id, depends_on_step_id)
select cur.id, prev.id
from public.workflow_templates wt
join public.workflow_steps cur  on cur.template_id  = wt.id
join public.workflow_steps prev on prev.template_id = wt.id
join (values
  ('Planung & Auslegung',             'Aufmaß / Vor-Ort-Termin'),
  ('Netzanmeldung',                   'Planung & Auslegung'),
  ('Materialbestellung',              'Planung & Auslegung'),
  ('Terminierung / Gerüst',           'Materialbestellung'),
  ('Montage',                         'Terminierung / Gerüst'),
  ('Elektroinstallation & Anschluss', 'Montage'),
  ('Inbetriebnahme',                  'Elektroinstallation & Anschluss'),
  ('Marktstammdatenregister',         'Inbetriebnahme'),
  ('Marktstammdatenregister',         'Netzanmeldung'),
  ('Dokumentation & Übergabe',        'Inbetriebnahme')
) as e(child, parent) on cur.title = e.child and prev.title = e.parent
where wt.phase = 'projekt'
on conflict do nothing;

-- ===== 20260602000100_invoices.sql =====
-- ============================================================================
-- ip³ PV-Tool — Rechnungen & Abschlagsrechnungen (Paket 11)
-- Erweitert die generische `documents`-Tabelle um Rechnungs-Felder. Eine
-- Rechnung ist ein document mit kind='rechnung' (Typ in meta.invoice_type:
-- 'voll' | 'abschlag' | 'schluss'). Eigener Nummernkreis via nextDocNumber().
-- Firmen-Zahlungsdaten (IBAN/Steuernr.) liegen im settings-Key 'company' (JSONB).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.documents add column if not exists invoice_date date;
alter table public.documents add column if not exists due_date date;
alter table public.documents add column if not exists paid_at timestamptz;
alter table public.documents add column if not exists payment_status text; -- offen|teilbezahlt|bezahlt
alter table public.documents add column if not exists paid_amount numeric;
alter table public.documents add column if not exists percentage numeric;   -- Abschlag in %

create index if not exists documents_kind_status_idx
  on public.documents (kind, payment_status, due_date);

-- kind erlaubt zusätzlich 'rechnung' (Spalte ist text ohne CHECK).
-- RLS/Audit der documents-Tabelle gelten unverändert weiter.

-- ===== 20260602000200_dunning.sql =====
-- ============================================================================
-- ip³ PV-Tool — Mahnwesen & Zahlungsstatus (Paket 12)
-- Rechnungen (documents kind='rechnung') bekommen einen Mahnstand; Mahnungen
-- sind eigene documents (kind='mahnung') mit Verweis auf die Rechnung.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.documents add column if not exists reminder_level int not null default 0;
alter table public.documents add column if not exists last_reminder_at timestamptz;

-- kind erlaubt zusätzlich 'mahnung' (Spalte ist text ohne CHECK).

-- ===== 20260602000300_service_contracts.sql =====
-- ============================================================================
-- ip³ PV-Tool — Wartungsverträge (Paket 13)
-- Wiederkehrende Wartung/Instandhaltung je Kunde/Projekt mit Intervall und
-- nächster Fälligkeit. „Wartung erledigt" schiebt die nächste Fälligkeit weiter.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.service_contracts (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.customers (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  title           text not null,
  start_date      date,
  interval_months int not null default 12,
  next_due        date,
  price           numeric,
  status          text not null default 'aktiv',  -- aktiv | pausiert | beendet
  notes           text,
  created_by      uuid references public.employees (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists service_contracts_due_idx on public.service_contracts (next_due);
create index if not exists service_contracts_customer_idx on public.service_contracts (customer_id);

alter table public.service_contracts enable row level security;

drop policy if exists "sc_select" on public.service_contracts;
create policy "sc_select" on public.service_contracts for select using (public.is_staff());
drop policy if exists "sc_insert" on public.service_contracts;
create policy "sc_insert" on public.service_contracts for insert with check (public.is_staff());
drop policy if exists "sc_update" on public.service_contracts;
create policy "sc_update" on public.service_contracts for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "sc_delete" on public.service_contracts;
create policy "sc_delete" on public.service_contracts for delete using (public.is_admin());

-- ===== 20260602000400_dispo.sql =====
-- ============================================================================
-- ip³ PV-Tool — Plantafel / Disposition (Paket 14)
-- Termine/Einsätze je Mitarbeiter und Tag (Montage, Aufmaß, Wartung …).
-- Wird in einem Wochenraster per Drag & Drop verschoben.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.dispo_entries (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects (id) on delete set null,
  employee_id  uuid references public.employees (id) on delete set null,
  date         date not null,
  title        text not null,
  kind         text not null default 'einsatz',  -- einsatz | montage | aufmass | wartung | sonstiges
  note         text,
  created_by   uuid references public.employees (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists dispo_entries_date_idx on public.dispo_entries (date);
create index if not exists dispo_entries_employee_idx on public.dispo_entries (employee_id, date);

alter table public.dispo_entries enable row level security;

drop policy if exists "de_select" on public.dispo_entries;
create policy "de_select" on public.dispo_entries for select using (public.is_staff());
drop policy if exists "de_insert" on public.dispo_entries;
create policy "de_insert" on public.dispo_entries for insert with check (public.is_staff());
drop policy if exists "de_update" on public.dispo_entries;
create policy "de_update" on public.dispo_entries for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "de_delete" on public.dispo_entries;
create policy "de_delete" on public.dispo_entries for delete using (public.is_staff());

-- ===== 20260602000500_measurements.sql =====
-- ============================================================================
-- ip³ PV-Tool — Aufmaß (Paket 17)
-- Aufmaß-Positionen je Projekt (Dachflächen, Stückzahlen, Längen …), die in
-- eine Kalkulation übernommen werden können.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.measurements (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  label       text not null,
  quantity    numeric,
  unit        text,
  area        numeric,
  note        text,
  sort        int not null default 0,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists measurements_project_idx on public.measurements (project_id, sort);

alter table public.measurements enable row level security;

drop policy if exists "ms_select" on public.measurements;
create policy "ms_select" on public.measurements for select using (public.is_staff());
drop policy if exists "ms_insert" on public.measurements;
create policy "ms_insert" on public.measurements for insert with check (public.is_staff());
drop policy if exists "ms_update" on public.measurements;
create policy "ms_update" on public.measurements for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "ms_delete" on public.measurements;
create policy "ms_delete" on public.measurements for delete using (public.is_staff());

-- ===== 20260602000600_site_log.sql =====
-- ============================================================================
-- ip³ PV-Tool — Bautagebuch / Baustellendokumentation (Paket 18)
-- Chronologische Einträge je Projekt (Datum, Wetter, Mannschaft, Arbeiten).
-- Fotos werden über die bestehende project_files-Ablage verknüpft.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.site_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  log_date    date not null default current_date,
  weather     text,
  crew        text,
  work_done   text,
  note        text,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists site_log_project_idx on public.site_log (project_id, log_date desc);

alter table public.site_log enable row level security;

drop policy if exists "sl_select" on public.site_log;
create policy "sl_select" on public.site_log for select using (public.is_staff());
drop policy if exists "sl_insert" on public.site_log;
create policy "sl_insert" on public.site_log for insert with check (public.is_staff());
drop policy if exists "sl_update" on public.site_log;
create policy "sl_update" on public.site_log for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "sl_delete" on public.site_log;
create policy "sl_delete" on public.site_log for delete using (public.is_admin() or created_by = public.current_employee_id());
