"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, History } from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import {
  SUBCONTRACTOR_RATE_TYPE_LABEL,
  SUBCONTRACTOR_SPECIALTY_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  SUBCONTRACTOR_RATE_TYPES,
  SUBCONTRACTOR_SPECIALTIES,
  type Subcontractor,
  type SubcontractorRateType,
  type SubcontractorSpecialty,
  type SubcontractorStats,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  sub: Subcontractor;
  stats: SubcontractorStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

type Mode = "edit" | "confirm-delete" | "confirm-deactivate";

export function EditSubDialog({
  sub,
  stats,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [name, setName] = useState(sub.name);
  const [companyName, setCompanyName] = useState(sub.company_name ?? "");
  const [specialty, setSpecialty] = useState<SubcontractorSpecialty>(
    sub.specialty,
  );
  const [specialtyDetail, setSpecialtyDetail] = useState(
    sub.specialty_detail ?? "",
  );
  const [rateType, setRateType] = useState<SubcontractorRateType>(
    sub.default_rate_type,
  );
  const [defaultRate, setDefaultRate] = useState(
    sub.default_rate !== null ? String(sub.default_rate) : "",
  );
  const [phone, setPhone] = useState(sub.phone ?? "");
  const [email, setEmail] = useState(sub.email ?? "");
  const [address, setAddress] = useState(sub.address ?? "");
  const [active, setActive] = useState(sub.active);
  const [preferred, setPreferred] = useState(sub.preferred);
  const [licenseNumber, setLicenseNumber] = useState(sub.license_number ?? "");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState(
    sub.license_expires_at ?? "",
  );
  const [insuranceExpiresAt, setInsuranceExpiresAt] = useState(
    sub.insurance_expires_at ?? "",
  );
  const [notes, setNotes] = useState(sub.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [confirmText, setConfirmText] = useState("");

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome do subempreiteiro");
      return;
    }

    let rate: number | null = null;
    if (defaultRate.trim()) {
      const parsed = Number(defaultRate.replace(/[^0-9.]/g, ""));
      if (Number.isNaN(parsed) || parsed < 0) {
        toast.error("Taxa de referência inválida");
        return;
      }
      rate = parsed;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("subcontractors")
      .update({
        name: name.trim(),
        company_name: companyName.trim() || null,
        specialty,
        specialty_detail: specialtyDetail.trim() || null,
        default_rate_type: rateType,
        default_rate: rate,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        active,
        preferred,
        license_number: licenseNumber.trim() || null,
        license_expires_at: licenseExpiresAt || null,
        insurance_expires_at: insuranceExpiresAt || null,
        notes: notes.trim() || null,
      })
      .eq("id", sub.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }

    toast.success("Subempreiteiro atualizado");
    if (onDone) onDone();
  }

  async function attemptDelete() {
    if (confirmText.toLowerCase() !== "excluir") {
      toast.error('Digite "excluir" pra confirmar');
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("subcontractors")
      .delete()
      .eq("id", sub.id);

    if (error) {
      setSaving(false);
      const isFkBlock =
        error.code === "23503" ||
        error.message.toLowerCase().includes("foreign key");
      if (isFkBlock) {
        setMode("confirm-deactivate");
        toast.message(
          "Este sub tem contratações em jobs. Só posso desativar.",
        );
        return;
      }
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }

    setSaving(false);
    toast.success("Subempreiteiro excluído");
    if (onDone) onDone();
  }

  async function deactivate() {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("subcontractors")
      .update({ active: false })
      .eq("id", sub.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao desativar", { description: error.message });
      return;
    }

    toast.success("Subempreiteiro desativado");
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
              Excluir subempreiteiro
            </DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4">
              <p className="text-sm font-semibold text-jcn-ice">{sub.name}</p>
              <p className="mt-1 text-xs text-jcn-ice/55">
                {SUBCONTRACTOR_SPECIALTY_LABEL[sub.specialty]}
              </p>
              <p className="mt-2 text-xs text-rose-300/80">
                Se ele tiver contratações registradas em jobs, vou oferecer
                desativar em vez de excluir.
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
              Este sub tem contratações registradas em pelo menos um job. Pra
              preservar o histórico, não dá pra excluir. Posso desativar agora,
              e o cadastro fica oculto da lista de seleção em novas
              contratações.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
            <p className="text-sm font-semibold text-jcn-ice">{sub.name}</p>
            <p className="mt-1 text-xs text-jcn-ice/55">
              {SUBCONTRACTOR_SPECIALTY_LABEL[sub.specialty]}
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
              {saving ? "Desativando..." : "Desativar subempreiteiro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mode: edit
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar subempreiteiro</DialogTitle>
          <DialogDescription>
            Atualize dados, alterne entre ativo e inativo ou exclua se nunca
            foi usado.
          </DialogDescription>
        </DialogHeader>

        {/* Histórico (read-only) */}
        {stats && stats.total_jobs > 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-jcn-gold-400/20 bg-jcn-gold-500/5 p-3">
            <History className="h-5 w-5 text-jcn-gold-300" />
            <div className="flex-1 text-xs text-jcn-ice/70">
              <span className="font-bold text-jcn-gold-300">
                {stats.completed_jobs} de {stats.total_jobs}
              </span>{" "}
              jobs concluídos · total pago{" "}
              <span className="font-bold text-jcn-gold-300">
                {formatCurrency(Number(stats.total_value_paid))}
              </span>
              {stats.last_hired_at && (
                <>
                  {" · último contratado em "}
                  {format(new Date(stats.last_hired_at), "d 'de' MMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-3 text-xs italic text-jcn-ice/40">
            Sem histórico de contratações ainda.
          </div>
        )}

        <div className="space-y-5 py-2">
          {/* Identificação */}
          <FieldGroup label="Identificação">
            <div className="space-y-1.5">
              <Label htmlFor="sub-edit-name">Nome do contato *</Label>
              <Input
                id="sub-edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-edit-company">Empresa (opcional)</Label>
              <Input
                id="sub-edit-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </FieldGroup>

          {/* Especialidade */}
          <FieldGroup label="Especialidade">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-edit-specialty">Área *</Label>
                <select
                  id="sub-edit-specialty"
                  className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                  value={specialty}
                  onChange={(e) =>
                    setSpecialty(e.target.value as SubcontractorSpecialty)
                  }
                >
                  {SUBCONTRACTOR_SPECIALTIES.map((sp) => (
                    <option key={sp} value={sp}>
                      {SUBCONTRACTOR_SPECIALTY_LABEL[sp]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-edit-detail">Detalhe (opcional)</Label>
                <Input
                  id="sub-edit-detail"
                  value={specialtyDetail}
                  onChange={(e) => setSpecialtyDetail(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-edit-rate-type">Tipo de taxa</Label>
                <select
                  id="sub-edit-rate-type"
                  className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                  value={rateType}
                  onChange={(e) =>
                    setRateType(e.target.value as SubcontractorRateType)
                  }
                >
                  {SUBCONTRACTOR_RATE_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {SUBCONTRACTOR_RATE_TYPE_LABEL[rt]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-edit-rate">Taxa de referência ($)</Label>
                <Input
                  id="sub-edit-rate"
                  type="text"
                  inputMode="decimal"
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(e.target.value)}
                />
              </div>
            </div>
          </FieldGroup>

          {/* Contato */}
          <FieldGroup label="Contato">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-edit-phone">Telefone</Label>
                <Input
                  id="sub-edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-edit-email">Email</Label>
                <Input
                  id="sub-edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-edit-address">Endereço</Label>
              <Input
                id="sub-edit-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </FieldGroup>

          {/* Documentos */}
          <FieldGroup label="Documentos">
            <div className="space-y-1.5">
              <Label htmlFor="sub-edit-license">Número da licença</Label>
              <Input
                id="sub-edit-license"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-edit-license-exp">Licença vence em</Label>
                <Input
                  id="sub-edit-license-exp"
                  type="date"
                  value={licenseExpiresAt}
                  onChange={(e) => setLicenseExpiresAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-edit-insurance-exp">Seguro vence em</Label>
                <Input
                  id="sub-edit-insurance-exp"
                  type="date"
                  value={insuranceExpiresAt}
                  onChange={(e) => setInsuranceExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </FieldGroup>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-edit-notes">Notas</Label>
            <Textarea
              id="sub-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
            <button
              type="button"
              onClick={() => setPreferred((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition",
                preferred
                  ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
                  : "border-white/[0.1] bg-white/[0.04] text-jcn-ice/55",
              )}
            >
              <span>{preferred ? "Preferido" : "Marcar preferido"}</span>
              <span
                className={cn(
                  "flex h-6 w-11 items-center rounded-full p-0.5 transition",
                  preferred
                    ? "justify-end bg-jcn-gold-400/60"
                    : "bg-white/[0.1]",
                )}
              >
                <span className="h-5 w-5 rounded-full bg-white shadow" />
              </span>
            </button>
          </div>
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

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-jcn-ice/45">
        {label}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
