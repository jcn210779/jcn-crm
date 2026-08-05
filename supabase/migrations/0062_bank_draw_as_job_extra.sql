-- ============================================================================
-- 0062 — bank_draw vira job_extra automaticamente
-- ============================================================================
-- Cada requerimento (flip_draws.source='bank_draw') vale como contrato fechado.
-- Auto-cria uma linha em job_extras (status=approved) linkada ao bank_draw,
-- pra somar no revenue de Contrato + Extras do P&L do job.
-- Editar/deletar o bank_draw sincroniza no extra.

-- 1. Coluna de link (nullable — extras manuais continuam existindo)
ALTER TABLE job_extras
  ADD COLUMN IF NOT EXISTS source_bank_draw_id uuid
    REFERENCES flip_draws(id) ON DELETE CASCADE;

-- 2. 1 extra por bank_draw no máximo (bloqueia duplicata do backfill/trigger)
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_extras_source_bank_draw
  ON job_extras(source_bank_draw_id)
  WHERE source_bank_draw_id IS NOT NULL;

-- 3. Trigger que sincroniza bank_draw → job_extra
CREATE OR REPLACE FUNCTION sync_bank_draw_to_job_extra()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id uuid;
  v_title text;
BEGIN
  -- Só bank_draws viram extra. Owner capital / unit sale / other ficam de fora.
  IF NEW.source IS DISTINCT FROM 'bank_draw' THEN
    RETURN NEW;
  END IF;

  SELECT job_id INTO v_job_id FROM flip_details WHERE id = NEW.flip_id;
  IF v_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := COALESCE(NULLIF(TRIM(NEW.milestone), ''), 'Requerimento sem descrição');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO job_extras (
      job_id, source_bank_draw_id, title, description,
      additional_value, status, approved_at
    ) VALUES (
      v_job_id, NEW.id, v_title,
      'Auto-gerado do requerimento do banco. Editar valor/título no card do flip.',
      NEW.amount, 'approved',
      COALESCE(NEW.draw_date::timestamptz, now())
    )
    ON CONFLICT (source_bank_draw_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE job_extras SET
      title = v_title,
      additional_value = NEW.amount,
      updated_at = now()
    WHERE source_bank_draw_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bank_draw_to_job_extra ON flip_draws;
CREATE TRIGGER trg_sync_bank_draw_to_job_extra
AFTER INSERT OR UPDATE ON flip_draws
FOR EACH ROW EXECUTE FUNCTION sync_bank_draw_to_job_extra();

-- 4. Backfill: cria extra pra cada bank_draw ja existente que ainda nao tem
INSERT INTO job_extras (
  job_id, source_bank_draw_id, title, description,
  additional_value, status, approved_at
)
SELECT
  fd_details.job_id,
  fd.id,
  COALESCE(NULLIF(TRIM(fd.milestone), ''), 'Requerimento sem descrição'),
  'Auto-gerado do requerimento do banco. Editar valor/título no card do flip.',
  fd.amount,
  'approved',
  COALESCE(fd.draw_date::timestamptz, now())
FROM flip_draws fd
JOIN flip_details fd_details ON fd_details.id = fd.flip_id
WHERE fd.source = 'bank_draw'
  AND fd_details.job_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM job_extras je WHERE je.source_bank_draw_id = fd.id
  );
