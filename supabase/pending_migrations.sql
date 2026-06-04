-- ============================================================================
-- ip³ PV-Tool — NOCH EINZUSPIELENDE MIGRATIONEN (Stand: KI-/Feature-Ausbau)
-- ----------------------------------------------------------------------------
-- Diese Datei bündelt die 7 neuesten Migrationen in chronologischer Reihenfolge.
-- Alle Blöcke sind IDEMPOTENT (if not exists / drop policy if exists) und können
-- gefahrlos auch mehrfach ausgeführt werden.
--
-- ANWENDUNG:  Supabase → SQL Editor → kompletten Inhalt einfügen → "Run".
--
-- Enthalten (in dieser Reihenfolge):
--   1) 20260603000100_file_text.sql          — Datei-Volltext + Beleg-Metadaten
--   2) 20260604000100_ai_conversations.sql   — KI-Gesprächsverlauf
--   3) 20260605000100_embeddings.sql         — Semantische Suche (pgvector)
--   4) 20260606000100_hr.sql                 — Personal/HR (Stammdaten, Verträge, Urlaub)
--   5) 20260607000100_sitelog_photos.sql     — Bautagebuch-Fotos
--   6) 20260607000200_employee_skills.sql    — Mitarbeiter-Skills
--   7) 20260608000100_incoming_invoices.sql  — Eingangsrechnungen
--
-- AUSSERDEM beim Nutzer nötig (kein SQL): Storage-Bucket `hr-files` anlegen
-- (für Vertrags-PDFs, analog `project-files`). OPENAI_API_KEY ist bereits gesetzt.
-- ============================================================================


-- ============================================================================
-- 1) 20260603000100_file_text.sql — Datei-Volltext + Beleg-Metadaten
-- ============================================================================

-- Volltext für die durchsuchbaren Datei-Tabellen
alter table public.project_files        add column if not exists text_content text;
alter table public.product_assets       add column if not exists text_content text;
alter table public.service_ticket_files add column if not exists text_content text;

-- Beleg-/Dokument-Metadaten (nur Projekt-Dateien — dort landen Rechnungen)
alter table public.project_files add column if not exists doc_meta jsonb;

-- Volltext-Indizes (deutsch) für schnelle Inhaltssuche
create index if not exists project_files_text_idx
  on public.project_files using gin (to_tsvector('german', coalesce(text_content, '')));
create index if not exists product_assets_text_idx
  on public.product_assets using gin (to_tsvector('german', coalesce(text_content, '')));
create index if not exists service_ticket_files_text_idx
  on public.service_ticket_files using gin (to_tsvector('german', coalesce(text_content, '')));


-- ============================================================================
-- 2) 20260604000100_ai_conversations.sql — KI-Gesprächsverlauf (Persistenz)
-- ============================================================================

create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_conversations_employee_idx
  on public.ai_conversations (employee_id, updated_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role            text not null,                 -- 'user' | 'assistant'
  content         text not null,
  created_at      timestamptz not null default now()
);
create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Gespräche: nur Eigentümer (Mitarbeiter)
drop policy if exists "aic_select" on public.ai_conversations;
create policy "aic_select" on public.ai_conversations for select
  using (employee_id = public.current_employee_id());
drop policy if exists "aic_insert" on public.ai_conversations;
create policy "aic_insert" on public.ai_conversations for insert
  with check (employee_id = public.current_employee_id());
drop policy if exists "aic_update" on public.ai_conversations;
create policy "aic_update" on public.ai_conversations for update
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());
drop policy if exists "aic_delete" on public.ai_conversations;
create policy "aic_delete" on public.ai_conversations for delete
  using (employee_id = public.current_employee_id());

-- Nachrichten: über Konversations-Besitz abgesichert
drop policy if exists "aim_select" on public.ai_messages;
create policy "aim_select" on public.ai_messages for select
  using (exists (select 1 from public.ai_conversations c
    where c.id = conversation_id and c.employee_id = public.current_employee_id()));
drop policy if exists "aim_insert" on public.ai_messages;
create policy "aim_insert" on public.ai_messages for insert
  with check (exists (select 1 from public.ai_conversations c
    where c.id = conversation_id and c.employee_id = public.current_employee_id()));
drop policy if exists "aim_delete" on public.ai_messages;
create policy "aim_delete" on public.ai_messages for delete
  using (exists (select 1 from public.ai_conversations c
    where c.id = conversation_id and c.employee_id = public.current_employee_id()));


-- ============================================================================
-- 3) 20260605000100_embeddings.sql — Semantische Dokumentsuche (pgvector)
--    HINWEIS: Erfordert die Extension `vector` (in Supabase verfügbar).
-- ============================================================================

create extension if not exists vector;

alter table public.project_files        add column if not exists embedding vector(1536);
alter table public.product_assets       add column if not exists embedding vector(1536);
alter table public.service_ticket_files add column if not exists embedding vector(1536);

