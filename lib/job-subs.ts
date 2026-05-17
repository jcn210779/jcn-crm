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
