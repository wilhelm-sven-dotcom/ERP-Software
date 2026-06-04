-- ============================================================================
-- ip³ PV-Tool — Projekttyp (Anlagentyp)
-- Ergänzt projects.project_type (frei, aber UI bietet PROJECT_TYPES an).
-- Basis für Angebots-Bausteine und Projektablauf-Vorlagen je Anlagentyp.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.projects add column if not exists project_type text;
