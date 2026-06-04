-- ============================================================================
-- ip³ PV-Tool — Entitäts-Dokumente (intelligenter Posteingang)
-- Polymorphe Ablage für Dokumente, die zu Kunde/Mitarbeiter/allgemein gehören.
-- WICHTIG: NICHT die bestehende Tabelle `documents` (= Belegkette AB/LS/Rechnung)!
-- Projekt-Dateien (project_files) und Produkt-Assets (product_assets) bleiben
-- ebenfalls in ihren eigenen Tabellen. Datei-Inhalt liegt im Storage-Bucket
-- `entity-documents`. Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.entity_documents (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,                 -- 'kunde' | 'mitarbeiter' | 'allgemein'
  entity_id     uuid,                           -- Kunde/Mitarbeiter-ID (NULL bei 'allgemein')
  name          text not null,
  storage_path  text not null,
  mime          text,
  kind          text not null default 'dokument',
  doc_meta      jsonb,                          -- KI-ausgelesene Felder (optional)
  text_content  text,                           -- Volltext für die Suche
  uploaded_by   uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists entity_documents_entity_idx on public.entity_documents (entity_type, entity_id);
create index if not exists entity_documents_text_idx
  on public.entity_documents using gin (to_tsvector('german', coalesce(text_content, '')));

alter table public.entity_documents enable row level security;

drop policy if exists "edoc_select" on public.entity_documents;
create policy "edoc_select" on public.entity_documents for select using (public.is_staff());
drop policy if exists "edoc_insert" on public.entity_documents;
create policy "edoc_insert" on public.entity_documents for insert with check (public.is_staff());
drop policy if exists "edoc_update" on public.entity_documents;
create policy "edoc_update" on public.entity_documents for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "edoc_delete" on public.entity_documents;
create policy "edoc_delete" on public.entity_documents for delete
  using (public.is_admin() or uploaded_by = public.current_employee_id());
