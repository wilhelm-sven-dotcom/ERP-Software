-- ============================================================================
-- ip³ PV-Tool — Großhändler (wholesalers) + Produkt-Verknüpfung
-- Pro Produkt mehrere Großhändler mit Bestellnummer und (optionalem) EK-Preis.
-- Im Supabase SQL-Editor einmal ausführen. Idempotent.
-- ============================================================================

create table if not exists public.wholesalers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  contact     text,
  email       text,
  phone       text,
  notes       text,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.product_wholesalers (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  wholesaler_id  uuid not null references public.wholesalers (id) on delete cascade,
  order_number   text,
  price_purchase numeric,
  created_at     timestamptz not null default now()
);
create index if not exists product_wholesalers_product_idx
  on public.product_wholesalers (product_id);

alter table public.wholesalers          enable row level security;
alter table public.product_wholesalers  enable row level security;

-- Personal darf lesen/anlegen/ändern; löschen = Admin (analog products).
do $$
declare t text;
begin
  foreach t in array array['wholesalers', 'product_wholesalers']
  loop
    execute format($f$
      drop policy if exists "%1$s_select" on public.%1$I;
      create policy "%1$s_select" on public.%1$I for select using (public.is_staff());
      drop policy if exists "%1$s_insert" on public.%1$I;
      create policy "%1$s_insert" on public.%1$I for insert with check (public.is_staff());
      drop policy if exists "%1$s_update" on public.%1$I;
      create policy "%1$s_update" on public.%1$I for update using (public.is_staff()) with check (public.is_staff());
      drop policy if exists "%1$s_delete" on public.%1$I;
      create policy "%1$s_delete" on public.%1$I for delete using (public.is_admin());
    $f$, t);
  end loop;
end $$;
