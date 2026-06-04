-- ============================================================================
-- ip³ PV-Tool — Mitarbeiter-Skills/Qualifikationen (für die smarte Plantafel)
-- skills: Liste von Schlagwörtern (z. B. ["Dachmontage","Elektrik","Speicher"]).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.employees add column if not exists skills jsonb;
