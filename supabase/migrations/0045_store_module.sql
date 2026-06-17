-- =============================================================================
-- CRM JCN — Migration 0045 — MÓDULO DE STORE (controle de material em estoque)
-- =============================================================================
-- Data: 2026-06-17
-- Autor: Pedro
-- Motivo:
--   José precisa saber rapidamente "tenho quantos X em casa?" sem vasculhar
--   garagem. Sobra de job vira tesouro escondido — depósito precisa de tracking.
--
-- Escopo (decisão CEO):
--   - Sem custo unitário (foco em quantidade física: ter / não ter)
--   - Sem foto (descrição em texto)
--   - Completo: movimentações (entrada/saída) + reservas por job + alerta de estoque baixo
--
-- Modelo:
--   store_items        → o que tem no depósito
--   store_movements    → histórico de entradas/saídas (log + trigger atualiza qty)
--   store_reservations → reservar X tábuas pra Job Y (não some do depósito, mas
--                        quantidade "disponível" cai)
--   v_store_items_stats → agregado: reservado + disponível + low_stock
-- =============================================================================

-- 1) Tabela principal — items
CREATE TABLE IF NOT EXISTS store_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  name          text NOT NULL,
  category      text,                          -- texto livre (Wood, Hardware, Concrete...)
  quantity      numeric(10,2) NOT NULL DEFAULT 0,
  unit          text,                          -- "tábuas", "lb", "saco", "ft"
  min_quantity  numeric(10,2),                 -- alerta quando quantity < min
  location      text,                          -- "Garagem - prateleira A"
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_store_items_name ON store_items(lower(name));
CREATE INDEX IF NOT EXISTS idx_store_items_category ON store_items(category);

DROP TRIGGER IF EXISTS trg_store_items_set_updated_at ON store_items;
CREATE TRIGGER trg_store_items_set_updated_at
  BEFORE UPDATE ON store_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_leads_set_updated_at();

-- 2) Enum tipo de movimento
DO $$ BEGIN
  CREATE TYPE store_movement_kind AS ENUM ('in', 'out', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) Tabela movimentações (histórico + driver de atualização da qty)
CREATE TABLE IF NOT EXISTS store_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  item_id       uuid NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
  kind          store_movement_kind NOT NULL,
  quantity      numeric(10,2) NOT NULL CHECK (quantity > 0),  -- sempre positivo
  job_id        uuid REFERENCES jobs(id) ON DELETE SET NULL,  -- pra rastreio (de onde veio ou pra onde foi)
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_store_movements_item ON store_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_movements_job ON store_movements(job_id)
  WHERE job_id IS NOT NULL;

-- 4) Trigger: movement atualiza qty do item automaticamente
CREATE OR REPLACE FUNCTION fn_store_movement_apply()
RETURNS trigger AS $$
BEGIN
  IF NEW.kind = 'in' THEN
    UPDATE store_items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.kind = 'out' THEN
    UPDATE store_items SET quantity = GREATEST(0, quantity - NEW.quantity) WHERE id = NEW.item_id;
  ELSIF NEW.kind = 'adjustment' THEN
    -- adjustment seta valor absoluto: quantity vira NEW.quantity (ignora atual)
    UPDATE store_items SET quantity = NEW.quantity WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_movements_apply ON store_movements;
CREATE TRIGGER trg_store_movements_apply
  AFTER INSERT ON store_movements
  FOR EACH ROW
  EXECUTE FUNCTION fn_store_movement_apply();

-- 5) Tabela reservas (item separado pra um job específico)
CREATE TABLE IF NOT EXISTS store_reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  item_id       uuid NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
  job_id        uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  quantity      numeric(10,2) NOT NULL CHECK (quantity > 0),
  notes         text,

  UNIQUE (item_id, job_id)  -- 1 reserva por par (atualiza qty se já existe)
);

CREATE INDEX IF NOT EXISTS idx_store_reservations_item ON store_reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_store_reservations_job ON store_reservations(job_id);

DROP TRIGGER IF EXISTS trg_store_reservations_set_updated_at ON store_reservations;
CREATE TRIGGER trg_store_reservations_set_updated_at
  BEFORE UPDATE ON store_reservations
  FOR EACH ROW
  EXECUTE FUNCTION fn_leads_set_updated_at();

-- 6) View agregada — qty real, reservada, disponível, low_stock
CREATE OR REPLACE VIEW v_store_items_stats AS
SELECT
  i.id,
  i.created_at,
  i.updated_at,
  i.name,
  i.category,
  i.quantity,
  i.unit,
  i.min_quantity,
  i.location,
  i.notes,
  COALESCE(r.reserved_quantity, 0)                        AS reserved_quantity,
  i.quantity - COALESCE(r.reserved_quantity, 0)           AS available_quantity,
  (i.min_quantity IS NOT NULL AND i.quantity < i.min_quantity) AS low_stock
FROM store_items i
LEFT JOIN (
  SELECT item_id, SUM(quantity) AS reserved_quantity
  FROM store_reservations
  GROUP BY item_id
) r ON r.item_id = i.id;

-- 7) RLS owner-only nas 3 tabelas (padrão do CRM)
ALTER TABLE store_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_movements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_store_items_owner_only ON store_items;
CREATE POLICY p_store_items_owner_only ON store_items FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

DROP POLICY IF EXISTS p_store_movements_owner_only ON store_movements;
CREATE POLICY p_store_movements_owner_only ON store_movements FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

DROP POLICY IF EXISTS p_store_reservations_owner_only ON store_reservations;
CREATE POLICY p_store_reservations_owner_only ON store_reservations FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- Validação
SELECT
  COUNT(*) AS items_iniciais,
  COUNT(*) FILTER (WHERE min_quantity IS NOT NULL) AS com_alerta_minimo
FROM store_items;
