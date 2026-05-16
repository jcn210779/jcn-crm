import type {
  JobPhase,
  LeadSource,
  LeadStage,
  LostReason,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  PhotoCategory,
  ServiceType,
  TaskStatus,
  TaskType,
} from "./types";

/**
 * Labels em PT-BR pros enums do schema. Toda UI consome daqui — manter
 * fonte unica de verdade pra label visivel.
 */

export const STAGE_LABEL: Record<LeadStage, string> = {
  novo: "Novo",
  contato_feito: "Contato feito",
  visita_agendada: "Visita agendada",
  cotando: "Cotando",
  estimate_enviado: "Estimate enviado",
  follow_up: "Follow-up",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  lsa: "Google LSA",
  permit: "Permit Scraper",
  zillow: "Zillow",
  referral: "Indicação",
  direct: "Direto",
  other: "Outro",
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  deck: "Deck",
  siding: "Siding",
  patio: "Pátio de pedra",
  multiple: "Múltiplos serviços",
  other: "Outro",
};

export const LOST_REASON_LABEL: Record<LostReason, string> = {
  price: "Preço",
  no_show: "Não compareceu",
  ghosted: "Sumiu",
  chose_competitor: "Escolheu concorrente",
  not_ready: "Não estava pronto",
  out_of_scope: "Fora do escopo",
  other: "Outro",
};

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  call: "Ligação",
  sms: "SMS",
  email: "Email",
  visit: "Visita",
  followup: "Follow-up",
  internal: "Interno",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendente",
  done: "Feita",
  skipped: "Pulada",
  overdue: "Atrasada",
};

export const JOB_PHASE_LABEL: Record<JobPhase, string> = {
  planning: "Planejamento",
  permit_released: "Permit liberado",
  materials_ordered: "Material pedido",
  materials_delivered: "Material entregue",
  work_in_progress: "Trabalho em andamento",
  completed: "Concluído",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  check: "Cheque",
  cash: "Dinheiro",
  wire_transfer: "Transferência",
  credit_card: "Cartão de crédito",
  zelle: "Zelle",
  venmo: "Venmo",
  other: "Outro",
};

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  deposit: "Entrada",
  milestone: "Parcela",
  final: "Pagamento final",
  extra: "Extra",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  cancelled: "Cancelado",
};

export const PHOTO_CATEGORY_LABEL: Record<PhotoCategory, string> = {
  before: "Antes",
  during: "Durante",
  after: "Depois",
};

/** Cidades-alvo (top 15 + 6 vizinhas) pra autocomplete em /lead/novo. */
export const TARGET_CITIES: readonly string[] = [
  "Weston",
  "Dover",
  "Sherborn",
  "Wellesley",
  "Lincoln",
  "Carlisle",
  "Concord",
  "Sudbury",
  "Wayland",
  "Lexington",
  "Winchester",
  "Belmont",
  "Newton",
  "Needham",
  "Westwood",
  "Stoneham",
  "Wakefield",
  "Reading",
  "Burlington",
  "Wilmington",
  "Arlington",
  "Woburn",
] as const;
