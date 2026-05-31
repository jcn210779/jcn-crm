"use client";

import { LeadForm } from "@/components/lead/lead-form";

/**
 * Form de cadastro de lead (rota /lead/novo). Wrapper fino sobre o form
 * compartilhado LeadForm em modo "create" — a validação, os campos e a
 * persistência vivem em lead-form.tsx (fonte única, sem duplicação).
 */
export function NewLeadForm() {
  return <LeadForm mode="create" />;
}
