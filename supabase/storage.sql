-- ============================================================================
-- ip³ PV-Tool — Storage-Setup für Produkt-Medien (Bilder + Datenblätter)
-- Im Supabase SQL Editor EINMAL ausführen.
-- Legt den Bucket `product-assets` an und setzt RLS-Policies auf storage.objects.
-- ============================================================================

-- Bucket anlegen (idempotent). public=true → Bilder/Datenblätter per URL ladbar.
insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', true)
on conflict (id) do nothing;

-- Lesen: alle angemeldeten Nutzer
drop policy if exists "product_assets_read" on storage.objects;
create policy "product_assets_read" on storage.objects
  for select using (
    bucket_id = 'product-assets' and public.is_staff()
  );

-- Hochladen: Personal (admin/mitarbeiter)
drop policy if exists "product_assets_insert" on storage.objects;
create policy "product_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'product-assets' and public.is_staff()
  );

-- Aktualisieren: Personal
drop policy if exists "product_assets_update" on storage.objects;
create policy "product_assets_update" on storage.objects
  for update using (
    bucket_id = 'product-assets' and public.is_staff()
  ) with check (
    bucket_id = 'product-assets' and public.is_staff()
  );

-- Löschen: nur Admin
drop policy if exists "product_assets_delete" on storage.objects;
create policy "product_assets_delete" on storage.objects
  for delete using (
    bucket_id = 'product-assets' and public.is_admin()
  );

-- ============================================================================
-- Projekt-Dateien (Datenblätter/Handbücher/Pläne je Projekt) — UX-Paket 7/F
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', true)
on conflict (id) do nothing;

drop policy if exists "project_files_read" on storage.objects;
create policy "project_files_read" on storage.objects
  for select using (bucket_id = 'project-files' and public.is_staff());

drop policy if exists "project_files_insert" on storage.objects;
create policy "project_files_insert" on storage.objects
  for insert with check (bucket_id = 'project-files' and public.is_staff());

drop policy if exists "project_files_delete" on storage.objects;
create policy "project_files_delete" on storage.objects
  for delete using (bucket_id = 'project-files' and public.is_staff());

-- ============================================================================
-- Service-Dateien (Fotos/Anhänge je Service-Ticket) — Paket Service-Board
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('service-files', 'service-files', true)
on conflict (id) do nothing;

drop policy if exists "service_files_read" on storage.objects;
create policy "service_files_read" on storage.objects
  for select using (bucket_id = 'service-files' and public.is_staff());

drop policy if exists "service_files_insert" on storage.objects;
create policy "service_files_insert" on storage.objects
  for insert with check (bucket_id = 'service-files' and public.is_staff());

drop policy if exists "service_files_delete" on storage.objects;
create policy "service_files_delete" on storage.objects
  for delete using (bucket_id = 'service-files' and public.is_staff());
