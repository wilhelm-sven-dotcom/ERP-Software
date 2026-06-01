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
