/**
 * Computa o estado da Jornada do Cliente (12 etapas).
 *
 * MANUAL: todas as etapas precisam ser marcadas pelo José explicitamente
 * via dialog (journey_milestones table). Sem auto-detection.
 *
 * Status de cada etapa:
 *   - completed: tem registro em journey_milestones (verde)
 *   - current:   é a próxima a fazer (primeira pending, dourado piscando)
 *   - pending:   ainda no futuro (cinza)
 */

import type { JourneyMilestone, JourneyMilestoneKind } from "./types";

export type JourneyStepStatus = "completed" | "current" | "pending";

export type JourneyStep = {
  kind: JourneyMilestoneKind;
  label: string;
  status: JourneyStepStatus;
  completedAt: string | null;
  /** Sempre true agora (todas etapas são manuais). */
  manual: boolean;
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

type ComputeInput = {
  milestones: JourneyMilestone[];
};

export function computeJourney(input: ComputeInput): JourneyStep[] {
  const { milestones } = input;

  // Mapa: kind → completed_at (override manual)
  const manualMap = new Map<JourneyMilestoneKind, string>();
  for (const m of milestones) {
    manualMap.set(m.kind, m.completed_at);
  }

  // Determina status na ordem das 12 etapas
  let currentSet = false;
  return JOURNEY_ORDER.map((kind) => {
    const completedAt = manualMap.get(kind) ?? null;
    let status: JourneyStepStatus;

    if (completedAt) {
      status = "completed";
    } else if (!currentSet) {
      status = "current";
      currentSet = true;
    } else {
      status = "pending";
    }

    return {
      kind,
      label: JOURNEY_LABEL[kind],
      status,
      completedAt,
      manual: true,
    };
  });
}

/** Conta quantas etapas estão concluídas (pra progresso %). */
export function countCompleted(steps: JourneyStep[]): number {
  return steps.filter((s) => s.status === "completed").length;
}

/** Retorna a etapa atual (current). */
export function currentStep(steps: JourneyStep[]): JourneyStep | null {
  return steps.find((s) => s.status === "current") ?? null;
}
