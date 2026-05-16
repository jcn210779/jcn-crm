-- Migration 0010 — despesas/recibos do job + cálculo de margem
-- Aplicada em: 2026-05-16
--
-- Escopo Fase 4.2D:
--   José quer trackear todo dinheiro que SAI pra fazer o job (material, mão
--   de obra, permit, subempreiteiro, equipamento, transporte) e ver margem
--   real do contrato (valor − despesas = lucro).
--
-- Diferença vs Pagamentos (4.2A):
--   - `job_payments`  = $$$ que ENTRA do cliente
--   - `job_expenses`  = $$$ que SAI pra executar a obra (esta migration)
--
-- Notas de design:
--   - Tabela 1:N (jobs -> job_expenses). Cada despesa é uma linha.
--   - `category` em 7 valores cobre o leque típico de GC (Home Depot, helpers,
--     city permit, eletricista subcontratado, caçamba, frete, etc).
--   - `vendor` é texto livre opcional (ex: "Home Depot", "John Smith Electrical")
--     — não vira tabela própria de fornecedores no MVP.
--   - `description` obrigatório — usuário descreve o que comprou/contratou.
--   - `amount` em USD positivo (CHECK > 0). Se errar e quiser anular, deleta.
--   - `expense_date` separa data da despesa de `created_at` (registro no app).
--   - `receipt_path` opcional — recibo no Supabase Storage `job-receipts`.
--     José pode lançar despesa SEM arquivo (digita valor sem foto). Path
--     canônico: "jobs/<job_id>/<uuid>.<ext>".
--   - Aceita imagem (JPEG/PNG/WEBP/HEIC) E PDF (recibos digitais).
--   - View `v_job_expense_summary` agrega contagem + total + breakdown por
--     categoria pra UI mostrar "12 recibos · $12.450 · Material lidera $5.200".
--   - View `v_job_margin` cruza jobs.value com total_expenses pra exibir
--     margem estimada no header do job.
--   - RLS owner-only (padrão Fase 1+).
--
-- =============================================================================
-- IMPORTANTE — JOSÉ CRIA O BUCKET STORAGE MANUAL (não via SQL)
-- =============================================================================
-- Antes de aplicar (ou logo depois — tanto faz), criar bucket manual:
--
-- 1. Supabase Dashboard → Storage (ícone pasta no menu esquerdo)
-- 2. Botão "New bucket"
-- 3. Name: job-receipts
-- 4. Public bucket: NO (manter privado — servido via signed URL)
-- 5. File size limit: 20 MB (recibos PDF podem ser grandes)
-- 6. Allowed MIME types:
--       image/jpeg, image/png, image/webp, image/heic, application/pdf
-- 7. Save
--
-- Depois, em Storage → Policies → New policy on `job-receipts`, criar 3:
--
--   Policy 1 — SELECT (Read):
--     Name: "Owner can read receipts"
--     Allowed operation: SELECT
--     Target roles: authenticated
--     USING expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
--   Policy 2 — INSERT (Upload):
--     Name: "Owner can upload receipts"
--     Allowed operation: INSERT
--     Target roles: authenticated
--     WITH CHECK expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
--   Policy 3 — DELETE:
--     Name: "Owner can delete receipts"
--     Allowed operation: DELETE
--     Target roles: authenticated
--     USING expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
-- Sem essas policies o upload falha com "new row violates row-level security".
-- =============================================================================

-- =============================================================================
-- Enum: categoria da despesa
-- =============================================================================

CREATE TYPE expense_category AS ENUM (
  'materials',      -- material de construção (madeira, parafuso, tinta)
  'labor',          -- mão de obra (helpers, diaristas)
  'permit',         -- alvará, taxas governo
  'subcontractor',  -- subempreiteiro (eletricista, encanador)
  'equipment',      -- aluguel de equipamento (caçamba, betoneira)
  'transport',      -- combustível, frete, delivery
  'other'
);

-- =============================================================================
-- Tabela job_expenses
-- =============================================================================

CREATE TABLE job_expenses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  job_id            uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  category          expense_category NOT NULL,
  vendor            text,                       -- "Home Depot", "John Smith Electrical"
  description       text NOT NULL,              -- "20 boards 2x6 cedar"
  amount            numeric(10,2) NOT NULL CHECK (amount > 0),
  expense_date      date NOT NULL DEFAULT CURRENT_DATE,

  -- Arquivo do recibo no Supabase Storage (bucket job-receipts), OPCIONAL
  receipt_path      text,                       -- "jobs/<job_id>/<uuid>.<ext>"
  receipt_file_name text,
  receipt_size      integer,
  receipt_mime      text,                       -- image/jpeg, image/png, application/pdf

  notes             text
);

CREATE INDEX idx_job_expenses_job ON job_expenses(job_id);
CREATE INDEX idx_job_expenses_category ON job_expenses(category);
CREATE INDEX idx_job_expenses_date ON job_expenses(expense_date DESC);

-- =============================================================================
-- Trigger: updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_job_expenses_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_expenses_set_updated_at ON job_expenses;
CREATE TRIGGER trg_job_expenses_set_updated_at
  BEFORE UPDATE ON job_expenses
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_expenses_set_updated_at();

-- =============================================================================
-- RLS owner-only
-- =============================================================================

ALTER TABLE job_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_expenses_owner_only ON job_expenses;
CREATE POLICY p_job_expenses_owner_only ON job_expenses FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- View: resumo de despesas por job + breakdown por categoria
-- =============================================================================

CREATE OR REPLACE VIEW v_job_expense_summary AS
SELECT
  job_id,
  COUNT(*) AS expense_count,
  COALESCE(SUM(amount), 0) AS total_expenses,
  COALESCE(SUM(amount) FILTER (WHERE category = 'materials'), 0) AS materials_total,
  COALESCE(SUM(amount) FILTER (WHERE category = 'labor'), 0) AS labor_total,
  COALESCE(SUM(amount) FILTER (WHERE category = 'permit'), 0) AS permit_total,
  COALESCE(SUM(amount) FILTER (WHERE category = 'subcontractor'), 0) AS subcontractor_total,
  COALESCE(SUM(amount) FILTER (WHERE category = 'equipment'), 0) AS equipment_total,
  COALESCE(SUM(amount) FILTER (WHERE category = 'transport'), 0) AS transport_total,
  COALESCE(SUM(amount) FILTER (WHERE category = 'other'), 0) AS other_total
FROM job_expenses
GROUP BY job_id;

-- =============================================================================
-- View: margem do job (contrato - despesas)
-- =============================================================================

CREATE OR REPLACE VIEW v_job_margin AS
SELECT
  j.id AS job_id,
  j.value AS contract_value,
  COALESCE(es.total_expenses, 0) AS total_expenses,
  j.value - COALESCE(es.total_expenses, 0) AS estimated_margin,
  CASE
    WHEN j.value > 0 THEN
      ROUND(((j.value - COALESCE(es.total_expenses, 0)) / j.value * 100)::numeric, 1)
    ELSE NULL
  END AS margin_percent
FROM jobs j
LEFT JOIN v_job_expense_summary es ON es.job_id = j.id;

-- =============================================================================
-- Validação final
-- =============================================================================

SELECT * FROM job_expenses LIMIT 5;
SELECT * FROM v_job_expense_summary LIMIT 5;
SELECT * FROM v_job_margin LIMIT 5;
