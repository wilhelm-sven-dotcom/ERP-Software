-- ============================================================================
-- ip³ PV-Tool — Datei-Volltext + Beleg-Metadaten
-- (1) `text_content`: extrahierter PDF-Text wird gespeichert, damit Dateien
--     intelligent nach Inhalt durchsucht werden können (globale Suche + KI).
-- (2) `doc_meta`: KI-interpretierte Beleg-Felder (Lieferant, Rechnungsnummer,
--     Datum, Fälligkeit, Betrag …) für eingezogene Dokumente/Rechnungen.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

-- Volltext für die durchsuchbaren Datei-Tabellen
alter table public.project_files       add column if not exists text_content text;
alter table public.product_assets      add column if not exists text_content text;
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
