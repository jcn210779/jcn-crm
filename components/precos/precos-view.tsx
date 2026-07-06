"use client";

import {
  Copy,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { PriceTier, PriceUnit, SubPriceCatalog } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_CATEGORIES = [
  "Demolição",
  "Estrutura / Framing",
  "Elétrica",
  "Hidráulica",
  "HVAC",
  "Isolamento",
  "Drywall",
  "Piso e acabamento",
  "Externo (siding/deck/telhado)",
  "Limpeza / Final",
];

const UNIT_LABEL: Record<PriceUnit, string> = {
  sqft: "$/sqft",
  linear_ft: "$/pé linear",
  day: "$/dia",
  hour: "$/hora",
  flat: "$ total",
  each: "$/unid.",
};

const UNIT_SUFFIX: Record<PriceUnit, string> = {
  sqft: "/sqft",
  linear_ft: "/lft",
  day: "/dia",
  hour: "/hora",
  flat: " total",
  each: "/unid.",
};

type Props = {
  initialItems: SubPriceCatalog[];
};

export function PrecosView({ initialItems }: Props) {
  const [items, setItems] = useState<SubPriceCatalog[]>(initialItems);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editing, setEditing] = useState<SubPriceCatalog | null>(null);
  const [creating, setCreating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  async function reload() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("sub_price_catalog")
      .select("*")
      .order("category")
      .order("display_order")
      .order("service_name");
    setItems((data ?? []) as SubPriceCatalog[]);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((i) => {
      if (!i.is_active) return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        i.service_name.toLowerCase().includes(term) ||
        (i.description ?? "").toLowerCase().includes(term) ||
        i.category.toLowerCase().includes(term)
      );
    });
  }, [items, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, SubPriceCatalog[]>();
    for (const i of filtered) {
      const list = map.get(i.category) ?? [];
      list.push(i);
      map.set(i.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const categories = useMemo(() => {
    const set = new Set<string>([...DEFAULT_CATEGORIES]);
    for (const i of items) set.add(i.category);
    return Array.from(set).sort();
  }, [items]);

  async function handleDelete(item: SubPriceCatalog) {
    if (!confirm(`Apagar "${item.service_name}"?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("sub_price_catalog")
      .delete()
      .eq("id", item.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Removido");
    await reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-jcn-ice">
            Catálogo de preços de sub
          </h1>
          <p className="mt-1 text-xs text-jcn-ice/55">
            Referência interna do que DEVE custar cada serviço. Consulta antes
            de aceitar proposta.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShareOpen(true)}
            className="border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-200 hover:bg-jcn-gold-500/20"
          >
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
          <Button
            onClick={() => setCreating(true)}
            className="bg-jcn-gold-500 text-jcn-midnight hover:bg-jcn-gold-400"
          >
            <Plus className="h-4 w-4" />
            Novo serviço
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-jcn-ice/40" />
          <Input
            placeholder="Buscar serviço, categoria, descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="flex h-10 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-jcn-ice"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.1] bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-jcn-ice/55">
            {items.length === 0
              ? "Ainda não tem nenhum preço cadastrado. Click em 'Novo serviço' pra começar."
              : "Nenhum serviço encontrado com esse filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, list]) => (
            <section
              key={category}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 md:p-5"
            >
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-jcn-gold-300">
                {category}{" "}
                <span className="text-jcn-ice/40">({list.length})</span>
              </h2>
              <div className="space-y-2">
                {list.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-semibold text-jcn-ice">
                          {item.service_name}
                        </p>
                        {(!item.tiers || item.tiers.length === 0) && (
                          <p className="text-sm font-black text-jcn-gold-300">
                            {formatCurrency(item.price_min)} –{" "}
                            {formatCurrency(item.price_max)}
                            <span className="text-xs font-normal text-jcn-ice/55">
                              {UNIT_SUFFIX[item.unit]}
                            </span>
                          </p>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 text-xs text-jcn-ice/65">
                          {item.description}
                        </p>
                      )}
                      {item.tiers && item.tiers.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.tiers.map((t, idx) => (
                            <span
                              key={idx}
                              className="rounded-lg border border-jcn-gold-400/30 bg-jcn-gold-500/10 px-2 py-1 text-[11px]"
                            >
                              <span className="text-jcn-ice/70">{t.label}:</span>{" "}
                              <span className="font-black text-jcn-gold-300">
                                {formatCurrency(Number(t.price))}
                                <span className="text-[9px] font-normal text-jcn-ice/55">
                                  {UNIT_SUFFIX[item.unit]}
                                </span>
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <p className="mt-1 text-[11px] italic text-jcn-ice/45">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-jcn-ice/70 hover:bg-white/[0.06] hover:text-jcn-gold-300"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-md p-1.5 text-jcn-ice/40 hover:bg-rose-500/15 hover:text-rose-300"
                        title="Apagar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PrecoDialog
          existingCategories={categories}
          item={editing}
          open={creating || editing !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCreating(false);
              setEditing(null);
            }
          }}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            void reload();
          }}
        />
      )}

      <SharePrecoDialog open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}

// ============================================================================
// Dialog Criar / Editar
// ============================================================================

function PrecoDialog({
  item,
  existingCategories,
  open,
  onOpenChange,
  onDone,
}: {
  item: SubPriceCatalog | null;
  existingCategories: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [category, setCategory] = useState(item?.category ?? "");
  const [serviceName, setServiceName] = useState(item?.service_name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unit, setUnit] = useState<PriceUnit>(item?.unit ?? "flat");
  const [priceMin, setPriceMin] = useState(String(item?.price_min ?? ""));
  const [priceMax, setPriceMax] = useState(String(item?.price_max ?? ""));
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [tiers, setTiers] = useState<{ label: string; price: string }[]>(
    (item?.tiers ?? []).map((t) => ({
      label: t.label,
      price: String(t.price),
    })),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory(item?.category ?? "");
      setServiceName(item?.service_name ?? "");
      setDescription(item?.description ?? "");
      setUnit(item?.unit ?? "flat");
      setPriceMin(String(item?.price_min ?? ""));
      setPriceMax(String(item?.price_max ?? ""));
      setNotes(item?.notes ?? "");
      setTiers(
        (item?.tiers ?? []).map((t) => ({
          label: t.label,
          price: String(t.price),
        })),
      );
    }
  }, [open, item]);

  function addTier() {
    setTiers((prev) => [...prev, { label: "", price: "" }]);
  }

  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateTier(idx: number, field: "label" | "price", value: string) {
    setTiers((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    );
  }

  async function handleSave() {
    if (!category.trim()) {
      toast.error("Categoria obrigatória");
      return;
    }
    if (!serviceName.trim()) {
      toast.error("Nome do serviço obrigatório");
      return;
    }
    const min = Number(priceMin);
    const max = Number(priceMax);
    if (Number.isNaN(min) || min < 0) {
      toast.error("Preço mínimo inválido");
      return;
    }
    if (Number.isNaN(max) || max < min) {
      toast.error("Preço máximo tem que ser >= mínimo");
      return;
    }

    // Valida tiers (se preenchidos, ambos campos são obrigatórios)
    const cleanedTiers: PriceTier[] = [];
    for (const t of tiers) {
      const label = t.label.trim();
      const price = Number(t.price);
      if (!label && !t.price) continue; // linha vazia — ignora
      if (!label) {
        toast.error("Todas as variações precisam de nome");
        return;
      }
      if (Number.isNaN(price) || price < 0) {
        toast.error(`Preço inválido em "${label}"`);
        return;
      }
      cleanedTiers.push({ label, price });
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const payload = {
      category: category.trim(),
      service_name: serviceName.trim(),
      description: description.trim() || null,
      unit,
      price_min: min,
      price_max: max,
      tiers: cleanedTiers,
      notes: notes.trim() || null,
    };
    const { error } = item
      ? await supabase
          .from("sub_price_catalog")
          .update(payload)
          .eq("id", item.id)
      : await supabase.from("sub_price_catalog").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success(item ? "Atualizado" : "Cadastrado");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar preço" : "Novo preço de sub"}
          </DialogTitle>
          <DialogDescription>
            Range mín-máx é o teto que você aceita pagar por esse serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div>
            <Label>Categoria *</Label>
            <input
              list="preco-categorias"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
              placeholder="Ex: Elétrica"
              className="flex h-10 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-jcn-ice"
            />
            <datalist id="preco-categorias">
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Nome do serviço *</Label>
            <Input
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              disabled={saving}
              placeholder="Ex: Demolição interior residencial"
            />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={2}
              placeholder="O que inclui / não inclui, escopo típico..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Preço mín. ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Preço máx. ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Unidade</Label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as PriceUnit)}
                disabled={saving}
                className="flex h-10 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-jcn-ice"
              >
                {(Object.keys(UNIT_LABEL) as PriceUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tiers: variações por tipo de imóvel */}
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label className="mb-0">Variações por tipo (opcional)</Label>
                <p className="mt-0.5 text-[10px] text-jcn-ice/45">
                  Ex: 1 família $1.000 · 2 famílias $2.000 · cottage $1.000
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addTier}
                disabled={saving}
                className="h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
            {tiers.length === 0 ? (
              <p className="text-center text-[11px] italic text-jcn-ice/40">
                Sem variações — usa o range mín-máx acima
              </p>
            ) : (
              <div className="space-y-2">
                {tiers.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={tier.label}
                      onChange={(e) => updateTier(idx, "label", e.target.value)}
                      disabled={saving}
                      placeholder="Ex: 1 família"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={tier.price}
                      onChange={(e) => updateTier(idx, "price", e.target.value)}
                      disabled={saving}
                      placeholder="1000"
                      className="w-28"
                    />
                    <button
                      type="button"
                      onClick={() => removeTier(idx)}
                      disabled={saving}
                      className="shrink-0 rounded-md p-1.5 text-jcn-ice/40 hover:bg-rose-500/15 hover:text-rose-300"
                      title="Remover variação"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Notas (opcional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              placeholder="Ex: valor pra job pequeno; grandes podem ter desconto"
            />
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Share dialog
// ============================================================================

function SharePrecoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [rotatedAt, setRotatedAt] = useState<string | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      loadedRef.current = false;
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, [open]);

  async function load() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("sub_price_catalog_share")
      .select("token, rotated_at, last_used_at")
      .single();
    if (data) {
      setToken(data.token);
      setRotatedAt(data.rotated_at);
      setLastUsedAt(data.last_used_at);
    }
    setLoading(false);
  }

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://jcn-crm.vercel.app";
  const url = `${baseUrl}/precos-publico/${token}`;

  function copy() {
    if (!navigator.clipboard) return toast.error("Navegador não suporta");
    void navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copiado");
    });
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(
      `Tabela de preços JCN — referência do que pagamos por serviço:\n\n${url}`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  async function rotate() {
    if (
      !confirm(
        "Gerar link novo? O link atual vai parar de funcionar AGORA.\n\nQuem tiver o link antigo perde acesso.",
      )
    )
      return;
    setRotating(true);
    const res = await fetch("/api/precos-publico/rotate", { method: "POST" });
    setRotating(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(`Erro: ${err.error ?? res.statusText}`);
      return;
    }
    toast.success("Link novo gerado");
    await load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar tabela de preços</DialogTitle>
          <DialogDescription>
            Link público read-only pra você mandar pra time interno,
            parceiros ou pra você mesmo consultar no celular.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-jcn-gold-300" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Link</Label>
              <div className="flex gap-2">
                <Input value={url} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={copy} className="shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-jcn-ice/45">
                {rotatedAt && (
                  <>
                    Link gerado{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(rotatedAt))}
                    {lastUsedAt && (
                      <>
                        {" · "}último uso{" "}
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(lastUsedAt))}
                      </>
                    )}
                  </>
                )}
              </p>
            </div>

            <Button onClick={shareWhatsApp} className="w-full">
              <MessageCircle className="h-4 w-4" />
              Enviar no WhatsApp
            </Button>

            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200/85">
              <p className="font-bold">⚠️ Permissões do link:</p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                <li>Ver toda a tabela agrupada por categoria</li>
                <li>Filtrar/buscar</li>
                <li>
                  <strong>NÃO pode</strong> editar, criar ou apagar
                </li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={rotate}
            disabled={rotating || loading}
            className="text-rose-300 hover:bg-rose-500/15"
          >
            {rotating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Gerar link novo
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Unused import cleanup avoiding lint issue
void cn;
