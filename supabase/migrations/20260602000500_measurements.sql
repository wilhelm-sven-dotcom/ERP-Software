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
