/**
 * Computa o estado da Jornada do Cliente (12 etapas) a partir dos dados
 * existentes no CRM. Combina detecção automática + overrides manuais
 * (tabela journey_milestones).
 *
 * Status de cada etapa:
 *   - completed: já passou (verde)
 *   - current:   é a próxima a fazer (dourado piscando)
 *   - pending:   ainda no futuro (cinza)
 */

import type {
  Job,
  JobPayment,
  JourneyMilestone,
  JourneyMilestoneKind,
  Lead,
} from "./types";

export type JourneyStepStatus = "completed" | "current" | "pending";

export type JourneyStep = {
  kind: JourneyMilestoneKind;
  label: string;
  status: JourneyStepStatus;
  completedAt: string | null;
  /** Se true, este marco é manual (José precisa marcar pelo dialog). */
  manual: boolean;
  /** Se automático, qual dado do CRM disparou. */
  autoSource?: string;
};

export const JOURNEY_LABEL: Record<JourneyMilestoneKind, string> = {
  lead_registered: "Cadastro do lead",
  proposal_sent: "Envio Proposta",
  proposal_accepted: "Proposta aceita",
  contract_sent: "Envio do Contrato",
  contract_signed: "Contrato assinado",
  invoice_1_sent: "Invoice 1/3 enviada",
  permit_ok: "Aplicação Permit / Permit OK",
  invoice_2_sent: "Invoice 2/3 enviada",
  work_started: "Início da obra",
  work_in_progress: "Processo da obra",
  invoice_3_sent: "Invoice 3/3 enviada",
  delivered: "Entrega",
};

export const JOURNEY_ORDER: readonly JourneyMilestoneKind[] = [
  "lead_registered",
  "proposal_sent",
  "proposal_accepted",
  "contract_sent",
  "contract_signed",
  "invoice_1_sent",
  "permit_ok",
  "invoice_2_sent",
  "work_started",
  "work_in_progress",
  "invoice_3_sent",
  "delivered",
];

const ORDER_MAP: Record<string, number> = {
  planning: 0,
  permit_released: 1,
  materials_ordered: 2,
  materials_delivered: 3,
  work_in_progress: 4,
  completed: 5,
};

type ComputeInput = {
  lead: Pick<Lead, "id" | "created_at" | "stage"> | null;
  job: Pick<
    Job,
    "id" | "contract_signed_at" | "current_phase" | "actual_start" | "actual_end"
  > | null;
  payments: Pick<JobPayment, "id" | "status" | "received_at" | "created_at">[];
  milestones: JourneyMilestone[];
};

