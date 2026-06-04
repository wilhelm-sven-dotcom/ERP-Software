-- ============================================================================
-- ip³ PV-Tool — Service-Board (Kanban, getrennt von Wartung) — Paket 3
-- Service-Tickets mit Status-Spalten, Kommentaren und Datei-/Foto-Anhängen.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.service_tickets (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  customer_id          uuid references public.customers (id) on delete set null,
  project_id           uuid references public.projects (id) on delete set null,
  location             text,
  status               text not null default 'Eingang',
  assignee_employee_id uuid references public.employees (id) on delete set null,
  due_date             date,
  description          text,
  cover_path           text,                       -- Storage-Pfad des Titelbilds
  sort                 int not null default 0,
  source               text,                       -- z. B. 'trello'
  external_id          text,                       -- Trello-Card-ID (Dedupe)
  created_by           uuid references public.employees (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists service_tickets_status_idx on public.service_tickets (status, sort);
create unique index if not exists service_tickets_external_idx
  on public.service_tickets (source, external_id) where external_id is not null;

create table if not exists public.service_ticket_messages (
  id                  uuid primary key default gen_random_uuid(),
  ticket_id           uuid not null references public.service_tickets (id) on delete cascade,
  author_employee_id  uuid references public.employees (id) on delete set null,
  body                text not null,
  kind                text not null default 'message', -- 'message' | 'event'
  created_at          timestamptz not null default now()
);
create index if not exists service_ticket_messages_idx on public.service_ticket_messages (ticket_id, created_at);

create table if not exists public.service_ticket_files (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.service_tickets (id) on delete cascade,
  name          text not null,
  storage_path  text not null,
  mime          text,
  size          bigint,
  uploaded_by   uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists service_ticket_files_idx on public.service_ticket_files (ticket_id);

alter table public.service_tickets enable row level security;
alter table public.service_ticket_messages enable row level security;
alter table public.service_ticket_files enable row level security;

drop policy if exists "st_select" on public.service_tickets;
create policy "st_select" on public.service_tickets for select using (public.is_staff());
drop policy if exists "st_insert" on public.service_tickets;
create policy "st_insert" on public.service_tickets for insert with check (public.is_staff());
drop policy if exists "st_update" on public.service_tickets;
create policy "st_update" on public.service_tickets for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "st_delete" on public.service_tickets;
create policy "st_delete" on public.service_tickets for delete using (public.is_admin() or created_by = public.current_employee_id());

drop policy if exists "stm_select" on public.service_ticket_messages;
create policy "stm_select" on public.service_ticket_messages for select using (public.is_staff());
drop policy if exists "stm_insert" on public.service_ticket_messages;
create policy "stm_insert" on public.service_ticket_messages for insert with check (public.is_staff());
drop policy if exists "stm_delete" on public.service_ticket_messages;
create policy "stm_delete" on public.service_ticket_messages for delete
  using (public.is_admin() or author_employee_id = public.current_employee_id());

drop policy if exists "stf_select" on public.service_ticket_files;
create policy "stf_select" on public.service_ticket_files for select using (public.is_staff());
drop policy if exists "stf_insert" on public.service_ticket_files;
create policy "stf_insert" on public.service_ticket_files for insert with check (public.is_staff());
drop policy if exists "stf_delete" on public.service_ticket_files;
create policy "stf_delete" on public.service_ticket_files for delete
  using (public.is_admin() or uploaded_by = public.current_employee_id());

-- Realtime für Live-Kommentare (idempotent).
do $$
begin
  begin
    alter publication supabase_realtime add table public.service_ticket_messages;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.service_tickets;
  exception when duplicate_object then null; end;
end $$;
