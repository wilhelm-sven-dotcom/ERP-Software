-- ============================================================================
-- ip³ PV-Tool — Produkte: Sortier-Spalte für Drag & Drop
-- Ergänzt products.sort (manuelle Reihenfolge innerhalb einer Gruppe).
-- Idempotent ("if not exists"). Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.products add column if not exists sort int not null default 0;
create index if not exists products_group_sort_idx
  on public.products (group_id, sort);
