-- ============================================================================
-- ip³ PV-Tool — Kalkulations-Varianten
-- Mehrere benannte Kalkulationen je Projekt; eine ist „ausgewählt". Die
-- berechnete Anlagen-/Speichergröße wird je Variante mitgespeichert.
-- Im Supabase SQL-Editor einmal ausführen. Idempotent.
-- ============================================================================

alter table public.calculations add column if not exists name text;
alter table public.calculations
  add column if not exists is_selected boolean not null default false;
alter table public.calculations add column if not exists system_size_kwp numeric;
alter table public.calculations add column if not exists storage_kwh numeric;

-- Bestehende Kalkulationen benennen, damit die Liste nicht leer wirkt.
update public.calculations set name = 'Standard' where name is null;
