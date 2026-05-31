"use client";

import { LeadForm } from "@/components/lead/lead-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lead } from "@/lib/types";

/**
 * Dialog que abre a partir do detalhe do lead pra editar todos os dados
 * cadastrais. Reusa o LeadForm compartilhado em modo "edit", pré-preenchido
 * com os valores atuais. Persistência via supabase browser client (RLS
 * owner-only, mesma rota da criação) — refresh acontece dentro do form.
 */
type Props = {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeadEditDialog({ lead, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar lead</DialogTitle>
          <DialogDescription>
            Corrija os dados cadastrais de {lead.name}.
          </DialogDescription>
        </DialogHeader>
        <LeadForm
          mode="edit"
          lead={lead}
          embedded
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
