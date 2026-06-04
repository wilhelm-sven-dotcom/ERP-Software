-- ============================================================================
-- ip³ PV-Tool — Mahnwesen & Zahlungsstatus (Paket 12)
-- Rechnungen (documents kind='rechnung') bekommen einen Mahnstand; Mahnungen
-- sind eigene documents (kind='mahnung') mit Verweis auf die Rechnung.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.documents add column if not exists reminder_level int not null default 0;
alter table public.documents add column if not exists last_reminder_at timestamptz;

-- kind erlaubt zusätzlich 'mahnung' (Spalte ist text ohne CHECK).
