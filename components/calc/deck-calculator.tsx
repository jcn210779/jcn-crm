"use client";

/**
 * Calculadora de deck — v2 (aberta).
 *
 * Voce adiciona quantas linhas quiser. Cada linha: categoria, label, qty,
 * unit, preço. 3 categorias com subtotal: Material, Mão de obra, Outros.
 * Catálogo de presets pra bater 1 click nos items comuns. Salva TUDO em
 * localStorage (estrutura + valores). Botão "Copiar estimate" gera texto
 * agrupado por categoria.
 */

import {
  Copy,
  DollarSign,
  HardHat,
  Package,
  Plus,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Category = "material" | "labor" | "other";

type ItemRow = {
  id: string;
  category: Category;
  label: string;
  qty: number;
  unit: string;
  price: number;
};

type Preset = {
  category: Category;
  label: string;
  unit: string;
  price: number;
};

const CATALOG: Preset[] = [
  // Material
  { category: "material", label: "Framing (PT structure)", unit: "sqft", price: 11.0 },
  { category: "material", label: "Deckboard (Trex Select)", unit: "sqft", price: 14.0 },
  { category: "material", label: "Deckboard (PT)", unit: "sqft", price: 6.0 },
  { category: "material", label: "Railing (PT 8ft)", unit: "lft", price: 8.75 },
  { category: "material", label: "Railing (composite)", unit: "lft", price: 22.0 },
  { category: "material", label: "Stairs (por degrau)", unit: "each", price: 120.0 },
  { category: "material", label: "Concrete footing (Sonotube)", unit: "each", price: 150.0 },
  { category: "material", label: "Fascia board", unit: "lft", price: 4.5 },
  // Labor
  { category: "labor", label: "Mão de obra (dia)", unit: "dia", price: 500.0 },
  { category: "labor", label: "Mão de obra (hora)", unit: "hora", price: 65.0 },
  { category: "labor", label: "Sub de framing (fechado)", unit: "flat", price: 3500.0 },
  // Outros
  { category: "other", label: "Permit", unit: "flat", price: 250.0 },
  { category: "other", label: "Dumpster", unit: "flat", price: 450.0 },
  { category: "other", label: "Transporte / frete", unit: "flat", price: 100.0 },
];

const CATEGORY_META: Record<
  Category,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  material: {
    label: "Material",
    icon: Package,
    tone: "border-jcn-gold-400/30 bg-jcn-gold-500/5",
  },
  labor: {
    label: "Mão de obra",
    icon: HardHat,
    tone: "border-sky-400/30 bg-sky-500/5",
  },
  other: {
    label: "Outros",
    icon: Wrench,
    tone: "border-white/[0.08] bg-white/[0.03]",
  },
};

