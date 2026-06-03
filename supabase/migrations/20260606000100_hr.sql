-- ============================================================================
-- ip³ PV-Tool — Personal/HR: erweiterte Mitarbeiter-Stammdaten, Verträge, Urlaub
-- (1) employees um echte Stammdaten erweitern (Vor-/Nachname getrennt → fixt
--     auch die Vornamen-Begrüßung), Adresse, Daten, Kontakt, Urlaubsanspruch.
-- (2) employee_contracts (Arbeitsverträge), employee_absences (Urlaub/Krank).
-- RLS: Admin sieht/verwaltet alles; Mitarbeiter sieht nur seine eigenen Daten.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.employees add column if not exists first_name text;
alter table public.employees add column if not exists last_name text;
alter table public.employees add column if not exists birth_date date;
alter table public.employees add column if not exists start_date date;
alter table public.employees add column if not exists street text;
alter table public.employees add column if not exists zip text;
alter table public.employees add column if not exists city text;
alter table public.employees add column if not exists phone text;
alter table public.employees add column if not exists mobile text;
alter table public.employees add column if not exists position text;
alter table public.employees add column if not exists emergency_contact text;
alter table public.employees add column if not exists vacation_days_per_year int not null default 30;

-- Bestehende „name"-Daten in Vor-/Nachname aufteilen (nur wenn noch leer).
update public.employees
set first_name = split_part(name, ' ', 1),
    last_name  = nullif(substring(name from position(' ' in name) + 1), name)
where (first_name is null or first_name = '') and name is not null and name <> '';

-- ---------------------------------------------------------------------------
-- Arbeitsverträge
-- ---------------------------------------------------------------------------
create table if not exists public.employee_contracts (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees (id) on delete cascade,
  contract_type  text not null default 'vollzeit',   -- vollzeit|teilzeit|minijob|freelance|ausbildung
  start_date     date,
  end_date       date,                               -- NULL = unbefristet
  weekly_hours   numeric,
  salary_monthly numeric,
  hourly_rate    numeric,
  vacation_days  int,                                -- abweichender Anspruch (optional)
  notes          text,
  file_path      text,                               -- Vertrags-PDF (Bucket hr-files)
  status         text not null default 'aktiv',      -- aktiv|pausiert|beendet
  created_by     uuid references public.employees (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists employee_contracts_employee_idx on public.employee_contracts (employee_id);

alter table public.employee_contracts enable row level security;
drop policy if exists "ec_select" on public.employee_contracts;
create policy "ec_select" on public.employee_contracts for select
  using (public.is_admin() or employee_id = public.current_employee_id());
drop policy if exists "ec_insert" on public.employee_contracts;
create policy "ec_insert" on public.employee_contracts for insert with check (public.is_admin());
drop policy if exists "ec_update" on public.employee_contracts;
create policy "ec_update" on public.employee_contracts for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ec_delete" on public.employee_contracts;
create policy "ec_delete" on public.employee_contracts for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Urlaub / Abwesenheiten
-- ---------------------------------------------------------------------------
create table if not exists public.employee_absences (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  absence_type  text not null default 'urlaub',      -- urlaub|krank|fortbildung|unbezahlt|sonstiges
  start_date    date not null,
  end_date      date not null,
  days          numeric not null default 0,          -- angerechnete (Arbeits-)Tage
  status        text not null default 'pending',     -- pending|approved|rejected|cancelled
  notes         text,
  requested_by  uuid references public.employees (id) on delete set null,
  approved_by   uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists employee_absences_employee_idx on public.employee_absences (employee_id);
create index if not exists employee_absences_dates_idx on public.employee_absences (start_date, end_date);

alter table public.employee_absences enable row level security;
-- Lesen: Admin alles; Mitarbeiter eigene.
drop policy if exists "ea_select" on public.employee_absences;
create policy "ea_select" on public.employee_absences for select
  using (public.is_admin() or employee_id = public.current_employee_id());
-- Anlegen: Admin für jeden; Mitarbeiter nur für sich (Antrag).
drop policy if exists "ea_insert" on public.employee_absences;
create policy "ea_insert" on public.employee_absences for insert
  with check (public.is_admin() or employee_id = public.current_employee_id());
-- Ändern: Admin alles; Mitarbeiter nur eigene, solange pending.
drop policy if exists "ea_update" on public.employee_absences;
create policy "ea_update" on public.employee_absences for update
  using (public.is_admin() or (employee_id = public.current_employee_id() and status = 'pending'))
  with check (public.is_admin() or (employee_id = public.current_employee_id()));
drop policy if exists "ea_delete" on public.employee_absences;
create policy "ea_delete" on public.employee_absences for delete
  using (public.is_admin() or (employee_id = public.current_employee_id() and status = 'pending'));
