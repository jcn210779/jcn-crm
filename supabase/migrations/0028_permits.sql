-- Migration 0028 — Permits scraped (catálogo de oportunidades)
-- Aplicada em: 2026-05-22
--
-- Motivo:
--   Scraper Python (Lincoln + Concord, futuro Weston/outros) coleta building
--   permits de cidades de MA. Agora o CRM tem tabela própria pra armazenar
--   esses permits como catálogo de oportunidades.
--
-- NÃO vira lead automaticamente. José consulta a lista, decide se vale a pena,
-- e cria lead manual se quiser (com source='permit' que já existe no enum).
--
-- Idempotência: scraper pode rodar várias vezes — upsert por (source_city, external_id)
-- atualiza o registro sem duplicar.
--
-- =============================================================================

-- 1) Enum status do permit (livre, alinhado com a fonte)
DROP TYPE IF EXISTS permit_status CASCADE;
CREATE TYPE permit_status AS ENUM (
  'active',     -- ainda válido
  'expired',    -- venceu
  'completed',  -- obra completada
  'cancelled',  -- cancelado
  'unknown'     -- fonte não informou
);

-- 2) Tabela permits
CREATE TABLE IF NOT EXISTS permits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Identificação no portal da cidade (chave de upsert)
  external_id       text NOT NULL,             -- ex: "PB-2026-001234"
  source_city       text NOT NULL,             -- "Lincoln", "Concord", "Weston"
  source_url        text,                      -- link direto pro permit no portal

  permit_number     text,                      -- número exibido (pode ser igual external_id)

  -- Endereço da obra
  address           text NOT NULL,
  city              text NOT NULL,
  state             text NOT NULL DEFAULT 'MA',
  zip               text,

  -- Tipo de obra (mapeado pelo scraper, pode ser 'other')
  service_type      service_type NOT NULL DEFAULT 'other',
  service_description text,                    -- descrição livre da obra do portal

  -- Valor declarado da obra (USD)
  estimated_value   numeric(12,2),

  -- Owner (dono do imóvel/aplicante)
  owner_name        text,
  owner_phone       text,
  owner_email       text,

  -- Contractor já contratado (se houver)
  contractor_name   text,
  contractor_phone  text,

  -- Marcos temporais
  issued_at         date,                      -- data emissão do permit
  expires_at        date,                      -- data validade (se houver)

  status            permit_status NOT NULL DEFAULT 'active',

  -- Triagem manual do José
  reviewed          boolean NOT NULL DEFAULT false,
  reviewed_at       timestamptz,
  interesting       boolean,                   -- NULL = não revisado, true = quero atacar, false = descartado
  lead_id           uuid REFERENCES leads(id) ON DELETE SET NULL,

  notes             text,

  -- Payload original do scraper pra debug
  raw_data          jsonb,

  -- Idempotência: 1 registro por (source_city, external_id)
  CONSTRAINT uniq_permit_source UNIQUE (source_city, external_id)
);

CREATE INDEX IF NOT EXISTS idx_permits_city ON permits(city);
CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);
CREATE INDEX IF NOT EXISTS idx_permits_service ON permits(service_type);
CREATE INDEX IF NOT EXISTS idx_permits_issued ON permits(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_permits_value ON permits(estimated_value DESC)
  WHERE estimated_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_permits_reviewed ON permits(reviewed)
  WHERE reviewed = false;
CREATE INDEX IF NOT EXISTS idx_permits_interesting ON permits(interesting)
  WHERE interesting = true;

-- 3) Trigger updated_at
CREATE OR REPLACE FUNCTION fn_permits_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_permits_set_updated_at ON permits;
CREATE TRIGGER trg_permits_set_updated_at
  BEFORE UPDATE ON permits
  FOR EACH ROW
  EXECUTE FUNCTION fn_permits_set_updated_at();

-- 4) RLS owner-only
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_permits_owner_only ON permits;
CREATE POLICY p_permits_owner_only ON permits FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- 5) View agregada por cidade
CREATE OR REPLACE VIEW v_permits_summary AS
SELECT
  source_city,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE reviewed = false) AS unreviewed,
  COUNT(*) FILTER (WHERE interesting = true) AS interesting_count,
  COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS converted_count,
  COALESCE(SUM(estimated_value) FILTER (WHERE estimated_value IS NOT NULL), 0) AS total_value,
  MAX(issued_at) AS latest_issued
FROM permits
GROUP BY source_city
ORDER BY latest_issued DESC NULLS LAST;

SELECT 'permits criada' AS status;
