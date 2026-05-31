-- ============================================================================
-- ip³ PV-Tool — Seed / Standard-Daten
-- Idempotent (on conflict do nothing). Wird nach den Migrationen ausgeführt.
-- Echte Daten kommen über scripts/import-legacy.ts.
-- ============================================================================

insert into public.settings (key, value) values
  ('company', jsonb_build_object(
     'name', 'ip³ Energietechnik',
     'street', '',
     'zip', '',
     'city', '',
     'phone', '',
     'email', '',
     'logo_url', null
   )),
  ('defaults', jsonb_build_object(
     'vat_percent', 19
   ))
on conflict (key) do nothing;
