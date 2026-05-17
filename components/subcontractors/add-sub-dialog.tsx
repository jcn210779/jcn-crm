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
import {
  SUBCONTRACTOR_RATE_TYPE_LABEL,
  SUBCONTRACTOR_SPECIALTY_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  SUBCONTRACTOR_RATE_TYPES,
  SUBCONTRACTOR_SPECIALTIES,
  type SubcontractorRateType,
  type SubcontractorSpecialty,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

export function AddSubDialog({ open, onOpenChange, onDone }: Props) {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [specialty, setSpecialty] = useState<SubcontractorSpecialty>("other");
  const [specialtyDetail, setSpecialtyDetail] = useState("");
  const [rateType, setRateType] =
    useState<SubcontractorRateType>("per_service");
  const [defaultRate, setDefaultRate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [preferred, setPreferred] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState("");
  const [insuranceExpiresAt, setInsuranceExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setCompanyName("");
    setSpecialty("other");
    setSpecialtyDetail("");
    setRateType("per_service");
    setDefaultRate("");
    setPhone("");
    setEmail("");
    setAddress("");
    setPreferred(false);
    setLicenseNumber("");
    setLicenseExpiresAt("");
    setInsuranceExpiresAt("");
    setNotes("");
    setSaving(false);
  }

  async function handleSubmit() {
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
    const { error } = await supabase.from("subcontractors").insert({
      name: name.trim(),
      company_name: companyName.trim() || null,
      specialty,
      specialty_detail: specialtyDetail.trim() || null,
      default_rate_type: rateType,
      default_rate: rate,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      active: true,
      preferred,
      license_number: licenseNumber.trim() || null,
      license_expires_at: licenseExpiresAt || null,
      insurance_expires_at: insuranceExpiresAt || null,
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar subempreiteiro", {
        description: error.message,
      });
      return;
    }

    toast.success("Subempreiteiro adicionado");
    reset();
    if (onDone) onDone();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar subempreiteiro</DialogTitle>
          <DialogDescription>
            Fica disponível pra contratar em qualquer job.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identificação */}
          <FieldGroup label="Identificação">
            <div className="space-y-1.5">
              <Label htmlFor="sub-name">Nome do contato *</Label>
              <Input
                id="sub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Carlos Silva"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-company">Empresa (opcional)</Label>
              <Input
                id="sub-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Silva Elétrica LLC"
              />
            </div>
          </FieldGroup>

          {/* Especialidade */}
          <FieldGroup label="Especialidade">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-specialty">Área *</Label>
                <select
                  id="sub-specialty"
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
                <Label htmlFor="sub-detail">Detalhe (opcional)</Label>
                <Input
                  id="sub-detail"
                  value={specialtyDetail}
                  onChange={(e) => setSpecialtyDetail(e.target.value)}
                  placeholder="Elétrica residencial"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-rate-type">Tipo de taxa</Label>
                <select
                  id="sub-rate-type"
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
                <Label htmlFor="sub-rate">Taxa de referência ($)</Label>
                <Input
                  id="sub-rate"
                  type="text"
                  inputMode="decimal"
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(e.target.value)}
                  placeholder="1500.00"
                />
              </div>
            </div>
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
              <span>
                {preferred
                  ? "Marcado como preferido"
                  : "Marcar como preferido"}
              </span>
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
          </FieldGroup>

          {/* Contato */}
          <FieldGroup label="Contato">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-phone">Telefone</Label>
                <Input
                  id="sub-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(857) 555-1234"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-email">Email</Label>
                <Input
                  id="sub-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@email.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-address">Endereço (opcional)</Label>
              <Input
                id="sub-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Woburn MA"
              />
            </div>
          </FieldGroup>

          {/* Documentos */}
          <FieldGroup label="Documentos (opcional)">
            <div className="space-y-1.5">
              <Label htmlFor="sub-license">Número da licença</Label>
              <Input
                id="sub-license"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="EL-12345"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-license-exp">Licença vence em</Label>
                <Input
                  id="sub-license-exp"
                  type="date"
                  value={licenseExpiresAt}
                  onChange={(e) => setLicenseExpiresAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-insurance-exp">Seguro vence em</Label>
                <Input
                  id="sub-insurance-exp"
                  type="date"
                  value={insuranceExpiresAt}
                  onChange={(e) => setInsuranceExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </FieldGroup>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-notes">Notas (opcional)</Label>
            <Textarea
              id="sub-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observações sobre qualidade, prazo, preço típico..."
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
            {saving ? "Salvando..." : "Salvar subempreiteiro"}
          </Button>
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
