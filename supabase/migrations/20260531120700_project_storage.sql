-- ============================================================================
-- ip³ PV-Tool — Projekt: Speicherkapazität + Geokoordinaten
-- Ergänzt die Tabelle projects um:
--   storage_kwh  Speicherkapazität in kWh (für spezifischen Speicherpreis €/kWh)
--   lat, lon     Geokoordinaten des Montageorts (für die Karten-Anzeige)
--
-- Dieses Skript im Supabase SQL Editor EINMAL ausführen (oder via Migration).
-- Idempotent: "if not exists".
-- ============================================================================

alter table public.projects add column if not exists storage_kwh numeric;
alter table public.projects add column if not exists lat numeric;
alter table public.projects add column if not exists lon numeric;
