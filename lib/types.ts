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
  | "follow_up"
  | "ganho"
  | "perdido";

export const LEAD_STAGES: readonly LeadStage[] = [
  "novo",
  "contato_feito",
  "visita_agendada",
  "cotando",
  "estimate_enviado",
  "follow_up",
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

export type TaskType =
  | "call"
  | "sms"
  | "email"
  | "visit"
  | "followup"
  | "internal";

export const TASK_TYPES: readonly TaskType[] = [
  "call",
  "sms",
  "email",
  "visit",
  "followup",
  "internal",
] as const;

export type TaskStatus = "pending" | "done" | "skipped" | "overdue";

export const TASK_STATUSES: readonly TaskStatus[] = [
  "pending",
  "done",
  "skipped",
  "overdue",
] as const;

export type JobPhase =
  | "planning"
  | "permit_released"
  | "materials_ordered"
  | "materials_delivered"
  | "work_in_progress"
  | "completed";

export const JOB_PHASES: readonly JobPhase[] = [
  "planning",
  "permit_released",
  "materials_ordered",
  "materials_delivered",
  "work_in_progress",
  "completed",
] as const;

export type PaymentMethod =
  | "check"
  | "cash"
  | "wire_transfer"
  | "credit_card"
  | "zelle"
  | "venmo"
  | "other";

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "check",
  "cash",
  "wire_transfer",
  "credit_card",
  "zelle",
  "venmo",
  "other",
] as const;

export type PaymentKind = "deposit" | "milestone" | "final" | "extra";

export const PAYMENT_KINDS: readonly PaymentKind[] = [
  "deposit",
  "milestone",
  "final",
  "extra",
] as const;

export type PaymentStatus = "pending" | "paid" | "overdue" | "cancelled";

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "paid",
  "overdue",
  "cancelled",
] as const;

export type PhotoCategory = "before" | "during" | "after";

export const PHOTO_CATEGORIES: readonly PhotoCategory[] = [
  "before",
  "during",
  "after",
] as const;

export type ExpenseCategory =
  | "materials"
  | "labor"
  | "permit"
  | "subcontractor"
  | "equipment"
  | "transport"
  | "other";

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "materials",
  "labor",
  "permit",
  "subcontractor",
  "equipment",
  "transport",
  "other",
] as const;

export type TeamRole =
  | "helper"
  | "skilled"
  | "foreman"
  | "subcontractor"
  | "other";

export const TEAM_ROLES: readonly TeamRole[] = [
  "helper",
  "skilled",
  "foreman",
  "subcontractor",
  "other",
] as const;

export type ExtraStatus = "proposed" | "approved" | "rejected" | "completed";

