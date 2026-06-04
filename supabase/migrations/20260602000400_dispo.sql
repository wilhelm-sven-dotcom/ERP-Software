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
