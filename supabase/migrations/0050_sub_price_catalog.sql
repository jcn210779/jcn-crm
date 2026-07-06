-- =============================================================================
-- CRM JCN — Migration 0050 — Catálogo de preços de subcontratos
-- =============================================================================
-- Data: 2026-07-06
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE — pode rodar várias vezes sem quebrar.
--
-- Objetivo:
--   Tabela de referência interna do quanto DEVE custar cada serviço de sub.
--   José consulta antes de aceitar proposta pra bater "esse cara ta cobrando
--   caro?" e não pagar acima. Range min-max por unidade ($/sqft, $/dia, etc).
--
-- Escopo:
--   - Enum price_unit: sqft, linear_ft, day, hour, flat, each
--   - sub_price_catalog: 1 row por serviço (nome, categoria, range, notas)
--   - sub_price_catalog_share: 1 row singleton com token UUID pra link público
--   - RLS owner-only nas duas
--
-- Link público:
--   /precos-publico/[token] read-only pro time interno ou parceiros.
--   Padrão idêntico ao /deposito/[token] (mig 0046) e /projeto/[token].
-- =============================================================================

-- =============================================================================
-- Enum price_unit
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'price_unit') THEN
    CREATE TYPE price_unit AS ENUM (
      'sqft',       -- $/sqft (siding, drywall, piso)
      'linear_ft',  -- $/pé linear (framing, deck rail)
      'day',        -- $/dia (mão-de-obra)
      'hour',       -- $/hora
      'flat',       -- $ total (job fechado)
      'each'        -- $/unidade (janela, porta, luminária)
    );
  END IF;
END$$;

-- =============================================================================
-- Tabela sub_price_catalog
-- =============================================================================
CREATE TABLE IF NOT EXISTS sub_price_catalog (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  category        text NOT NULL,               -- livre pra permitir "Especial" etc, com autocomplete na UI
  service_name    text NOT NULL,               -- ex "Demolição interior residencial"
  description     text,                        -- o que inclui / não inclui

  unit            price_unit NOT NULL DEFAULT 'flat',
  price_min       numeric(12,2) NOT NULL CHECK (price_min >= 0),
  price_max       numeric(12,2) NOT NULL CHECK (price_max >= price_min),

  notes           text,
  display_order   integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_sub_price_catalog_category
  ON sub_price_catalog(category, display_order);

CREATE INDEX IF NOT EXISTS idx_sub_price_catalog_active
  ON sub_price_catalog(is_active) WHERE is_active = true;

COMMENT ON TABLE sub_price_catalog IS
  'Referência interna do preço justo de cada serviço de sub. Consultado antes de aceitar proposta.';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_sub_price_catalog_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sub_price_catalog_touch ON sub_price_catalog;
CREATE TRIGGER trg_sub_price_catalog_touch
  BEFORE UPDATE ON sub_price_catalog
  FOR EACH ROW EXECUTE FUNCTION fn_sub_price_catalog_touch();

-- =============================================================================
-- Tabela sub_price_catalog_share (token pra link público)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sub_price_catalog_share (
  id            boolean PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  token         uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  rotated_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);
INSERT INTO sub_price_catalog_share (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- RLS owner-only
-- =============================================================================
ALTER TABLE sub_price_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_price_catalog_share ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_sub_price_catalog_owner_only ON sub_price_catalog;
CREATE POLICY p_sub_price_catalog_owner_only ON sub_price_catalog FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

DROP POLICY IF EXISTS p_sub_price_catalog_share_owner_only ON sub_price_catalog_share;
CREATE POLICY p_sub_price_catalog_share_owner_only ON sub_price_catalog_share FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- Validação
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM sub_price_catalog) AS total_prices,
  (SELECT token FROM sub_price_catalog_share) AS share_token;
