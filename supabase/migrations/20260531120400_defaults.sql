-- ============================================================================
-- ip³ PV-Tool — Spalten-Defaults (Phase 3)
-- created_by/employee_id automatisch auf den aktuellen Mitarbeiter setzen.
-- So greift die RLS-Regel "eigene Datensätze" ohne Zutun des Clients.
-- (Beim Import via Service-Role ist current_employee_id() = NULL → dort wird
--  created_by ohnehin explizit gesetzt.)
-- ============================================================================

alter table public.customers
  alter column created_by set default public.current_employee_id();
alter table public.projects
  alter column created_by set default public.current_employee_id();
alter table public.products
  alter column created_by set default public.current_employee_id();
alter table public.offer_templates
  alter column created_by set default public.current_employee_id();
alter table public.calc_templates
  alter column created_by set default public.current_employee_id();
alter table public.calculations
  alter column created_by set default public.current_employee_id();
alter table public.activities
  alter column employee_id set default public.current_employee_id();