create index if not exists project_files_embedding_idx
  on public.project_files using hnsw (embedding vector_cosine_ops);
create index if not exists product_assets_embedding_idx
  on public.product_assets using hnsw (embedding vector_cosine_ops);
create index if not exists service_ticket_files_embedding_idx
  on public.service_ticket_files using hnsw (embedding vector_cosine_ops);

-- Ähnlichkeitssuche über alle Datei-Quellen. SECURITY INVOKER (Default) →
-- RLS der zugrunde liegenden Tabellen gilt für den aufrufenden Nutzer.
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (source text, name text, owner text, content text, similarity float)
language sql
stable
as $$
  with hits as (
    select 'Projekt'::text as source, pf.name,
           coalesce(p.title, 'Projekt') as owner,
           left(coalesce(pf.text_content, ''), 600) as content,
           1 - (pf.embedding <=> query_embedding) as similarity
    from public.project_files pf
    left join public.projects p on p.id = pf.project_id
    where pf.embedding is not null
    union all
    select 'Produkt'::text, pa.name,
           coalesce(pr.name, 'Produkt'),
           left(coalesce(pa.text_content, ''), 600),
           1 - (pa.embedding <=> query_embedding)
    from public.product_assets pa
    left join public.products pr on pr.id = pa.product_id
    where pa.embedding is not null
    union all
    select 'Service'::text, sf.name,
           coalesce(t.title, 'Ticket'),
           left(coalesce(sf.text_content, ''), 600),
           1 - (sf.embedding <=> query_embedding)
    from public.service_ticket_files sf
    left join public.service_tickets t on t.id = sf.ticket_id
    where sf.embedding is not null
  )
  select * from hits order by similarity desc limit match_count;
$$;


-- ============================================================================
-- 4) 20260606000100_hr.sql — Personal/HR: Stammdaten, Verträge, Urlaub
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

-- --- Arbeitsverträge ---------------------------------------------------------
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

-- --- Urlaub / Abwesenheiten --------------------------------------------------
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
drop policy if exists "ea_select" on public.employee_absences;
create policy "ea_select" on public.employee_absences for select
  using (public.is_admin() or employee_id = public.current_employee_id());
drop policy if exists "ea_insert" on public.employee_absences;
create policy "ea_insert" on public.employee_absences for insert
  with check (public.is_admin() or employee_id = public.current_employee_id());
drop policy if exists "ea_update" on public.employee_absences;
create policy "ea_update" on public.employee_absences for update
  using (public.is_admin() or (employee_id = public.current_employee_id() and status = 'pending'))
  with check (public.is_admin() or (employee_id = public.current_employee_id()));
drop policy if exists "ea_delete" on public.employee_absences;
create policy "ea_delete" on public.employee_absences for delete
  using (public.is_admin() or (employee_id = public.current_employee_id() and status = 'pending'));


-- ============================================================================
-- 5) 20260607000100_sitelog_photos.sql — Bautagebuch: Foto-Verknüpfung
-- ============================================================================

alter table public.site_log add column if not exists photo_ids jsonb;
alter table public.site_log add column if not exists ai_generated boolean not null default false;


-- ============================================================================
-- 6) 20260607000200_employee_skills.sql — Mitarbeiter-Skills/Qualifikationen
-- ============================================================================

alter table public.employees add column if not exists skills jsonb;


-- ============================================================================
-- 7) 20260608000100_incoming_invoices.sql — Eingangsrechnungen
-- ============================================================================

create table if not exists public.incoming_invoices (
  id              uuid primary key default gen_random_uuid(),
  supplier        text,
  invoice_number  text,
  invoice_date    date,
  due_date        date,
  amount          numeric,
  currency        text not null default 'EUR',
  project_id      uuid references public.projects (id) on delete set null,
  source_file_id  uuid references public.project_files (id) on delete set null,
  status          text not null default 'offen',   -- offen | bezahlt
  paid_at         timestamptz,
  notes           text,
  created_by      uuid references public.employees (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists incoming_invoices_status_idx on public.incoming_invoices (status, due_date);
create index if not exists incoming_invoices_file_idx on public.incoming_invoices (source_file_id);

alter table public.incoming_invoices enable row level security;
drop policy if exists "ii_select" on public.incoming_invoices;
create policy "ii_select" on public.incoming_invoices for select using (public.is_staff());
drop policy if exists "ii_insert" on public.incoming_invoices;
create policy "ii_insert" on public.incoming_invoices for insert with check (public.is_staff());
drop policy if exists "ii_update" on public.incoming_invoices;
create policy "ii_update" on public.incoming_invoices for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "ii_delete" on public.incoming_invoices;
create policy "ii_delete" on public.incoming_invoices for delete
  using (public.is_admin() or created_by = public.current_employee_id());

-- ============================================================================
-- FERTIG. Danach noch (einmalig, kein SQL): Storage-Bucket `hr-files` anlegen.
-- ============================================================================
