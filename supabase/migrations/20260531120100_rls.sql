-- ============================================================================
-- ip³ PV-Tool — Row-Level-Security (Phase 2)
-- Ersetzt die alte Frontend-Logik canView/canEdit/canDelete (CLAUDE.md §6).
--
-- Grundregeln:
--   * Admin:       voller Lese-/Schreib-/Löschzugriff auf alles.
--   * Mitarbeiter: darf alles LESEN, darf ANLEGEN, darf EIGENE/ZUGEWIESENE
--                  Datensätze BEARBEITEN; KEIN Löschen.
-- Die DB ist die Wahrheit; Frontend-Checks sind nur fürs UX.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helfer-Funktionen (SECURITY DEFINER → umgehen RLS, verhindern Rekursion
-- in den employees-Policies). Rolle wird über auth.uid() aufgelöst.
-- ---------------------------------------------------------------------------
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.employees where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.employees where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$ select coalesce(public.auth_role() = 'admin', false); $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$ select coalesce(public.auth_role() in ('admin', 'mitarbeiter'), false); $$;

-- ---------------------------------------------------------------------------
-- RLS auf JEDER Tabelle aktivieren.
-- ---------------------------------------------------------------------------
alter table public.product_groups  enable row level security;
alter table public.employees       enable row level security;
alter table public.customers       enable row level security;
alter table public.projects        enable row level security;
alter table public.activities      enable row level security;
alter table public.products        enable row level security;
alter table public.product_assets  enable row level security;
alter table public.offer_templates enable row level security;
alter table public.calc_templates  enable row level security;
alter table public.calculations    enable row level security;
alter table public.settings        enable row level security;
alter table public.change_log      enable row level security;

-- ===========================================================================
-- employees: lesen = Personal; verwalten = Admin.
-- ===========================================================================
create policy "employees_select" on public.employees
  for select using (public.is_staff());
create policy "employees_admin_write" on public.employees
  for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- customers: lesen = Personal; anlegen = Personal;
--            ändern = Admin oder Ersteller; löschen = Admin.
-- ===========================================================================
create policy "customers_select" on public.customers
  for select using (public.is_staff());
create policy "customers_insert" on public.customers
  for insert with check (public.is_staff());
create policy "customers_update" on public.customers
  for update
  using (public.is_admin() or created_by = public.current_employee_id())
  with check (public.is_admin() or created_by = public.current_employee_id());
create policy "customers_delete" on public.customers
  for delete using (public.is_admin());

-- ===========================================================================
-- projects: ändern = Admin, Ersteller ODER zugewiesener Mitarbeiter.
-- ===========================================================================
create policy "projects_select" on public.projects
  for select using (public.is_staff());
create policy "projects_insert" on public.projects
  for insert with check (public.is_staff());
create policy "projects_update" on public.projects
  for update
  using (
    public.is_admin()
    or created_by = public.current_employee_id()
    or assigned_employee_id = public.current_employee_id()
  )
  with check (
    public.is_admin()
    or created_by = public.current_employee_id()
    or assigned_employee_id = public.current_employee_id()
  );
create policy "projects_delete" on public.projects
  for delete using (public.is_admin());

-- ===========================================================================
-- activities: ändern = Admin oder eigener Eintrag (employee_id).
-- ===========================================================================
create policy "activities_select" on public.activities
  for select using (public.is_staff());
create policy "activities_insert" on public.activities
  for insert with check (public.is_staff());
create policy "activities_update" on public.activities
  for update
  using (public.is_admin() or employee_id = public.current_employee_id())
  with check (public.is_admin() or employee_id = public.current_employee_id());
create policy "activities_delete" on public.activities
  for delete using (public.is_admin());

-- ===========================================================================
-- Katalog (products, product_groups, product_assets):
-- Personal darf lesen/anlegen/ändern; löschen = Admin.
-- ===========================================================================
create policy "products_select" on public.products
  for select using (public.is_staff());
create policy "products_insert" on public.products
  for insert with check (public.is_staff());
create policy "products_update" on public.products
  for update using (public.is_staff()) with check (public.is_staff());
create policy "products_delete" on public.products
  for delete using (public.is_admin());

create policy "product_groups_select" on public.product_groups
  for select using (public.is_staff());
create policy "product_groups_insert" on public.product_groups
  for insert with check (public.is_staff());
create policy "product_groups_update" on public.product_groups
  for update using (public.is_staff()) with check (public.is_staff());
create policy "product_groups_delete" on public.product_groups
  for delete using (public.is_admin());

create policy "product_assets_select" on public.product_assets
  for select using (public.is_staff());
create policy "product_assets_insert" on public.product_assets
  for insert with check (public.is_staff());
create policy "product_assets_update" on public.product_assets
  for update using (public.is_staff()) with check (public.is_staff());
create policy "product_assets_delete" on public.product_assets
  for delete using (public.is_admin());

-- ===========================================================================
-- Vorlagen & Kalkulation: ändern = Admin oder Ersteller; löschen = Admin.
-- (calculations: Ersteller; ansonsten gilt Projektzugriff über die App.)
-- ===========================================================================
create policy "offer_templates_select" on public.offer_templates
  for select using (public.is_staff());
create policy "offer_templates_insert" on public.offer_templates
  for insert with check (public.is_staff());
create policy "offer_templates_update" on public.offer_templates
  for update
  using (public.is_admin() or created_by = public.current_employee_id())
  with check (public.is_admin() or created_by = public.current_employee_id());
create policy "offer_templates_delete" on public.offer_templates
  for delete using (public.is_admin());

create policy "calc_templates_select" on public.calc_templates
  for select using (public.is_staff());
create policy "calc_templates_insert" on public.calc_templates
  for insert with check (public.is_staff());
create policy "calc_templates_update" on public.calc_templates
  for update
  using (public.is_admin() or created_by = public.current_employee_id())
  with check (public.is_admin() or created_by = public.current_employee_id());
create policy "calc_templates_delete" on public.calc_templates
  for delete using (public.is_admin());

create policy "calculations_select" on public.calculations
  for select using (public.is_staff());
create policy "calculations_insert" on public.calculations
  for insert with check (public.is_staff());
create policy "calculations_update" on public.calculations
  for update
  using (public.is_admin() or created_by = public.current_employee_id())
  with check (public.is_admin() or created_by = public.current_employee_id());
create policy "calculations_delete" on public.calculations
  for delete using (public.is_admin());

-- ===========================================================================
-- settings: lesen = Personal; schreiben = Admin.
-- ===========================================================================
create policy "settings_select" on public.settings
  for select using (public.is_staff());
create policy "settings_admin_write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- change_log: nur Admin liest. Schreiben ausschließlich per Audit-Trigger
-- (SECURITY DEFINER) — keine direkten Schreib-Policies für Clients.
-- ===========================================================================
create policy "change_log_admin_select" on public.change_log
  for select using (public.is_admin());
