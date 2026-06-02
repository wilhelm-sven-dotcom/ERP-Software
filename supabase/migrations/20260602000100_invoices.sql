-- ============================================================================
-- ip³ PV-Tool — Rechnungen & Abschlagsrechnungen (Paket 11)
-- Erweitert die generische `documents`-Tabelle um Rechnungs-Felder. Eine
-- Rechnung ist ein document mit kind='rechnung' (Typ in meta.invoice_type:
-- 'voll' | 'abschlag' | 'schluss'). Eigener Nummernkreis via nextDocNumber().
-- Firmen-Zahlungsdaten (IBAN/Steuernr.) liegen im settings-Key 'company' (JSONB).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.documents add column if not exists invoice_date date;
alter table public.documents add column if not exists due_date date;
alter table public.documents add column if not exists paid_at timestamptz;
alter table public.documents add column if not exists payment_status text; -- offen|teilbezahlt|bezahlt
alter table public.documents add column if not exists paid_amount numeric;
alter table public.documents add column if not exists percentage numeric;   -- Abschlag in %

create index if not exists documents_kind_status_idx
  on public.documents (kind, payment_status, due_date);

-- kind erlaubt zusätzlich 'rechnung' (Spalte ist text ohne CHECK).
-- RLS/Audit der documents-Tabelle gelten unverändert weiter.
