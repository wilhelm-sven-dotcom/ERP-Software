-- ============================================================================
-- ip³ PV-Tool — Kollaborativer Projektablauf (UX-Paket 7)
-- Erweitert Aufgaben um Anbieten/Annehmen (Claim), einen Messenger-Thread je
-- Vorgang, Gelesen-Stände und Live-Updates (Realtime).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

-- project_tasks erweitern: Status 'angeboten' (Logik), parallele Bündelung.
alter table public.project_tasks add column if not exists group_label text;
-- (status bleibt text: 'offen' | 'angeboten' | 'erledigt')

-- Kandidaten: Mitarbeiter, denen eine Aufgabe angeboten wurde (Claim-Menge).
create table if not exists public.task_candidates (
  task_id      uuid not null references public.project_tasks (id) on delete cascade,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (task_id, employee_id)
);
create index if not exists task_candidates_emp_idx on public.task_candidates (employee_id);

-- Messenger-Thread je Aufgabe (Chat + System-Ereigniszeilen).
create table if not exists public.task_messages (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references public.project_tasks (id) on delete cascade,
  author_employee_id  uuid references public.employees (id) on delete set null,
  body                text not null,
  kind                text not null default 'message',  -- 'message' | 'event'
  created_at          timestamptz not null default now()
);
create index if not exists task_messages_task_idx on public.task_messages (task_id, created_at);

-- Gelesen-Stand je Mitarbeiter (für Ungelesen-Zähler).
create table if not exists public.task_reads (
  task_id       uuid not null references public.project_tasks (id) on delete cascade,
  employee_id   uuid not null references public.employees (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (task_id, employee_id)
);

alter table public.task_candidates enable row level security;
alter table public.task_messages enable row level security;
alter table public.task_reads enable row level security;

-- Kandidaten: Personal liest/verwaltet (Anbieten/Claim).
drop policy if exists "tc_select" on public.task_candidates;
create policy "tc_select" on public.task_candidates for select using (public.is_staff());
drop policy if exists "tc_write" on public.task_candidates;
create policy "tc_write" on public.task_candidates for all using (public.is_staff()) with check (public.is_staff());

-- Nachrichten: Personal liest alle; schreibt als sich selbst; Löschen Admin/Autor.
drop policy if exists "tm_select" on public.task_messages;
create policy "tm_select" on public.task_messages for select using (public.is_staff());
drop policy if exists "tm_insert" on public.task_messages;
create policy "tm_insert" on public.task_messages for insert with check (public.is_staff());
drop policy if exists "tm_delete" on public.task_messages;
create policy "tm_delete" on public.task_messages for delete
  using (public.is_admin() or author_employee_id = public.current_employee_id());

-- Gelesen-Stände: nur eigene Zeilen.
drop policy if exists "tr_select" on public.task_reads;
create policy "tr_select" on public.task_reads for select
  using (public.is_admin() or employee_id = public.current_employee_id());
drop policy if exists "tr_write" on public.task_reads;
create policy "tr_write" on public.task_reads for all
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

-- Realtime für die Live-Aktualisierung aktivieren (idempotent).
do $$
begin
  begin
    alter publication supabase_realtime add table public.task_messages;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.task_candidates;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.project_tasks;
  exception when duplicate_object then null; end;
end $$;
