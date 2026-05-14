import type {
  LeadSource,
  LeadStage,
  LostReason,
  ServiceType,
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
