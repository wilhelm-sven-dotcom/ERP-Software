-- ============================================================================
-- ip³ PV-Tool — Ad-hoc-Aufgaben ohne Projekt (Schnell-Rückfrage am Dashboard)
-- project_tasks.project_id darf jetzt NULL sein (projektlose Aufgaben/Rückfragen).
-- Die bestehende FK (on delete cascade) bleibt für projektbezogene Aufgaben gültig.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.project_tasks alter column project_id drop not null;
