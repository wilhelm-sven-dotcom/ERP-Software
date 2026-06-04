-- ============================================================================
-- ip³ PV-Tool — Produktpreise auf 2 Nachkommastellen runden
-- Behebt unsaubere Werte wie 13,333333… (z. B. aus geteilten Dienstleistungen).
-- Idempotent — kann mehrfach ausgeführt werden.
-- ============================================================================

update public.products
set price_purchase = round(price_purchase::numeric, 2)
where price_purchase is not null
  and price_purchase <> round(price_purchase::numeric, 2);

update public.products
set price_sell = round(price_sell::numeric, 2)
where price_sell is not null
  and price_sell <> round(price_sell::numeric, 2);
