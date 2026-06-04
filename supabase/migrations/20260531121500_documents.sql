-- ============================================================================
-- ip³ PV-Tool — Folgedokumente: Auftragsbestätigung (AB) & Lieferschein
-- Eine generische documents-Tabelle (kind) für die Kette
-- Angebot → AB → Lieferschein. Eingefrorene Positionen/Summen.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.documents (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  kind                text not null,            -- 'auftragsbestaetigung' | 'lieferschein'
  doc_number          int,
  source_offer_id     uuid references public.offers (id) on delete set null,
  source_document_id  uuid references public.documents (id) on delete set null,
  status              text not null default 'Entwurf',
  title               text,
  positions           jsonb not null default '[]'::jsonb,
  totals              jsonb not null default '{}'::jsonb,
  meta                jsonb not null default '{}'::jsonb,
  commission          text,
  created_by          uuid references public.employees (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists documents_project_idx on public.documents (project_id);
create index if not exists documents_kind_idx on public.documents (kind, doc_number);

alter table public.documents enable row level security;

drop policy if exists "documents_select" on public.documents;
create policy "documents_select" on public.documents for select using (public.is_staff());
drop policy if exists "documents_insert" on public.documents;
create policy "documents_insert" on public.documents for insert with check (public.is_staff());
drop policy if exists "documents_update" on public.documents;
create policy "documents_update" on public.documents for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "documents_delete" on public.documents;
create policy "documents_delete" on public.documents for delete using (public.is_admin());
