-- ============================================================================
-- 0066 — fix ON CONFLICT do trigger sync_bank_draw_to_job_extra (mig 0062)
-- ============================================================================
-- Bug: trigger fazia `ON CONFLICT (source_bank_draw_id) DO NOTHING`, mas o
-- unique index dessa coluna e PARTIAL (`WHERE source_bank_draw_id IS NOT NULL`).
-- Postgres exige que o `WHERE` do partial index apareca no ON CONFLICT pra
-- casar. Sem isso, todo INSERT em flip_draws (source='bank_draw') falha com:
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT
-- Descoberto ao tentar clonar 34 draws da Farragut pro Raymond.
--
-- Fix: adicionar `WHERE source_bank_draw_id IS NOT NULL` no ON CONFLICT.

CREATE OR REPLACE FUNCTION sync_bank_draw_to_job_extra()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id uuid;
  v_title text;
BEGIN
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
    ON CONFLICT (source_bank_draw_id) WHERE source_bank_draw_id IS NOT NULL
    DO NOTHING;
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
