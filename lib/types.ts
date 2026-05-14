/**
 * Types do schema CRM JCN (Fase 1).
 *
 * Espelham a migration `apps/crm/supabase/migrations/0001_initial_schema.sql`.
 * Se o schema mudar, atualizar AQUI tambem (ou regenerar via
 * `npx supabase gen types typescript --linked` quando o link estiver pronto).
 */

// ============================================================================
// Enums (espelho de CREATE TYPE ... AS ENUM no Postgres)
// ============================================================================

export type LeadStage =
  | "novo"
  | "contato_feito"
  | "visita_agendada"
  | "cotando"
  | "estimate_enviado"
  | "ganho"
  | "perdido";

export const LEAD_STAGES: readonly LeadStage[] = [
  "novo",
  "contato_feito",
  "visita_agendada",
  "cotando",
  "estimate_enviado",
  "ganho",
  "perdido",
] as const;

export type LeadSource =
  | "meta_ads"
  | "google_ads"
  | "lsa"
  | "permit"
  | "zillow"
  | "referral"
  | "direct"
  | "other";

export const LEAD_SOURCES: readonly LeadSource[] = [
  "meta_ads",
  "google_ads",
  "lsa",
  "permit",
  "zillow",
  "referral",
  "direct",
  "other",
] as const;

export type ServiceType = "deck" | "siding" | "patio" | "multiple" | "other";

export const SERVICE_TYPES: readonly ServiceType[] = [
  "deck",
  "siding",
  "patio",
  "multiple",
  "other",
] as const;

export type LostReason =
  | "price"
  | "no_show"
  | "ghosted"
  | "chose_competitor"
  | "not_ready"
  | "out_of_scope"
  | "other";

export const LOST_REASONS: readonly LostReason[] = [
  "price",
  "no_show",
  "ghosted",
  "chose_competitor",
  "not_ready",
  "out_of_scope",
  "other",
] as const;

// ============================================================================
// Tipos de linha (espelho de CREATE TABLE)
// ============================================================================

export type Lead = {
  id: string;
  created_at: string;
  updated_at: string;

  name: string;
  phone: string | null;
  email: string | null;

  address: string | null;
  city: string;
  state: string | null;
  zip: string | null;

  source: LeadSource;
  source_detail: string | null;

  service_interest: ServiceType;
  service_notes: string | null;

  stage: LeadStage;

  estimated_value: number | null;

  first_contact_at: string | null;
  visit_scheduled_at: string | null;
  visit_completed_at: string | null;

  lost_reason: LostReason | null;
  lost_notes: string | null;

  notes: string | null;
};

/** Campos obrigatorios pra INSERT em leads (defaults preenchem o resto). */
export type LeadInsert = Pick<
  Lead,
  "name" | "city" | "source" | "service_interest"
> &
  Partial<Omit<Lead, "id" | "created_at" | "updated_at">>;

/** Update parcial — qualquer campo opcional. */
export type LeadUpdate = Partial<Omit<Lead, "id" | "created_at">>;

export type StageHistoryRow = {
  id: string;
  lead_id: string;
  from_stage: LeadStage | null;
  to_stage: LeadStage;
  changed_at: string;
  changed_by: string;
  note: string | null;
};

export type ActivityLogRow = {
  id: string;
  created_at: string;
  lead_id: string | null;
  type: string;
  created_by: string;
  payload: Record<string, unknown>;
};

// ============================================================================
// Views
// ============================================================================

export type LeadsActiveView = Lead;

export type PipelineSummaryRow = {
  stage: LeadStage;
  count: number;
  total_value: number;
};

// ============================================================================
// Database (formato esperado pelo supabase-js generic)
// ============================================================================

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      leads: {
        Row: Lead;
        Insert: LeadInsert;
        Update: LeadUpdate;
        Relationships: [];
      };
      stage_history: {
        Row: StageHistoryRow;
        Insert: Omit<StageHistoryRow, "id" | "changed_at"> &
          Partial<Pick<StageHistoryRow, "id" | "changed_at">>;
        Update: Partial<StageHistoryRow>;
        Relationships: [];
      };
      activity_log: {
        Row: ActivityLogRow;
        Insert: Omit<ActivityLogRow, "id" | "created_at"> &
          Partial<Pick<ActivityLogRow, "id" | "created_at">>;
        Update: Partial<ActivityLogRow>;
        Relationships: [];
      };
    };
    Views: {
      v_leads_active: {
        Row: LeadsActiveView;
        Relationships: [];
      };
      v_pipeline_summary: {
        Row: PipelineSummaryRow;
        Relationships: [];
      };
    };
    Enums: {
      lead_stage: LeadStage;
      lead_source: LeadSource;
      service_type: ServiceType;
      lost_reason: LostReason;
    };
    Functions: Record<string, never>;
  };
};
