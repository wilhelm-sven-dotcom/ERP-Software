-- ============================================================================
-- ip³ PV-Tool — Zeiterfassung (Stunden je Projekt) + Stundensätze
-- Basis für die Nachkalkulation (Plan/Ist je Projekt). Optionaler Import aus
-- Altsoftware via source='import' + external_id (Dedupe).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.employees add column if not exists cost_rate numeric;

create table if not exists public.time_entries (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects (id) on delete cascade,
  employee_id           uuid references public.employees (id) on delete set null,
  work_date             date not null default current_date,
  hours                 numeric not null default 0,
  activity              text,
  description           text,
  hourly_rate           numeric,                 -- optional übersteuert den Mitarbeitersatz
  source                text not null default 'manual',  -- 'manual' | 'import'
  external_id           text,
  created_by            uuid references public.employees (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists time_entries_project_idx on public.time_entries (project_id);
create index if not exists time_entries_employee_idx on public.time_entries (employee_id, work_date);
-- Import-Dedupe: gleiche externe ID nicht doppelt importieren.
create unique index if not exists time_entries_external_uidx
  on public.time_entries (source, external_id)
  where external_id is not null;

alter table public.time_entries enable row level security;

drop policy if exists "te_select" on public.time_entries;
create policy "te_select" on public.time_entries for select using (public.is_staff());
drop policy if exists "te_insert" on public.time_entries;
create policy "te_insert" on public.time_entries for insert with check (public.is_staff());
-- Mitarbeiter ändern eigene Einträge; Admin alles.
drop policy if exists "te_update" on public.time_entries;
create policy "te_update" on public.time_entries for update
  using (public.is_admin() or employee_id = public.current_employee_id())
  with check (public.is_admin() or employee_id = public.current_employee_id());
drop policy if exists "te_delete" on public.time_entries;
create policy "te_delete" on public.time_entries for delete
  using (public.is_admin() or employee_id = public.current_employee_id());
