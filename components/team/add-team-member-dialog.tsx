"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TEAM_ROLE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { TEAM_ROLES, type TeamPayType, type TeamRole } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

export function AddTeamMemberDialog({ open, onOpenChange, onDone }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<TeamRole>("helper");
  const [payType, setPayType] = useState<TeamPayType>("hourly");
  const [hourlyRate, setHourlyRate] = useState("");
  const [weeklySalary, setWeeklySalary] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setRole("helper");
    setPayType("hourly");
    setHourlyRate("");
    setWeeklySalary("");
    setPhone("");
    setEmail("");
    setNotes("");
    setSaving(false);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Informe o nome do funcionário");
      return;
    }
    const rate = Number(hourlyRate.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(rate) || rate < 0) {
      toast.error("Taxa por hora inválida");
      return;
    }
    let salary: number | null = null;
    if (payType === "weekly") {
      salary = Number(weeklySalary.replace(/[^0-9.]/g, ""));
      if (Number.isNaN(salary) || salary <= 0) {
        toast.error("Salário semanal inválido");
        return;
      }
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("team_members").insert({
      name: name.trim(),
      role,
      pay_type: payType,
      hourly_rate: rate,
      weekly_salary: salary,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
      active: true,
    });

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar funcionário", {
        description: error.message,
      });
      return;
    }

    toast.success("Funcionário adicionado");
    reset();
    if (onDone) onDone();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar funcionário</DialogTitle>
          <DialogDescription>
            Vai ficar disponível pra registrar horas em qualquer job.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tm-name">Nome *</Label>
            <Input
              id="tm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João da Silva"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm-role">Papel</Label>
              <select
                id="tm-role"
                className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                value={role}
                onChange={(e) => setRole(e.target.value as TeamRole)}
              >
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {TEAM_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-pay-type">Tipo de pagamento</Label>
              <select
                id="tm-pay-type"
                className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                value={payType}
                onChange={(e) => setPayType(e.target.value as TeamPayType)}
              >
                <option value="hourly">Por hora</option>
                <option value="weekly">Salário semanal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm-rate">
                Taxa ($/h) *
                {payType === "weekly" && (
                  <span className="ml-1 text-[10px] text-jcn-ice/45">
                    (rateio P&amp;L)
                  </span>
                )}
              </Label>
              <Input
                id="tm-rate"
                type="text"
                inputMode="decimal"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="25.00"
              />
              {payType === "weekly" && (
                <p className="text-[10px] text-jcn-ice/45">
                  Sugestão: salário ÷ 40h
                </p>
              )}
            </div>
            {payType === "weekly" && (
              <div className="space-y-1.5">
                <Label htmlFor="tm-weekly">Salário semanal ($) *</Label>
                <Input
                  id="tm-weekly"
                  type="text"
                  inputMode="decimal"
                  value={weeklySalary}
                  onChange={(e) => setWeeklySalary(e.target.value)}
                  placeholder="1300.00"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm-phone">Telefone</Label>
              <Input
                id="tm-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(857) 555-1234"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-email">Email</Label>
              <Input
                id="tm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@email.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tm-notes">Notas (opcional)</Label>
            <Textarea
              id="tm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observações..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar funcionário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
