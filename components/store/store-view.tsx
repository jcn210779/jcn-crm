"use client";

import {
  AlertTriangle,
  Box,
  Filter,
  MapPin,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { StoreItemStats } from "@/lib/types";

import { ItemDialog } from "./item-dialog";
import { MoveQuantityDialog } from "./move-quantity-dialog";
import { ShareStoreDialog } from "./share-store-dialog";

type Props = {
  initialItems: StoreItemStats[];
};

export function StoreView({ initialItems }: Props) {
  const [items, setItems] = useState<StoreItemStats[]>(initialItems);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItemStats | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<{
    item: StoreItemStats;
    kind: "in" | "out";
  } | null>(null);
  const [sharing, setSharing] = useState(false);

  async function reload() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("v_store_items_stats")
      .select("*")
      .order("name", { ascending: true });
    setItems((data ?? []) as StoreItemStats[]);
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.category) set.add(i.category);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (showLowOnly && !i.low_stock) return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, categoryFilter, showLowOnly]);

  const stats = useMemo(() => {
    const total = items.length;
    const low = items.filter((i) => i.low_stock).length;
    const withReservation = items.filter((i) => i.reserved_quantity > 0).length;
    return { total, low, withReservation };
  }, [items]);

  async function quickAdjust(item: StoreItemStats, delta: number) {
    if (delta < 0 && item.quantity <= 0) {
      toast.error("Quantidade já está em 0");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("store_movements").insert({
      item_id: item.id,
      kind: delta > 0 ? "in" : "out",
      quantity: Math.abs(delta),
      notes: "Ajuste rápido",
    });
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success(`${item.name}: ${delta > 0 ? "+" : ""}${delta}`);
    void reload();
  }

  async function handleDelete(item: StoreItemStats) {
    if (
      !confirm(
        `Apagar "${item.name}"?\n\nIsso vai apagar TAMBÉM o histórico de movimentações e reservas desse item. Não dá pra desfazer.`,
      )
    )
      return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("store_items").delete().eq("id", item.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success("Item apagado");
    void reload();
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
            Depósito
          </h1>
          <p className="mt-1 text-sm text-jcn-ice/55">
            {stats.total} item{stats.total === 1 ? "" : "s"} no estoque
            {stats.low > 0 && (
              <>
                {" · "}
                <span className="font-bold text-amber-300">
                  {stats.low} com estoque baixo
                </span>
              </>
            )}
            {stats.withReservation > 0 && (
              <>
                {" · "}
                <span className="text-sky-300">
                  {stats.withReservation} com reservas
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSharing(true)}>
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Novo item
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-jcn-ice/45">
          <Filter className="h-3 w-3" />
          Filtros
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-jcn-ice/35" />
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
            className="h-9 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 text-xs text-jcn-ice"
          >
            <option value="">Todas categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <Button
          variant={showLowOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowLowOnly(!showLowOnly)}
          className="h-9"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Estoque baixo
        </Button>
      </div>

      {/* LISTA */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-jcn-ice/30" />
          <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
            {items.length === 0
              ? "Depósito vazio — clique em “Novo item” pra começar."
              : "Nenhum item bate com os filtros."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onAdjust={(delta) => quickAdjust(item, delta)}
              onEdit={() => setEditingItem(item)}
              onDelete={() => handleDelete(item)}
              onOpenMove={(kind) => setMoving({ item, kind })}
            />
          ))}
        </div>
      )}

      {/* DIALOGS */}
      <ItemDialog
        open={creating || editingItem !== null}
        item={editingItem}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditingItem(null);
          }
        }}
        onDone={() => {
          setCreating(false);
          setEditingItem(null);
          void reload();
        }}
      />

      {moving && (
        <MoveQuantityDialog
          open={moving !== null}
          item={moving.item}
          kind={moving.kind}
          onOpenChange={(o) => {
            if (!o) setMoving(null);
          }}
          onDone={() => {
            setMoving(null);
            void reload();
          }}
        />
      )}

      <ShareStoreDialog
        open={sharing}
        onOpenChange={setSharing}
      />
    </div>
  );
}

function ItemRow({
  item,
  onAdjust,
  onEdit,
  onDelete,
  onOpenMove,
}: {
  item: StoreItemStats;
  onAdjust: (delta: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenMove: (kind: "in" | "out") => void;
}) {
  const qty = Number(item.quantity);
  const reserved = Number(item.reserved_quantity);
  const available = Number(item.available_quantity);

  return (
    <div
      className={`rounded-2xl border bg-white/[0.025] p-3 backdrop-blur-xl transition ${
        item.low_stock
          ? "border-amber-400/30"
          : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: nome + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Box className="h-4 w-4 text-jcn-gold-300" />
            <h3 className="text-sm font-bold text-jcn-ice">{item.name}</h3>
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
          {(item.location || item.notes) && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-jcn-ice/55">
              {item.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.location}
                </span>
              )}
              {item.notes && <span className="italic">{item.notes}</span>}
            </div>
          )}
        </div>

        {/* Right: qtd + botões rápidos */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdjust(-1)}
            className="h-9 w-9 p-0"
            disabled={qty <= 0}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="min-w-[80px] text-center">
            <p
              className={`text-xl font-black ${
                item.low_stock ? "text-amber-300" : "text-jcn-ice"
              }`}
            >
              {qty}
            </p>
            {item.unit && (
              <p className="text-[10px] uppercase tracking-[0.12em] text-jcn-ice/45">
                {item.unit}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdjust(+1)}
            className="h-9 w-9 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Reservas + min */}
      {(reserved > 0 || item.min_quantity) && (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-white/[0.05] pt-2 text-[11px]">
          {reserved > 0 && (
            <span className="text-sky-300">
              <strong>{reserved}</strong> reservado{reserved === 1 ? "" : "s"}
            </span>
          )}
          {reserved > 0 && (
            <span className="text-jcn-ice/65">
              Disponível: <strong className="text-emerald-300">{available}</strong>
            </span>
          )}
          {item.min_quantity != null && (
            <span className="text-jcn-ice/45">
              Mín: {Number(item.min_quantity)}
            </span>
          )}
        </div>
      )}

      {/* Ações secundárias */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenMove("in")}
          className="h-7 px-2 text-[11px] text-emerald-300 hover:bg-emerald-500/15"
        >
          <Plus className="h-3 w-3" />
          Entrada
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenMove("out")}
          className="h-7 px-2 text-[11px] text-rose-300 hover:bg-rose-500/15"
        >
          <Minus className="h-3 w-3" />
          Saída
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-7 px-2 text-[11px] text-jcn-ice/65"
        >
          <Pencil className="h-3 w-3" />
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 px-2 text-[11px] text-rose-300/65 hover:bg-rose-500/15 hover:text-rose-300"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
