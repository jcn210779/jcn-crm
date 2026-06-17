"use client";

import {
  AlertTriangle,
  Box,
  Filter,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Save,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import type { StoreItemStats } from "@/lib/types";

type JobOption = { id: string; label: string };

type Props = {
  token: string;
  initialItems: StoreItemStats[];
  jobs: JobOption[];
};

type MoveState = {
  item: StoreItemStats;
  kind: "in" | "out";
};

export function WarehouseView({ token, initialItems, jobs }: Props) {
  const [items, setItems] = useState<StoreItemStats[]>(initialItems);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [moving, setMoving] = useState<MoveState | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    const res = await fetch(`/api/deposito/${token}/items`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { items: StoreItemStats[] };
    setItems(data.items);
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.category) set.add(i.category);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, categoryFilter]);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-jcn-gold-300">
              Depósito
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              {items.length} item{items.length === 1 ? "" : "s"} no estoque
            </h1>
          </div>
          <Button
            onClick={() => setCreating(true)}
            className="shrink-0 bg-jcn-gold-500 text-jcn-midnight hover:bg-jcn-gold-400"
          >
            <Plus className="h-4 w-4" />
            Novo item
          </Button>
        </div>
        <p className="mt-3 text-xs text-white/55">
          Use os botões <strong>Entrada</strong> e <strong>Saída</strong> pra
          mexer no estoque. Toda saída precisa indicar a obra (job).
        </p>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
          <Filter className="h-3 w-3" />
          Filtros
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="h-9 pl-8"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 text-xs text-white"
          >
            <option value="">Todas categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* LISTA */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-white/30" />
          <p className="mt-4 text-sm font-semibold text-white/65">
            {items.length === 0
              ? "Depósito vazio. José vai cadastrar items em breve."
              : "Nenhum item bate com os filtros."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onOpenMove={(kind) => setMoving({ item, kind })}
            />
          ))}
        </div>
      )}

      {moving && (
        <MoveDialog
          open={moving !== null}
          token={token}
          item={moving.item}
          kind={moving.kind}
          jobs={jobs}
          onOpenChange={(o) => {
            if (!o) setMoving(null);
          }}
          onDone={() => {
            setMoving(null);
            void reload();
          }}
        />
      )}

      <CreateItemDialog
        open={creating}
        token={token}
        existingCategories={categories}
        onOpenChange={setCreating}
        onDone={() => {
          setCreating(false);
          void reload();
        }}
      />
    </div>
  );
}

function CreateItemDialog({
  open,
  token,
  existingCategories,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  token: string;
  existingCategories: string[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [initialQty, setInitialQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset ao abrir
  if (!open && (name || category || unit || notes !== "" || initialQty !== "1")) {
    setName("");
    setCategory("");
    setUnit("");
    setInitialQty("1");
    setNotes("");
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const qty = Number(initialQty);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error("Qtd inválida");
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/deposito/${token}/item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        category: category.trim() || null,
        unit: unit.trim() || null,
        initial_quantity: qty,
        notes: notes.trim() || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(`Erro: ${err.error ?? res.statusText}`);
      return;
    }
    toast.success(`Item "${name.trim()}" cadastrado`);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo item</DialogTitle>
          <DialogDescription>
            Cadastre material novo no depósito. José completa detalhes
            (local, estoque mínimo) depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Nome *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cedar 2x6 deck board"
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                Categoria
              </Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Wood, Hardware..."
                list="cat-suggestions"
                disabled={saving}
              />
              {existingCategories.length > 0 && (
                <datalist id="cat-suggestions">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                Unidade
              </Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="tábuas, lb, saco"
                disabled={saving}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Qtd inicial *
            </Label>
            <Input
              type="number"
              step="0.01"
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Notas (opcional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Specs, marca, de onde veio..."
              disabled={saving}
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemRow({
  item,
  onOpenMove,
}: {
  item: StoreItemStats;
  onOpenMove: (kind: "in" | "out") => void;
}) {
  const qty = Number(item.quantity);
  const reserved = Number(item.reserved_quantity);
  const available = Number(item.available_quantity);

  return (
    <div
      className={`rounded-2xl border bg-white/[0.04] p-3 backdrop-blur-xl ${
        item.low_stock ? "border-amber-400/30" : "border-white/[0.06]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Box className="h-4 w-4 text-jcn-gold-300" />
            <h3 className="text-sm font-bold text-white">{item.name}</h3>
            {item.category && (
              <Badge variant="outline" className="text-[10px]">
                {item.category}
              </Badge>
            )}
            {item.low_stock && (
              <Badge
                variant="outline"
                className="border-amber-400/40 bg-amber-500/15 text-[10px] font-bold text-amber-300"
              >
                <AlertTriangle className="h-3 w-3" />
                Baixo
              </Badge>
            )}
          </div>
          {item.location && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-white/55">
              <MapPin className="h-3 w-3" />
              {item.location}
            </div>
          )}
        </div>

        <div className="min-w-[80px] text-center">
          <p
            className={`text-2xl font-black ${
              item.low_stock ? "text-amber-300" : "text-white"
            }`}
          >
            {qty}
          </p>
          {item.unit && (
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">
              {item.unit}
            </p>
          )}
        </div>
      </div>

      {reserved > 0 && (
        <div className="mt-2 flex gap-3 border-t border-white/[0.05] pt-2 text-[11px]">
          <span className="text-sky-300">
            <strong>{reserved}</strong> reservado{reserved === 1 ? "" : "s"}
          </span>
          <span className="text-white/65">
            Disponível: <strong className="text-emerald-300">{available}</strong>
          </span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenMove("in")}
          className="h-10 border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-4 w-4" />
          Entrada
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenMove("out")}
          disabled={qty <= 0}
          className="h-10 border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
          Saída
        </Button>
      </div>
    </div>
  );
}

function MoveDialog({
  open,
  token,
  item,
  kind,
  jobs,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  token: string;
  item: StoreItemStats;
  kind: "in" | "out";
  jobs: JobOption[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    if (kind === "out" && qty > item.quantity) {
      toast.error(`Quantidade maior que o estoque (${item.quantity})`);
      return;
    }
    if (kind === "out" && !jobId) {
      toast.error("Escolha pra qual obra (job)");
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/deposito/${token}/movement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: item.id,
        kind,
        quantity: qty,
        job_id: jobId || null,
        notes: notes.trim() || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(`Erro: ${err.error ?? res.statusText}`);
      return;
    }

    toast.success(
      `${kind === "in" ? "+" : "-"}${qty} ${item.unit ?? "un"} ${item.name}`,
    );
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === "in" ? (
              <>
                <Plus className="h-5 w-5 text-emerald-300" />
                Entrada
              </>
            ) : (
              <>
                <Minus className="h-5 w-5 text-rose-300" />
                Saída
              </>
            )}{" "}
            — {item.name}
          </DialogTitle>
          <DialogDescription>
            Estoque atual:{" "}
            <strong className="text-white">{item.quantity}</strong>{" "}
            {item.unit ?? "un"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Quantidade *
            </Label>
            <Input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>

          {(kind === "out" || jobs.length > 0) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                {kind === "out" ? "Pra qual obra? *" : "Obra (opcional)"}
              </Label>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                disabled={saving}
                className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white"
              >
                <option value="">
                  {kind === "out" ? "Escolha a obra..." : "Sem obra linkada"}
                </option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Notas (opcional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={
                kind === "in"
                  ? "Ex: Sobrou do deck do David"
                  : "Ex: Pego pelo Lucas"
              }
              disabled={saving}
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
            ) : kind === "in" ? (
              <Plus className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
