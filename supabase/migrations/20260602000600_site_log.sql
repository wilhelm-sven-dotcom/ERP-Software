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
