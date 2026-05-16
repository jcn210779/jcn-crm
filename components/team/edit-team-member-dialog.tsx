"use client";

import { AlertTriangle } from "lucide-react";
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
import { TEAM_ROLES, type TeamMember, type TeamRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

type Mode = "edit" | "confirm-delete" | "confirm-deactivate";

export function EditTeamMemberDialog({
  member,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<TeamRole>(member.role);
  const [hourlyRate, setHourlyRate] = useState(String(member.hourly_rate));
  const [phone, setPhone] = useState(member.phone ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [notes, setNotes] = useState(member.notes ?? "");
  const [active, setActive] = useState(member.active);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [confirmText, setConfirmText] = useState("");

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome do funcionário");
      return;
    }
    const rate = Number(hourlyRate.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(rate) || rate < 0) {
      toast.error("Taxa por hora inválida");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("team_members")
      .update({
        name: name.trim(),
        role,
        hourly_rate: rate,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        active,
      })
      .eq("id", member.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }

    toast.success("Funcionário atualizado");
    if (onDone) onDone();
  }

  async function attemptDelete() {
    if (confirmText.toLowerCase() !== "excluir") {
      toast.error('Digite "excluir" pra confirmar');
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // Tenta DELETE — se tiver horas registradas o RESTRICT do banco bloqueia
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      setSaving(false);
      // FK RESTRICT: 23503 (foreign_key_violation)
      const isFkBlock =
        error.code === "23503" ||
        error.message.toLowerCase().includes("foreign key");
      if (isFkBlock) {
        setMode("confirm-deactivate");
        toast.message(
          "Funcionário tem horas registradas em jobs. Só posso desativar.",
        );
        return;
      }
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }

    setSaving(false);
    toast.success("Funcionário excluído");
    if (onDone) onDone();
  }

  async function deactivate() {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("team_members")
      .update({ active: false })
      .eq("id", member.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao desativar", { description: error.message });
      return;
    }

    toast.success("Funcionário desativado");
    if (onDone) onDone();
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode("edit");
      setConfirmText("");
    }
    onOpenChange(next);
  }

  // Mode: confirm delete
  if (mode === "confirm-delete") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-300">
              <AlertTriangle className="h-5 w-5" />
              Excluir funcionário
            </DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4">
              <p className="text-sm font-semibold text-jcn-ice">
                {member.name}
              </p>
              <p className="mt-1 text-xs text-jcn-ice/55">
                {TEAM_ROLE_LABEL[member.role]}
              </p>
              <p className="mt-2 text-xs text-rose-300/80">
                Se ele tiver horas registradas em jobs, vou oferecer desativar
                em vez de excluir.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-jcn-ice/55">
                Pra confirmar, digite <strong>excluir</strong>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="flex h-10 w-full rounded-md border border-rose-400/30 bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-rose-400"
                placeholder="excluir"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setMode("edit");
                setConfirmText("");
              }}
              disabled={saving}
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={attemptDelete}
              disabled={saving || confirmText.toLowerCase() !== "excluir"}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              {saving ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mode: confirm deactivate (após FK block)
  if (mode === "confirm-deactivate") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Desativar em vez de excluir
            </DialogTitle>
            <DialogDescription>
              Este funcionário tem horas registradas em pelo menos um job.
              Pra preservar o histórico, não dá pra excluir. Posso desativar
              ele agora, e o cadastro fica oculto da lista de seleção em novos
              registros.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
            <p className="text-sm font-semibold text-jcn-ice">{member.name}</p>
            <p className="mt-1 text-xs text-jcn-ice/55">
              {TEAM_ROLE_LABEL[member.role]}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setMode("edit")}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={deactivate} disabled={saving}>
              {saving ? "Desativando..." : "Desativar funcionário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mode: edit
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar funcionário</DialogTitle>
          <DialogDescription>
            Atualize dados ou alterne entre ativo e inativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tm-edit-name">Nome *</Label>
            <Input
              id="tm-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm-edit-role">Papel</Label>
              <select
                id="tm-edit-role"
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
              <Label htmlFor="tm-edit-rate">Taxa ($/h) *</Label>
              <Input
                id="tm-edit-rate"
                type="text"
                inputMode="decimal"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm-edit-phone">Telefone</Label>
              <Input
                id="tm-edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-edit-email">Email</Label>
              <Input
                id="tm-edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tm-edit-notes">Notas</Label>
            <Textarea
              id="tm-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Toggle Active */}
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition",
              active
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                : "border-white/[0.1] bg-white/[0.04] text-jcn-ice/55",
            )}
          >
            <span>{active ? "Ativo" : "Inativo"}</span>
            <span
              className={cn(
                "flex h-6 w-11 items-center rounded-full p-0.5 transition",
                active ? "justify-end bg-emerald-400/60" : "bg-white/[0.1]",
              )}
            >
              <span className="h-5 w-5 rounded-full bg-white shadow" />
            </span>
          </button>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setMode("confirm-delete")}
            disabled={saving}
            className="text-rose-300/80 hover:text-rose-300"
          >
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
