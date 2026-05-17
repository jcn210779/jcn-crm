import type {
  BusinessExpenseCategory,
  DailyLogType,
  ExpenseCategory,
  ExtraStatus,
  JobPhase,
  JobSubcontractorStatus,
  LeadSource,
  LeadStage,
  LostReason,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  PhotoCategory,
  ServiceType,
  SubcontractorRateType,
  SubcontractorSpecialty,
  TaskStatus,
  TaskType,
  TeamRole,
  WeatherCondition,
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

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  materials: "Material",
  labor: "Mão de obra",
  permit: "Permit / Taxas",
  subcontractor: "Subempreiteiro",
  equipment: "Equipamento",
  transport: "Transporte",
  other: "Outros",
};

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  helper: "Helper",
  skilled: "Skilled (técnico)",
  foreman: "Foreman (líder)",
  subcontractor: "Subempreiteiro",
  other: "Outro",
};

export const EXTRA_STATUS_LABEL: Record<ExtraStatus, string> = {
  proposed: "Proposto",
  approved: "Aprovado",
  rejected: "Rejeitado",
  completed: "Concluído",
};

export const SUBCONTRACTOR_SPECIALTY_LABEL: Record<
  SubcontractorSpecialty,
  string
> = {
  electrical: "Elétrica",
  plumbing: "Encanamento",
  painting: "Pintura",
  roofing: "Telhado",
  concrete: "Concreto",
  framing: "Estrutura",
  hvac: "HVAC (ar/aquecimento)",
  landscaping: "Paisagismo",
  flooring: "Piso",
  masonry: "Alvenaria",
  other: "Outro",
};

export const SUBCONTRACTOR_RATE_TYPE_LABEL: Record<
  SubcontractorRateType,
  string
> = {
  per_service: "Por serviço",
  hourly: "Por hora",
  per_unit: "Por unidade",
};

export const JOB_SUBCONTRACTOR_STATUS_LABEL: Record<
  JobSubcontractorStatus,
  string
> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const WEATHER_LABEL: Record<WeatherCondition, string> = {
  sunny: "Sol",
  cloudy: "Nublado",
  rainy: "Chuva",
  stormy: "Tempestade",
  snowy: "Neve",
  windy: "Vento",
  hot: "Calor extremo",
  cold: "Frio extremo",
  other: "Outro",
};

export const WEATHER_EMOJI: Record<WeatherCondition, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  stormy: "⛈️",
  snowy: "❄️",
  windy: "💨",
  hot: "🥵",
  cold: "🥶",
  other: "🌤️",
};

export const DAILY_LOG_TYPE_LABEL: Record<DailyLogType, string> = {
  progress: "Progresso",
  problem: "Problema",
  blocker: "Bloqueio",
  observation: "Observação",
  inspection: "Inspeção",
  client_visit: "Visita do cliente",
};

export const DAILY_LOG_TYPE_EMOJI: Record<DailyLogType, string> = {
  progress: "✅",
  problem: "⚠️",
  blocker: "🛑",
  observation: "💡",
  inspection: "🔍",
  client_visit: "👤",
};

export const BUSINESS_EXPENSE_CATEGORY_LABEL: Record<
  BusinessExpenseCategory,
  string
> = {
  credit_card_payment: "Pagamento de cartão",
  insurance: "Seguro",
  vehicle_fuel: "Gasolina/combustível",
  vehicle_maintenance: "Manutenção veículo",
  vehicle_finance: "Parcela do veículo",
  phone: "Telefone",
  internet: "Internet",
  software: "Software/SaaS",
  accounting: "Contador",
  legal: "Jurídico/licenças",
  office_supplies: "Material de escritório",
  rent: "Aluguel",
  utilities: "Luz/água/gás",
  bank_fees: "Tarifas bancárias",
  taxes: "Impostos",
  marketing_other: "Marketing (outros)",
  training: "Cursos/certificações",
  other: "Outros",
};

/** Agrupamento visual das categorias de business_expenses pro select. */
export const BUSINESS_EXPENSE_CATEGORY_GROUPS: ReadonlyArray<{
  label: string;
  items: readonly BusinessExpenseCategory[];
}> = [
  {
    label: "Cartão de crédito",
    items: ["credit_card_payment"],
  },
  {
    label: "Veículo",
    items: ["vehicle_fuel", "vehicle_maintenance", "vehicle_finance"],
  },
  {
    label: "Operacional",
    items: ["rent", "utilities", "phone", "internet", "office_supplies"],
  },
  {
    label: "Profissional",
    items: ["insurance", "accounting", "legal", "software", "training"],
  },
  {
    label: "Financeiro",
    items: ["bank_fees", "taxes"],
  },
  {
    label: "Marketing",
    items: ["marketing_other"],
  },
  {
    label: "Outros",
    items: ["other"],
  },
];

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
