"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { lastNMonths, monthLabelPT } from "@/lib/dashboard-metrics";
import { PAYMENT_METHOD_LABEL, SOURCE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  LEAD_SOURCES,
  PAYMENT_METHODS,
  type AdSpend,
  type AdSpendInsert,
  type LeadSource,
  type PaymentMethod,
} from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mês inicial selecionado (YYYY-MM). */
  month: string;
  /** Todas as linhas existentes em ad_spend (qualquer mês). */
  existingSpends: AdSpend[];
};

/**
 * Dialog pra editar o spend mensal por fonte.
 *
 * UX:
 * - Datepicker tipo seletor de mês (YYYY-MM, default = mês passado pelo pai)
 * - 1 input numérico por fonte
 * - Carrega valor atual se já existir entry em ad_spend pra esse mês × fonte
 * - Submit: UPSERT (one-shot) com onConflict month,source
 */
export function EditSpendDialog({
  open,
  onOpenChange,
  month: initialMonth,
  existingSpends,
}: Props) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [saving, setSaving] = useState(false);
  const [amounts, setAmounts] = useState<Record<LeadSource, string>>(
    () => emptyAmounts(),
  );
  const [methods, setMethods] = useState<Record<LeadSource, PaymentMethod>>(
    () => defaultMethods(),
  );

  // Lista de meses pro seletor: últimos 12 (mais recente primeiro)
  const monthOptions = useMemo(() => lastNMonths(12), []);

  // Sempre que abrir o dialog OU mudar o mês, recarrega valores
  useEffect(() => {
    if (!open) return;
    const next: Record<LeadSource, string> = emptyAmounts();
    const nextMethods: Record<LeadSource, PaymentMethod> = defaultMethods();
    for (const s of existingSpends) {
      if (s.month.slice(0, 7) === month) {
        next[s.source] = String(s.amount);
        if (s.payment_method) {
          nextMethods[s.source] = s.payment_method;
        }
      }
    }
    setAmounts(next);
    setMethods(nextMethods);
  }, [open, month, existingSpends]);

  // Quando abre, sincroniza com initialMonth (se o pai trocou o mês selecionado)
  useEffect(() => {
    if (open) setMonth(initialMonth);
  }, [open, initialMonth]);

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Monta payload — só envia linhas que tenham valor preenchido (incluindo 0)
      const rows: AdSpendInsert[] = [];
      for (const src of LEAD_SOURCES) {
        const raw = (amounts[src] ?? "").trim();
        if (raw === "") continue;
        const parsed = Number(raw.replace(/[^0-9.]/g, ""));
        if (Number.isNaN(parsed) || parsed < 0) {
          toast.error(`Valor inválido em ${SOURCE_LABEL[src]}`);
          setSaving(false);
          return;
        }
        rows.push({
          month: `${month}-01`,
          source: src,
          amount: parsed,
          payment_method: methods[src],
        });
      }

      if (rows.length === 0) {
        toast.info("Nenhum valor pra salvar.");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("ad_spend")
        .upsert(rows, { onConflict: "month,source" });

      if (error) {
        toast.error(`Erro ao salvar: ${error.message}`);
        setSaving(false);
        return;
      }

      toast.success(
        `Spend de ${monthLabelPT(month)} salvo (${rows.length} fonte${
          rows.length === 1 ? "" : "s"
        }).`,
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/[0.08] bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            Editar spend mensal
          </DialogTitle>
          <DialogDescription>
            Digite quanto foi gasto em cada fonte de Ads neste mês. Deixe em
            branco a fonte que não foi usada. Valores em dólar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="month-select" className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Mês
            </Label>
            <select
              id="month-select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabelPT(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Gasto por fonte
            </div>

            {LEAD_SOURCES.map((src) => (
              <div
                key={src}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
              >
                <Label
                  htmlFor={`spend-${src}`}
                  className="text-sm font-semibold text-white/85"
                >
                  {SOURCE_LABEL[src]}
                </Label>
                <select
                  value={methods[src]}
                  onChange={(e) =>
                    setMethods((prev) => ({
                      ...prev,
                      [src]: e.target.value as PaymentMethod,
                    }))
                  }
                  className="h-10 w-36 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Como esta linha foi paga"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-white/45">
                    $
                  </span>
                  <Input
                    id={`spend-${src}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={amounts[src]}
                    onChange={(e) =>
                      setAmounts((prev) => ({
                        ...prev,
                        [src]: e.target.value,
                      }))
                    }
                    className="w-28 pl-7 text-right font-mono"
                  />
                </div>
              </div>
            ))}
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">
              Pago no cartão de crédito? Marque <b>Cartão de crédito</b> — esse
              spend NÃO entra no caixa real até você lançar a fatura paga em
              <b> Gastos da empresa</b>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="font-semibold">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyAmounts(): Record<LeadSource, string> {
  return LEAD_SOURCES.reduce(
    (acc, src) => {
      acc[src] = "";
      return acc;
    },
    {} as Record<LeadSource, string>,
  );
}

/** Default = credit_card (José usa cartão pra maior parte dos Ads). */
function defaultMethods(): Record<LeadSource, PaymentMethod> {
  return LEAD_SOURCES.reduce(
    (acc, src) => {
      acc[src] = "credit_card";
      return acc;
    },
    {} as Record<LeadSource, PaymentMethod>,
  );
}
