/**
 * Helpers de tipo pra horas trabalhadas em jobs (Fase 4.2E).
 *
 * Tipos auxiliares pros components consumirem horas com JOIN no team_members
 * (puxa nome + role pra mostrar na UI sem 2ª chamada).
 */

import type { JobHours, TeamMember, TeamRole } from "@/lib/types";

/** Sub-conjunto de team_members carregado junto de cada job_hours via select JOIN. */
export type TeamMemberJoin = Pick<TeamMember, "id" | "name" | "role">;

/** Entrada de horas com dados do funcionário embutidos (via supabase select). */
export type JobHoursWithMember = JobHours & {
  member: TeamMemberJoin | null;
};

/** Sub-conjunto de team_members usado nos selects de dialog (versão leve). */
export type TeamMemberLite = Pick<
  TeamMember,
  "id" | "name" | "role" | "hourly_rate"
> & { role: TeamRole };
