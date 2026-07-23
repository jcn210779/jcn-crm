"use client";

/**
 * Calculadora de material pra estimate de deck.
 *
 * 3 componentes: Framing (sqft), Deckboard (sqft), Railing (lft).
 * Preços base editáveis inline, salvos em localStorage.
 * Sem banco — cálculo puro. Pra estimate final do cliente, resultado é copiável.
 */

import { Copy, DollarSign, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";

type Row = {
  key: string;
  label: string;
  unit: string;
  defaultPrice: number;
  qty: number;
  price: number;
};

const DEFAULT_ROWS: Row[] = [
  {
    key: "framing",
    label: "Framing (PT structure)",
    unit: "sqft",
    defaultPrice: 11.0,
    qty: 0,
    price: 11.0,
  },
  {
    key: "deckboard",
    label: "Deckboard (Trex Select)",
    unit: "sqft",
    defaultPrice: 14.0,
    qty: 0,
    price: 14.0,
  },
  {
    key: "railing",
    label: "Railing (PT 8ft section)",
    unit: "lft",
    defaultPrice: 8.75,
    qty: 0,
    price: 8.75,
  },
];

const STORAGE_KEY = "jcn-calc-deck-prices-v1";

export function DeckCalculator() {
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [loaded, setLoaded] = useState(false);

  // Carrega preços salvos do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, number>;
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            price: saved[r.key] ?? r.defaultPrice,
          })),
        );
      }
    } catch {
      // ignora
    }
    setLoaded(true);
  }, []);

  // Salva preços no localStorage quando mudam
  useEffect(() => {
    if (!loaded) return;
    const toSave: Record<string, number> = {};
    rows.forEach((r) => {
      toSave[r.key] = r.price;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignora
    }
  }, [rows, loaded]);

  function updateRow(key: string, field: "qty" | "price", value: number) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }

  function resetPrices() {
    if (!confirm("Voltar preços pros valores padrão?")) return;
    setRows((prev) => prev.map((r) => ({ ...r, price: r.defaultPrice })));
    toast.success("Preços resetados");
  }

  function resetQuantities() {
    setRows((prev) => prev.map((r) => ({ ...r, qty: 0 })));
    toast.info("Quantidades zeradas");
  }

  const total = rows.reduce((sum, r) => sum + r.qty * r.price, 0);

  function copyEstimate() {
    const lines: string[] = [
      "ESTIMATE DE MATERIAL — DECK",
      "",
    ];
    rows.forEach((r) => {
      if (r.qty <= 0) return;
      const subtotal = r.qty * r.price;
      lines.push(
        `${r.label}: ${r.qty} ${r.unit} × ${formatCurrency(r.price)}/${r.unit} = ${formatCurrency(subtotal)}`,
      );
    });
    lines.push("");
    lines.push(`TOTAL MATERIAL: ${formatCurrency(total)}`);

    const text = lines.join("\n");
    void navigator.clipboard.writeText(text).then(() => {
      toast.success("Estimate copiado", {
        description: "Cola no email/WhatsApp do cliente",
      });
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 md:p-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-white/55">
          Material do deck
        </h2>

        <div className="space-y-4">
          {rows.map((r) => {
            const subtotal = r.qty * r.price;
            return (
              <div
                key={r.key}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-jcn-ice">{r.label}</h3>
                  <p className="text-lg font-black text-jcn-gold-300">
                    {formatCurrency(subtotal)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-jcn-ice/55">
                      Quantidade ({r.unit})
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      value={r.qty || ""}
                      onChange={(e) =>
                        updateRow(
                          r.key,
                          "qty",
                          Number(e.target.value) || 0,
                        )
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-jcn-ice/55">
                      Preço por {r.unit} ($)
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={r.price}
                      onChange={(e) =>
                        updateRow(
                          r.key,
                          "price",
                          Number(e.target.value) || 0,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/10 p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-jcn-gold-300" />
            <span className="text-sm font-bold uppercase tracking-wider text-jcn-gold-200">
              Total material
            </span>
          </div>
          <p className="text-3xl font-black text-jcn-gold-300">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={copyEstimate}
          className="bg-jcn-gold-500 text-jcn-midnight hover:bg-jcn-gold-400"
        >
          <Copy className="h-4 w-4" />
          Copiar estimate
        </Button>
        <Button variant="outline" onClick={resetQuantities}>
          Zerar quantidades
        </Button>
        <Button
          variant="ghost"
          onClick={resetPrices}
          className="text-jcn-ice/60 hover:text-jcn-ice"
        >
          <RotateCcw className="h-4 w-4" />
          Resetar preços
        </Button>
      </div>

      <p className="text-[11px] text-jcn-ice/40">
        Preços salvam no seu navegador automaticamente. Só material — mão de
        obra, permits, transporte, waste factor entram no estimate final do
        cliente (não aqui).
      </p>
    </div>
  );
}
