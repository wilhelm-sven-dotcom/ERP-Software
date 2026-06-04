-- ============================================================================
-- ip³ PV-Tool — Eingangsrechnung: Datei-Referenz
-- Speichert den Pfad der abgelegten Beleg-PDF (Bucket `entity-documents`),
-- damit die Rechnung direkt aus der Buchhaltung geöffnet werden kann.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.incoming_invoices add column if not exists document_path text;
alter table public.incoming_invoices add column if not exists document_name text;
