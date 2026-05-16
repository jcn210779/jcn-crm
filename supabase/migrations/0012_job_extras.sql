-- Migration 0012 — extras / change orders do job + recalculo da margem
-- Aplicada em: 2026-05-16
--
-- Escopo Fase 4.2F:
--   José pediu "pasta de trabalhos extras que aparecem durante a obra". Em GC
--   isso se chama change order. Cliente pede algo a mais durante a obra (ex:
--   "ja que voce ta aqui, faz uma escadinha tambem"). Sistema precisa:
--     1. Registrar o extra (titulo + descricao + valor)
--     2. Trackear status (proposto/aprovado/rejeitado/concluido)
--     3. Anexar prova de aprovacao (foto/PDF/print do WhatsApp do cliente)
--        — protecao legal em caso de discussao de cobranca
--     4. Anexar contrato adicional (PDF formal se houver — change order doc)
--     5. Margem do job recalcula: contrato + extras_aprovados − despesas − horas
--
-- Decisao do dono:
--   Caminho B (medio) + opcao de anexar contrato alem de prova de aprovacao.
--   Status flow simples: proposed -> approved/rejected -> completed.
--
-- Diferenca vs Pagamentos (4.2A) e Despesas (4.2D):
--   - `job_payments`  = $$$ que ENTRA do cliente (parcelas planejadas)
--   - `job_expenses`  = $$$ que SAI pra executar a obra (recibos)
--   - `job_extras`    = trabalho adicional vendido durante a obra (esta migration)
--
-- Notas de design:
--   - Tabela 1:N (jobs -> job_extras). Cada extra e uma linha.
--   - `additional_value` >= 0 (CHECK) — pode ser 0 se for cortesia / brinde.
--   - `status` 4 estados — proposed/approved/rejected/completed.
--   - Timestamps separados por transicao (proposed_at, approved_at,
--     rejected_at, completed_at) preenchidos via trigger automatico.
--   - `approved_by_name` — nome do cliente que aprovou (texto livre).
--   - DOIS anexos opcionais no Supabase Storage (bucket `job-extras`):
--       a) approval_attachment — foto/PDF/print da aprovacao
--       b) contract_attachment — contrato adicional formal (PDF)
--   - Path canonico: `jobs/<job_id>/<uuid>.<ext>`.
--   - Aceita imagem (JPEG/PNG/WEBP/HEIC) E PDF (mesma lista de recibos).
--   - View `v_job_extras_summary`: contagem por status + soma de valor
--     aprovado/proposto pra UI mostrar KPIs.
--   - View `v_job_margin`: RECRIADA pra incluir extras_aprovados na conta:
--       contract + approved_extras − expenses − labor = margin
--   - RLS owner-only (padrao Fase 1+).
--
-- Idempotencia:
--   Esta migration usa IF EXISTS/IF NOT EXISTS sempre que possivel e DROP TYPE
--   IF EXISTS CASCADE no topo, pra Jose poder rodar 2x sem erro caso tenha
--   aplicado parcialmente.
--
-- =============================================================================
-- IMPORTANTE — JOSE CRIA O BUCKET STORAGE MANUAL (nao via SQL)
-- =============================================================================
-- Antes de aplicar (ou logo depois — tanto faz), criar bucket manual:
--
-- 1. Supabase Dashboard -> Storage (icone pasta no menu esquerdo)
-- 2. Botao "New bucket"
-- 3. Name: job-extras
-- 4. Public bucket: NO (manter privado — servido via signed URL)
-- 5. File size limit: 20 MB (PDFs de contrato podem ser grandes)
-- 6. Allowed MIME types:
--       image/jpeg, image/png, image/webp, image/heic, application/pdf
-- 7. Save
--
-- Depois, em Storage -> Policies -> New policy on `job-extras`, criar 3:
--
--   Policy 1 — SELECT (Read):
--     Name: "Owner can read extras"
--     Allowed operation: SELECT
--     Target roles: authenticated
--     USING expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
--   Policy 2 — INSERT (Upload):
--     Name: "Owner can upload extras"
--     Allowed operation: INSERT
--     Target roles: authenticated
--     WITH CHECK expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
--   Policy 3 — DELETE:
--     Name: "Owner can delete extras"
--     Allowed operation: DELETE
--     Target roles: authenticated
--     USING expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
-- Sem essas policies o upload falha com "new row violates row-level security".
-- =============================================================================

-- =============================================================================
-- Limpeza idempotente (caso ja tenha rodado parcialmente)
-- =============================================================================

DROP VIEW IF EXISTS v_job_margin;
DROP VIEW IF EXISTS v_job_extras_summary;
DROP TABLE IF EXISTS job_extras;
DROP TYPE IF EXISTS extra_status CASCADE;

-- =============================================================================
-- Enum: status do extra
-- =============================================================================

CREATE TYPE extra_status AS ENUM (
  'proposed',   -- proposto pro cliente, aguarda resposta
  'approved',   -- cliente aceitou (pode ter anexo de aprovacao)
  'rejected',   -- cliente recusou
  'completed'   -- extra foi executado e finalizado
);