const STORAGE_KEY = "jcn-calc-deck-v2";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function DeckCalculator() {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ItemRow[];
        if (Array.isArray(parsed)) setRows(parsed);
      }
    } catch {
      // ignora
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // ignora
    }
  }, [rows, loaded]);

  function addFromPreset(p: Preset) {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        category: p.category,
        label: p.label,
        qty: 0,
        unit: p.unit,
        price: p.price,
      },
    ]);
  }

  function addCustom(category: Category) {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        category,
        label: "",
        qty: 0,
        unit: category === "labor" ? "dia" : "unid",
        price: 0,
      },
    ]);
  }

  function updateRow(id: string, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function deleteRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function newCalculation() {
    if (rows.length === 0) return;
    if (!confirm("Apagar tudo e começar novo cálculo?")) return;
    setRows([]);
    toast.info("Cálculo zerado");
  }

  const byCategory = useMemo(() => {
    const map: Record<Category, ItemRow[]> = {
      material: [],
      labor: [],
      other: [],
    };
    rows.forEach((r) => map[r.category].push(r));
    return map;
  }, [rows]);

  const subtotals = useMemo<Record<Category, number>>(
    () => ({
      material: byCategory.material.reduce((s, r) => s + r.qty * r.price, 0),
      labor: byCategory.labor.reduce((s, r) => s + r.qty * r.price, 0),
      other: byCategory.other.reduce((s, r) => s + r.qty * r.price, 0),
    }),
    [byCategory],
  );

  const total = subtotals.material + subtotals.labor + subtotals.other;

  function copyEstimate() {
    const lines: string[] = ["ESTIMATE DE DECK", ""];
    (["material", "labor", "other"] as Category[]).forEach((cat) => {
      const items = byCategory[cat].filter((r) => r.qty > 0);
      if (items.length === 0) return;
      lines.push(`--- ${CATEGORY_META[cat].label.toUpperCase()} ---`);
      items.forEach((r) => {
        const sub = r.qty * r.price;
        lines.push(
          `${r.label || "(sem nome)"}: ${r.qty} ${r.unit} × ${formatCurrency(r.price)} = ${formatCurrency(sub)}`,
        );
      });
      lines.push(`Subtotal ${CATEGORY_META[cat].label}: ${formatCurrency(subtotals[cat])}`);
      lines.push("");
    });
    lines.push(`TOTAL: ${formatCurrency(total)}`);

    void navigator.clipboard.writeText(lines.join("\n")).then(() => {
      toast.success("Estimate copiado", {
        description: "Cola no email/WhatsApp do cliente",
      });
    });
  }

  return (
    <div className="space-y-5">
      {/* Barra de add + reset */}
      <div className="flex flex-wrap items-center gap-2">
        <AddDropdown onPickPreset={addFromPreset} onPickCustom={addCustom} />
        <Button
          variant="ghost"
          onClick={newCalculation}
          className="text-jcn-ice/60 hover:text-jcn-ice"
          disabled={rows.length === 0}
        >
          <RotateCcw className="h-4 w-4" />
          Novo cálculo
        </Button>
      </div>

      {/* Seções por categoria */}
      {(["material", "labor", "other"] as Category[]).map((cat) => {
        const meta = CATEGORY_META[cat];
        const items = byCategory[cat];
        const Icon = meta.icon;
        return (
          <section
            key={cat}
            className={cn(
              "rounded-2xl border p-4 md:p-5",
              meta.tone,
            )}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-jcn-ice/60" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-jcn-ice/80">
                  {meta.label}{" "}
                  <span className="ml-1 text-jcn-ice/45">({items.length})</span>
                </h2>
              </div>
              <p className="text-sm font-black text-jcn-gold-300">
                {formatCurrency(subtotals[cat])}
              </p>
            </div>

            {items.length === 0 ? (
              <p className="py-3 text-center text-xs italic text-jcn-ice/40">
                Nenhum item — usa &quot;Adicionar item&quot; acima
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((r) => {
                  const sub = r.qty * r.price;
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Input
                          value={r.label}
                          onChange={(e) =>
                            updateRow(r.id, { label: e.target.value })
                          }
                          placeholder="Descrição do item"
                          className="flex-1 border-white/[0.08] bg-white/[0.03]"
                        />
                        <span className="min-w-[80px] text-right text-sm font-black text-jcn-gold-300">
                          {formatCurrency(sub)}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteRow(r.id)}
                          className="shrink-0 rounded p-1.5 text-jcn-ice/35 hover:bg-rose-500/15 hover:text-rose-300"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="1"
                          value={r.qty || ""}
                          onChange={(e) =>
                            updateRow(r.id, {
                              qty: Number(e.target.value) || 0,
                            })
                          }
                          placeholder="Qtd"
                          className="text-sm"
                        />
                        <Input
                          value={r.unit}
                          onChange={(e) =>
                            updateRow(r.id, { unit: e.target.value })
                          }
                          placeholder="unid"
                          className="text-sm"
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={r.price || ""}
                          onChange={(e) =>
                            updateRow(r.id, {
                              price: Number(e.target.value) || 0,
                            })
                          }
                          placeholder="Preço"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {/* Total geral */}
      <div className="flex items-center justify-between rounded-3xl border border-jcn-gold-400/40 bg-jcn-gold-500/15 p-5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-jcn-gold-300" />
          <span className="text-sm font-bold uppercase tracking-wider text-jcn-gold-200">
            Total geral
          </span>
        </div>
        <p className="text-3xl font-black text-jcn-gold-300">
          {formatCurrency(total)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={copyEstimate}
          disabled={rows.length === 0}
          className="bg-jcn-gold-500 text-jcn-midnight hover:bg-jcn-gold-400"
        >
          <Copy className="h-4 w-4" />
          Copiar estimate
        </Button>
      </div>

      <p className="text-[11px] text-jcn-ice/40">
        Salva no seu navegador automaticamente. Preset do catálogo é ponto de
        partida — todos os campos são editáveis depois de adicionar.
      </p>
    </div>
  );
}

// ============================================================================
// Dropdown "Adicionar item" (catálogo + personalizado)
// ============================================================================

function AddDropdown({
  onPickPreset,
  onPickCustom,
}: {
  onPickPreset: (p: Preset) => void;
  onPickCustom: (cat: Category) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<Category, Preset[]> = {
      material: [],
      labor: [],
      other: [],
    };
    CATALOG.forEach((p) => map[p.category].push(p));
    return map;
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-jcn-gold-500 text-jcn-midnight hover:bg-jcn-gold-400">
          <Plus className="h-4 w-4" />
          Adicionar item
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-y-auto">
        {(["material", "labor", "other"] as Category[]).map((cat) => (
          <div key={cat}>
            <DropdownMenuLabel className="flex items-center justify-between text-[10px] uppercase tracking-wider text-jcn-gold-300">
              <span>{CATEGORY_META[cat].label}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onPickCustom(cat);
                }}
                className="text-[9px] font-bold uppercase text-jcn-ice/50 hover:text-jcn-gold-300"
              >
                + personalizado
              </button>
            </DropdownMenuLabel>
            {grouped[cat].map((p, idx) => (
              <DropdownMenuItem
                key={`${cat}-${idx}`}
                onSelect={() => onPickPreset(p)}
                className="cursor-pointer"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-xs">{p.label}</span>
                  <span className="shrink-0 text-[10px] text-jcn-ice/55">
                    {formatCurrency(p.price)}/{p.unit}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
