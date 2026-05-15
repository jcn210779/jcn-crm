-- Migration 0007 — tabela ad_spend pra Fase 5.1 (entrada manual de gasto mensal por fonte)
-- Aplicada em: 2026-05-15
--
-- Reusa o enum lead_source (mesmo da tabela leads) pra garantir consistência:
-- todo gasto registrado aqui mapeia 1:1 com a origem de lead que vai aparecer
-- no kanban. Assim, dashboard cruza spend × leads × jobs por source sem
-- precisar de tabela de mapeamento.

CREATE TABLE ad_spend (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Mês no formato YYYY-MM-01 (sempre dia 1 pra agrupar)
  month        date NOT NULL,
  source       lead_source NOT NULL,
  amount       numeric(10,2) NOT NULL CHECK (amount >= 0),
  notes        text,

  -- 1 entrada por mês × fonte (UPSERT-friendly via ON CONFLICT)
  UNIQUE (month, source)
);

CREATE INDEX idx_ad_spend_month ON ad_spend(month DESC);

-- Trigger updated_at automático
CREATE OR REPLACE FUNCTION fn_ad_spend_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ad_spend_set_updated_at ON ad_spend;
CREATE TRIGGER trg_ad_spend_set_updated_at
  BEFORE UPDATE ON ad_spend
  FOR EACH ROW
  EXECUTE FUNCTION fn_ad_spend_set_updated_at();

-- RLS owner-only (mesmo padrão das demais tabelas — só info@jcnconstructioninc.com)
ALTER TABLE ad_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ad_spend_owner_only ON ad_spend;
CREATE POLICY p_ad_spend_owner_only ON ad_spend FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- View útil: spend agregado por mês × fonte (legível pra debug no SQL Editor)
CREATE OR REPLACE VIEW v_ad_spend_by_month AS
SELECT
  to_char(month, 'YYYY-MM') AS month_label,
  month,
  source,
  amount
FROM ad_spend
ORDER BY month DESC, source;

-- Validação final
SELECT * FROM ad_spend LIMIT 5;
