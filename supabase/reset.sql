-- ============================================================================
-- ip³ PV-Tool — RESET (nur bei frischem Projekt ohne echte Daten!)
-- Loescht das komplette public-Schema und stellt die Supabase-Standardrechte
-- wieder her. Danach supabase/setup_all.sql erneut ausfuehren.
--
-- ⚠️  ACHTUNG: Loescht ALLE Tabellen/Daten im public-Schema unwiderruflich.
--     Nur verwenden, solange noch keine echten Kundendaten drin sind.
-- ============================================================================

-- Auth-Trigger zuerst entfernen (haengt an auth.users, nicht an public)
drop trigger if exists on_auth_user_created on auth.users;

-- public-Schema komplett neu aufsetzen
drop schema if exists public cascade;
create schema public;

-- Supabase-Standardrechte wiederherstellen
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