export const EXTRA_STATUSES: readonly ExtraStatus[] = [
  "proposed",
  "approved",
  "rejected",
  "completed",
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

export type Task = {
  id: string;
  created_at: string;
  lead_id: string | null;
  type: TaskType;
  title: string;
  due_date: string;
  status: TaskStatus;
  completed_at: string | null;
  notes: string | null;
  created_by: string;
};

/** Campos obrigatorios pra INSERT em tasks (defaults preenchem o resto). */
export type TaskInsert = Pick<Task, "type" | "title" | "due_date"> &
  Partial<Omit<Task, "id" | "created_at">>;

/** Update parcial — qualquer campo opcional. */
export type TaskUpdate = Partial<Omit<Task, "id" | "created_at">>;

export type Job = {
  id: string;
  created_at: string;
  updated_at: string;

  lead_id: string;

  contract_signed_at: string;
  value: number;

  expected_start: string | null;
  expected_end: string | null;
  actual_start: string | null;
  actual_end: string | null;

  current_phase: JobPhase;
  notes: string | null;
};

/** Campos obrigatorios pra INSERT em jobs (defaults preenchem o resto). */
export type JobInsert = Pick<Job, "lead_id"> &
  Partial<Omit<Job, "id" | "created_at" | "updated_at">>;

/** Update parcial — qualquer campo opcional. */
export type JobUpdate = Partial<Omit<Job, "id" | "created_at" | "lead_id">>;

export type JobPhaseHistoryRow = {
  id: string;
  job_id: string;
  phase: JobPhase;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
};

export type AdSpend = {
  id: string;
  created_at: string;
  updated_at: string;

  /** Sempre dia 1 do mês: YYYY-MM-01 */
  month: string;
  source: LeadSource;
  amount: number;
  notes: string | null;
};

/** Campos obrigatorios pra INSERT em ad_spend (defaults preenchem o resto). */
export type AdSpendInsert = Pick<AdSpend, "month" | "source" | "amount"> &
  Partial<Omit<AdSpend, "id" | "created_at" | "updated_at">>;

/** Update parcial — qualquer campo opcional. */
export type AdSpendUpdate = Partial<Omit<AdSpend, "id" | "created_at">>;

/** Linha agregada da view v_ad_spend_by_month. */
export type AdSpendByMonthRow = {
  month_label: string;
  month: string;
  source: LeadSource;
  amount: number;
};

export type JobPayment = {
  id: string;
  created_at: string;
  updated_at: string;

  job_id: string;

  kind: PaymentKind;
  label: string;
  amount: number;

  due_date: string | null;
  received_at: string | null;

  status: PaymentStatus;
  method: PaymentMethod | null;
  notes: string | null;

  display_order: number;
};

/** Campos obrigatorios pra INSERT em job_payments (defaults preenchem o resto). */
export type JobPaymentInsert = Pick<
  JobPayment,
  "job_id" | "kind" | "label" | "amount"
> &
  Partial<Omit<JobPayment, "id" | "created_at" | "updated_at">>;

/** Update parcial — qualquer campo opcional. */
export type JobPaymentUpdate = Partial<
  Omit<JobPayment, "id" | "created_at" | "job_id">
>;

/** Linha agregada da view v_job_payment_summary. */
export type JobPaymentSummary = {
  job_id: string;
  pending_count: number;
  paid_count: number;
  total_paid: number;
  total_pending: number;
  total_planned: number;
};

export type JobPhoto = {
  id: string;
  created_at: string;

  job_id: string;

  /** Caminho no bucket Supabase Storage `job-photos`. */
  storage_path: string;

  category: PhotoCategory;
  caption: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;

  uploaded_by: string;
  display_order: number;
};

/** Campos obrigatorios pra INSERT em job_photos (defaults preenchem o resto). */
export type JobPhotoInsert = Pick<
  JobPhoto,
  "job_id" | "storage_path" | "category"
> &
  Partial<Omit<JobPhoto, "id" | "created_at">>;

/** Update parcial — qualquer campo opcional (job_id e storage_path imutáveis). */
export type JobPhotoUpdate = Partial<
  Omit<JobPhoto, "id" | "created_at" | "job_id" | "storage_path">
>;

/** Linha agregada da view v_job_photo_counts. */
export type JobPhotoCounts = {
  job_id: string;
  before_count: number;
  during_count: number;
  after_count: number;
  total_count: number;
};

export type JobExpense = {
  id: string;
  created_at: string;
  updated_at: string;

  job_id: string;

  category: ExpenseCategory;
  vendor: string | null;
  description: string;
  amount: number;
  expense_date: string;

  /** Caminho no bucket Supabase Storage `job-receipts`. */
  receipt_path: string | null;
  receipt_file_name: string | null;
  receipt_size: number | null;
  receipt_mime: string | null;

  notes: string | null;
};

/** Campos obrigatorios pra INSERT em job_expenses. */
export type JobExpenseInsert = Pick<
  JobExpense,
  "job_id" | "category" | "description" | "amount"
> &
  Partial<Omit<JobExpense, "id" | "created_at" | "updated_at">>;

/** Update parcial — qualquer campo opcional (job_id imutavel). */
export type JobExpenseUpdate = Partial<
  Omit<JobExpense, "id" | "created_at" | "updated_at" | "job_id">
>;

/** Linha agregada da view v_job_expense_summary. */
export type JobExpenseSummary = {
  job_id: string;
  expense_count: number;
  total_expenses: number;
  materials_total: number;
  labor_total: number;
  permit_total: number;
  subcontractor_total: number;
  equipment_total: number;
  transport_total: number;
  other_total: number;
};

/** Linha agregada da view v_job_margin. */
export type JobMargin = {
  job_id: string;
  contract_value: number;
  /** Soma de extras com status approved + completed. */
  approved_extras_value: number;
  /** contract_value + approved_extras_value. */
  effective_contract_value: number;
  total_expenses: number;
  total_labor: number;
  estimated_margin: number;
  margin_percent: number | null;
};

export type TeamMember = {
  id: string;
  created_at: string;
  updated_at: string;

  name: string;
  role: TeamRole;
  hourly_rate: number;
  phone: string | null;
  email: string | null;
  active: boolean;
  notes: string | null;
};

/** Campos obrigatorios pra INSERT em team_members. */
export type TeamMemberInsert = Pick<TeamMember, "name" | "hourly_rate"> &
  Partial<Omit<TeamMember, "id" | "created_at" | "updated_at">>;

/** Update parcial. */
export type TeamMemberUpdate = Partial<
  Omit<TeamMember, "id" | "created_at" | "updated_at">
>;

export type JobHours = {
  id: string;
  created_at: string;
  updated_at: string;

  job_id: string;
  member_id: string;

  work_date: string;
  hours: number;

  /** Snapshot da taxa do funcionário no momento do registro. */
  hourly_rate_snapshot: number;

  /** Coluna calculada pelo banco: hours × hourly_rate_snapshot. Read-only. */
  calculated_amount: number;

  notes: string | null;
};

/**
 * Campos obrigatorios pra INSERT em job_hours.
 * `calculated_amount` NUNCA entra no insert/update (GENERATED ALWAYS).
 */
export type JobHoursInsert = Pick<
  JobHours,
  "job_id" | "member_id" | "hours" | "hourly_rate_snapshot"
> &
  Partial<
    Omit<
      JobHours,
      "id" | "created_at" | "updated_at" | "calculated_amount"
    >
  >;

/** Update parcial (job_id, member_id e calculated_amount imutaveis). */
export type JobHoursUpdate = Partial<
  Omit<
    JobHours,
    | "id"
    | "created_at"
    | "updated_at"
    | "job_id"
    | "member_id"
    | "calculated_amount"
  >
>;

/** Linha agregada da view v_job_hours_summary. */
export type JobHoursSummary = {
  job_id: string;
  entry_count: number;
  total_hours: number;
  total_labor_cost: number;
};

export type JobExtra = {
  id: string;
  created_at: string;
  updated_at: string;

  job_id: string;

  title: string;
  description: string | null;
  /** Valor adicional cobrado por esse extra (USD). 0 = cortesia. */
  additional_value: number;

  status: ExtraStatus;

  proposed_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;

  approved_by_name: string | null;

  /** Anexo de prova de aprovação no bucket `job-extras`. */
  approval_attachment_path: string | null;
  approval_file_name: string | null;
  approval_mime: string | null;

  /** Anexo de contrato adicional formal (PDF) no bucket `job-extras`. */
  contract_attachment_path: string | null;
  contract_file_name: string | null;
  contract_mime: string | null;

  notes: string | null;
};

/** Campos obrigatorios pra INSERT em job_extras. */
export type JobExtraInsert = Pick<JobExtra, "job_id" | "title"> &
  Partial<Omit<JobExtra, "id" | "created_at" | "updated_at">>;

/** Update parcial (job_id imutável; created_at/updated_at gerenciados pelo banco). */
export type JobExtraUpdate = Partial<
  Omit<JobExtra, "id" | "created_at" | "updated_at" | "job_id">
>;

/** Linha agregada da view v_job_extras_summary. */
export type JobExtrasSummary = {
  job_id: string;
  total_extras: number;
  proposed_count: number;
  approved_count: number;
  rejected_count: number;
  completed_count: number;
  approved_value_total: number;
  proposed_value_total: number;
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
      tasks: {
        Row: Task;
        Insert: TaskInsert;
        Update: TaskUpdate;
        Relationships: [];
      };
      jobs: {
        Row: Job;
        Insert: JobInsert;
        Update: JobUpdate;
        Relationships: [];
      };
      job_phase_history: {
        Row: JobPhaseHistoryRow;
        Insert: Omit<JobPhaseHistoryRow, "id" | "started_at"> &
          Partial<Pick<JobPhaseHistoryRow, "id" | "started_at">>;
        Update: Partial<JobPhaseHistoryRow>;
        Relationships: [];
      };
      ad_spend: {
        Row: AdSpend;
        Insert: AdSpendInsert;
        Update: AdSpendUpdate;
        Relationships: [];
      };
      job_payments: {
        Row: JobPayment;
        Insert: JobPaymentInsert;
        Update: JobPaymentUpdate;
        Relationships: [];
      };
      job_photos: {
        Row: JobPhoto;
        Insert: JobPhotoInsert;
        Update: JobPhotoUpdate;
        Relationships: [];
      };
      job_expenses: {
        Row: JobExpense;
        Insert: JobExpenseInsert;
        Update: JobExpenseUpdate;
        Relationships: [];
      };
      team_members: {
        Row: TeamMember;
        Insert: TeamMemberInsert;
        Update: TeamMemberUpdate;
        Relationships: [];
      };
      job_hours: {
        Row: JobHours;
        Insert: JobHoursInsert;
        Update: JobHoursUpdate;
        Relationships: [];
      };
      job_extras: {
        Row: JobExtra;
        Insert: JobExtraInsert;
        Update: JobExtraUpdate;
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
      v_ad_spend_by_month: {
        Row: AdSpendByMonthRow;
        Relationships: [];
      };
      v_job_payment_summary: {
        Row: JobPaymentSummary;
        Relationships: [];
      };
      v_job_photo_counts: {
        Row: JobPhotoCounts;
        Relationships: [];
      };
      v_job_expense_summary: {
        Row: JobExpenseSummary;
        Relationships: [];
      };
      v_job_margin: {
        Row: JobMargin;
        Relationships: [];
      };
      v_job_hours_summary: {
        Row: JobHoursSummary;
        Relationships: [];
      };
      v_job_extras_summary: {
        Row: JobExtrasSummary;
        Relationships: [];
      };
    };
    Enums: {
      lead_stage: LeadStage;
      lead_source: LeadSource;
      service_type: ServiceType;
      lost_reason: LostReason;
      task_type: TaskType;
      task_status: TaskStatus;
      job_phase: JobPhase;
      payment_method: PaymentMethod;
      payment_kind: PaymentKind;
      payment_status: PaymentStatus;
      photo_category: PhotoCategory;
      expense_category: ExpenseCategory;
      team_role: TeamRole;
      extra_status: ExtraStatus;
    };
    Functions: Record<string, never>;
  };
};
