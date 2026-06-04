-- ============================================================================
-- ip³ PV-Tool — Projekt-Dateien (Datenblätter, Handbücher, Pläne, Fotos)
-- Dateien werden per Drag & Drop einem Projekt zugeordnet. Datei-Inhalt liegt
-- im Storage-Bucket `project-files` (siehe supabase/storage.sql), Metadaten hier.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.project_files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  name          text not null,
  storage_path  text not null,
  mime          text,
  kind          text not null default 'dokument',
  size          bigint,
  uploaded_by   uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists project_files_project_idx on public.project_files (project_id);

alter table public.project_files enable row level security;

drop policy if exists "pf_select" on public.project_files;
create policy "pf_select" on public.project_files for select using (public.is_staff());
drop policy if exists "pf_insert" on public.project_files;
create policy "pf_insert" on public.project_files for insert with check (public.is_staff());
drop policy if exists "pf_delete" on public.project_files;
create policy "pf_delete" on public.project_files for delete
  using (public.is_admin() or uploaded_by = public.current_employee_id());
