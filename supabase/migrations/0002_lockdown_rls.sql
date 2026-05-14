-- =============================================================================
-- Migration 0002 — Lockdown RLS owner-only
-- =============================================================================
-- Data: 2026-05-14
-- Autor: Victor (Full Stack) via brief Pedro (CEO IA)
-- Origem: M1 do audit de seguranca da Cristina (Security Auditor)
--         Arquivo do audit: wiki/operations/audit-crm-fase1-cristina.md
--
-- Problema:
--   As policies da 0001_init.sql liberavam acesso total pra qualquer linha
--   autenticada (auth.uid() IS NOT NULL). Combinado com signup aberto no
--   Supabase Auth, isso permite que QUALQUER stranger crie conta com email
--   proprio, receba o link magico, faca login e leia/edite TODOS os leads
--   do CRM. Falha critica de confidencialidade.
--
-- Solucao:
--   CRM eh single-tenant single-user. Owner unico: info@jcnconstructioninc.com.
--   Trocamos as 3 policies "authenticated_all" por policies "owner_only" que
--   conferem o email no JWT contra a constante do dono.
--
-- IMPORTANTE:
--   1. Este SQL NAO eh aplicado automaticamente. Jose precisa rodar manual
--      no SQL Editor do Supabase Dashboard.
--   2. Em paralelo, Jose precisa desabilitar signups no painel:
--      Authentication -> Sign In / Up -> "Disable signups" = ON.
--      Sem isso, stranger ainda consegue CRIAR conta (mesmo nao lendo dados).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. LEADS
-- ---------------------------------------------------------------------------
-- Remove policy antiga (acesso liberado pra qualquer autenticado).
DROP POLICY IF EXISTS p_leads_authenticated_all ON public.leads;

-- Cria policy owner-only: so o email do dono passa.
-- auth.jwt() retorna o JSON do token JWT do request atual.
-- O campo "email" eh populado pelo Supabase Auth quando o usuario loga.
CREATE POLICY p_leads_owner_only ON public.leads
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- ---------------------------------------------------------------------------
-- 2. STAGE_HISTORY
-- ---------------------------------------------------------------------------
-- Historico de mudancas de estagio. Tambem owner-only.
DROP POLICY IF EXISTS p_stage_history_authenticated_all ON public.stage_history;

CREATE POLICY p_stage_history_owner_only ON public.stage_history
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- ---------------------------------------------------------------------------
-- 3. ACTIVITY_LOG
-- ---------------------------------------------------------------------------
-- Log de atividades (ligacao, email, visita). Owner-only.
DROP POLICY IF EXISTS p_activity_log_authenticated_all ON public.activity_log;

CREATE POLICY p_activity_log_owner_only ON public.activity_log
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- Validacao pos-aplicacao (rodar no SQL Editor depois do CREATE acima):
--
--   SELECT schemaname, tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('leads', 'stage_history', 'activity_log')
--   ORDER BY tablename, policyname;
--
-- Esperado: 3 policies, todas com sufixo "_owner_only", nenhuma "_authenticated_all".
-- =============================================================================