-- =============================================================================
-- Tabela job_extras
-- =============================================================================

CREATE TABLE job_extras (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  job_id                   uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  title                    text NOT NULL,
  description              text,
  additional_value         numeric(10,2) NOT NULL DEFAULT 0 CHECK (additional_value >= 0),

  status                   extra_status NOT NULL DEFAULT 'proposed',

  -- Timestamps por transicao de status (preenchidos via trigger)
  proposed_at              timestamptz NOT NULL DEFAULT now(),
  approved_at              timestamptz,
  rejected_at              timestamptz,
  completed_at             timestamptz,

  -- Quem aprovou (cliente)
  approved_by_name         text,

  -- Anexo 1: prova de aprovacao (foto/PDF/print)
  -- Path: jobs/<job_id>/<uuid>.<ext>
  approval_attachment_path text,
  approval_file_name       text,
  approval_mime            text,

  -- Anexo 2: contrato adicional formal (PDF normalmente)
  contract_attachment_path text,
  contract_file_name       text,
  contract_mime            text,

  notes                    text
);

CREATE INDEX idx_job_extras_job ON job_extras(job_id);
CREATE INDEX idx_job_extras_status ON job_extras(status);
CREATE INDEX idx_job_extras_proposed_at ON job_extras(proposed_at DESC);

-- =============================================================================
-- Trigger: updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_job_extras_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_extras_set_updated_at ON job_extras;
CREATE TRIGGER trg_job_extras_set_updated_at
  BEFORE UPDATE ON job_extras
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_extras_set_updated_at();

-- =============================================================================
-- Trigger: ao mudar status, atualiza timestamp correspondente
-- (preserva valor anterior se ja estava setado — COALESCE)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_job_extras_status_timestamp()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'approved'  THEN NEW.approved_at  = COALESCE(NEW.approved_at, now());
      WHEN 'rejected'  THEN NEW.rejected_at  = COALESCE(NEW.rejected_at, now());
      WHEN 'completed' THEN NEW.completed_at = COALESCE(NEW.completed_at, now());
      ELSE -- proposed: nao toca em nada
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_extras_status_timestamp ON job_extras;
CREATE TRIGGER trg_job_extras_status_timestamp
  BEFORE UPDATE ON job_extras
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_extras_status_timestamp();

-- =============================================================================
-- RLS owner-only
-- =============================================================================

ALTER TABLE job_extras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_extras_owner_only ON job_extras;
CREATE POLICY p_job_extras_owner_only ON job_extras FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- View: resumo de extras por job
-- =============================================================================

CREATE OR REPLACE VIEW v_job_extras_summary AS
SELECT
  job_id,
  COUNT(*) AS total_extras,
  COUNT(*) FILTER (WHERE status = 'proposed')  AS proposed_count,
  COUNT(*) FILTER (WHERE status = 'approved')  AS approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected_count,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  COALESCE(SUM(additional_value) FILTER (WHERE status IN ('approved', 'completed')), 0)
    AS approved_value_total,
  COALESCE(SUM(additional_value) FILTER (WHERE status = 'proposed'), 0)
    AS proposed_value_total
FROM job_extras
GROUP BY job_id;

-- =============================================================================
-- View: margem do job RECRIADA (contrato + extras_aprovados − despesas − horas)
-- =============================================================================

CREATE OR REPLACE VIEW v_job_margin AS
SELECT
  j.id AS job_id,
  j.value AS contract_value,
  COALESCE(xs.approved_value_total, 0) AS approved_extras_value,
  j.value + COALESCE(xs.approved_value_total, 0) AS effective_contract_value,
  COALESCE(es.total_expenses, 0) AS total_expenses,
  COALESCE(hs.total_labor_cost, 0) AS total_labor,
  (j.value + COALESCE(xs.approved_value_total, 0))
    - COALESCE(es.total_expenses, 0)
    - COALESCE(hs.total_labor_cost, 0)
    AS estimated_margin,
  CASE
    WHEN (j.value + COALESCE(xs.approved_value_total, 0)) > 0 THEN
      ROUND(
        (((j.value + COALESCE(xs.approved_value_total, 0))
          - COALESCE(es.total_expenses, 0)
          - COALESCE(hs.total_labor_cost, 0))
          / (j.value + COALESCE(xs.approved_value_total, 0)) * 100)::numeric, 1
      )
    ELSE NULL
  END AS margin_percent
FROM jobs j
LEFT JOIN v_job_expense_summary es ON es.job_id = j.id
LEFT JOIN v_job_hours_summary hs ON hs.job_id = j.id
LEFT JOIN v_job_extras_summary xs ON xs.job_id = j.id;

-- =============================================================================
-- Validacao final
-- =============================================================================

SELECT * FROM job_extras LIMIT 5;
SELECT * FROM v_job_extras_summary LIMIT 5;
SELECT * FROM v_job_margin LIMIT 5;
