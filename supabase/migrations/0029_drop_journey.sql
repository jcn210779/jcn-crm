-- Migration 0029 — Eliminar Jornada do CRM
-- Aplicada em: 2026-05-22
--
-- Motivo:
--   José decidiu remover a feature de Jornada do CRM. Limpeza completa:
--   dropa tabela journey_milestones + enum journey_milestone_kind.
--
-- =============================================================================

DROP TABLE IF EXISTS journey_milestones CASCADE;
DROP TYPE IF EXISTS journey_milestone_kind CASCADE;

SELECT 'journey eliminada' AS status;
