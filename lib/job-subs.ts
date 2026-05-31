/**
 * Helpers + tipos do módulo job_subcontractors.
 * Suporta o JOIN com subcontractors(name, specialty) feito no Server Component.
 */

import type { JobSubcontractor, SubcontractorSpecialty } from "@/lib/types";

/** Snapshot mínimo do sub embutido na linha do job_subcontractors. */
export type SubLite = {
  id: string;
  name: string;
  company_name: string | null;
  specialty: SubcontractorSpecialty;
  default_rate: number | null;
  preferred: boolean;
};

/** Linha de job_subcontractors com sub aninhado (vinda do JOIN). */
export type JobSubcontractorWithSub = JobSubcontractor & {
  sub: Pick<
    SubLite,
    "id" | "name" | "company_name" | "specialty"
  > | null;
};

/** Snapshot pra select de subs ativos (lado cliente do dialog de contratação). */
export type ActiveSubOption = SubLite;

// =============================================================================
// Status de pagamento DERIVADO (migration 0036)
// Calculado a partir de amount_paid vs agreed_value — NÃO é enum no banco.
// =============================================================================

export type SubPaymentStatus = "unpaid" | "partial" | "paid";

/**
 * Deriva o status de pagamento do sub a partir do valor pago e do combinado.
 * - amount_paid <= 0                  -> "unpaid"  (Não pago)
 * - 0 < amount_paid < agreed_value    -> "partial" (Parcial)
 * - amount_paid >= agreed_value (>0)  -> "paid"    (Pago)
 *
 * Edge: agreed_value = 0. Se já pagou algo, considera "paid"; senão "unpaid".
 */
export function deriveSubPaymentStatus(args: {
  agreedValue: number;
  amountPaid: number;
}): SubPaymentStatus {
  const agreed = Number(args.agreedValue) || 0;
  const paid = Number(args.amountPaid) || 0;

  if (paid <= 0) return "unpaid";
  if (agreed <= 0) return "paid";
  if (paid < agreed) return "partial";
  return "paid";
}

/** Saldo a pagar ao sub (nunca negativo). */
export function subRemainingBalance(args: {
  agreedValue: number;
  amountPaid: number;
}): number {
  const agreed = Number(args.agreedValue) || 0;
  const paid = Number(args.amountPaid) || 0;
  return Math.max(0, agreed - paid);
}
