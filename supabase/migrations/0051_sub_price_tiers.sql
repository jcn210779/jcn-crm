-- =============================================================================
-- CRM JCN — Migration 0051 — Tiers de preço por tipo de imóvel
-- =============================================================================
-- Data: 2026-07-06
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE.
--
-- Motivo:
--   Serviços têm variações de preço por tipo de imóvel (1 família, 2 famílias,
--   3 famílias, cottage, condo). José quer definir esses tiers dentro do
--   mesmo serviço em vez de criar N cadastros.
--
-- Solução:
--   Coluna JSONB tiers em sub_price_catalog. Formato:
--     [{ "label": "1 família", "price": 1000 }, ...]
--   Se null ou array vazio, UI usa o range price_min/price_max normal.
--   Se tem tiers, UI exibe os tiers em vez do range.
-- =============================================================================

ALTER TABLE sub_price_catalog
  ADD COLUMN IF NOT EXISTS tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN sub_price_catalog.tiers IS
  'Variações de preço por tipo de imóvel. Formato: [{"label":"1 família","price":1000}]. Array vazio = usa range price_min/price_max.';

-- Validação
SELECT
  COUNT(*) AS total_prices,
  COUNT(*) FILTER (WHERE jsonb_array_length(tiers) > 0) AS with_tiers
FROM sub_price_catalog;