export function computeJourney(input: ComputeInput): JourneyStep[] {
  const { lead, job, payments, milestones } = input;

  // Mapa override manual: kind → completed_at
  const manualMap = new Map<JourneyMilestoneKind, string>();
  for (const m of milestones) {
    manualMap.set(m.kind, m.completed_at);
  }

  // Payments ordenados (1ª, 2ª, 3ª)
  const sortedPayments = [...payments].sort((a, b) =>
    (a.received_at ?? a.created_at).localeCompare(
      b.received_at ?? b.created_at,
    ),
  );
  const p1 = sortedPayments[0];
  const p2 = sortedPayments[1];
  const p3 = sortedPayments[2];

  const phaseOrder = job ? (ORDER_MAP[job.current_phase] ?? 0) : -1;
  const hasJob = !!job;

  const steps: Array<{
    kind: JourneyMilestoneKind;
    completedAt: string | null;
    manual: boolean;
    autoSource?: string;
  }> = JOURNEY_ORDER.map((kind) => {
    const manual = manualMap.get(kind);
    if (manual) {
      return { kind, completedAt: manual, manual: true };
    }

    // Lógica automática por kind
    switch (kind) {
      case "lead_registered":
        return lead
          ? {
              kind,
              completedAt: lead.created_at,
              manual: false,
              autoSource: "lead criado",
            }
          : { kind, completedAt: null, manual: false };

      case "proposal_sent":
        // estimate_enviado, follow_up, ganho — tudo conta como proposta enviada
        if (
          lead &&
          ["estimate_enviado", "follow_up", "ganho"].includes(lead.stage)
        ) {
          return {
            kind,
            completedAt: lead.created_at,
            manual: false,
            autoSource: `stage=${lead.stage}`,
          };
        }
        return { kind, completedAt: null, manual: false };

      case "proposal_accepted":
        // Manual ou ganho
        if (lead?.stage === "ganho") {
          return {
            kind,
            completedAt: hasJob ? job!.contract_signed_at : null,
            manual: false,
            autoSource: "lead=ganho",
          };
        }
        return { kind, completedAt: null, manual: false };

      case "contract_sent":
        // Manual — exige ação do José (ou job já existe = contrato implicitamente enviado)
        if (hasJob) {
          return {
            kind,
            completedAt: job!.contract_signed_at,
            manual: false,
            autoSource: "job existe",
          };
        }
        return { kind, completedAt: null, manual: false };

      case "contract_signed":
        return hasJob
          ? {
              kind,
              completedAt: job!.contract_signed_at,
              manual: false,
              autoSource: "contract_signed_at",
            }
          : { kind, completedAt: null, manual: false };

      case "invoice_1_sent":
        return p1
          ? {
              kind,
              completedAt: p1.received_at ?? p1.created_at,
              manual: false,
              autoSource: "1º job_payment",
            }
          : { kind, completedAt: null, manual: false };

      case "permit_ok":
        return phaseOrder >= 1
          ? {
              kind,
              completedAt: null,
              manual: false,
              autoSource: "phase>=permit_released",
            }
          : { kind, completedAt: null, manual: false };

      case "invoice_2_sent":
        return p2
          ? {
              kind,
              completedAt: p2.received_at ?? p2.created_at,
              manual: false,
              autoSource: "2º job_payment",
            }
          : { kind, completedAt: null, manual: false };

      case "work_started":
        if (hasJob && (job!.actual_start || phaseOrder >= 4)) {
          return {
            kind,
            completedAt: job!.actual_start,
            manual: false,
            autoSource: job!.actual_start
              ? "actual_start preenchido"
              : "phase>=work_in_progress",
          };
        }
        return { kind, completedAt: null, manual: false };

      case "work_in_progress":
        return hasJob && phaseOrder >= 4
          ? {
              kind,
              completedAt: null,
              manual: false,
              autoSource: "phase=work_in_progress+",
            }
          : { kind, completedAt: null, manual: false };

      case "invoice_3_sent":
        return p3
          ? {
              kind,
              completedAt: p3.received_at ?? p3.created_at,
              manual: false,
              autoSource: "3º job_payment",
            }
          : { kind, completedAt: null, manual: false };

      case "delivered":
        return hasJob && phaseOrder >= 5
          ? {
              kind,
              completedAt: job!.actual_end,
              manual: false,
              autoSource: "phase=completed",
            }
          : { kind, completedAt: null, manual: false };
    }
  });

  // Determina status: completed se tem completedAt OU autoSource. Current = primeiro pending.
  let currentSet = false;
  const result: JourneyStep[] = steps.map((s) => {
    const isCompleted = !!s.completedAt || !!s.autoSource;
    let status: JourneyStepStatus;
    if (isCompleted) {
      status = "completed";
    } else if (!currentSet) {
      status = "current";
      currentSet = true;
    } else {
      status = "pending";
    }
    return {
      kind: s.kind,
      label: JOURNEY_LABEL[s.kind],
      status,
      completedAt: s.completedAt,
      manual: s.manual,
      autoSource: s.autoSource,
    };
  });

  return result;
}

/** Conta quantas etapas estão concluídas (pra progresso %). */
export function countCompleted(steps: JourneyStep[]): number {
  return steps.filter((s) => s.status === "completed").length;
}

/** Retorna a etapa atual (current). */
export function currentStep(steps: JourneyStep[]): JourneyStep | null {
  return steps.find((s) => s.status === "current") ?? null;
}
