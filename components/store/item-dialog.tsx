"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
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
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { StoreItemStats } from "@/lib/types";

type Props = {
  open: boolean;
  item: StoreItemStats | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

function n(v: string): number | null {
  if (!v.trim()) return null;
  const num = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(num) ? null : num;
}

export function ItemDialog({ open, item, onOpenChange, onDone }: Props) {
  const isEdit = item !== null;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    quantity: "0",
    unit: "",
    min_quantity: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: item?.name ?? "",
        category: item?.category ?? "",
        quantity: String(item?.quantity ?? "0"),
        unit: item?.unit ?? "",
        min_quantity: item?.min_quantity != null ? String(item.min_quantity) : "",
        location: item?.location ?? "",
        notes: item?.notes ?? "",
      });
    }
  }, [open, item]);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nome do item obrigatório");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      unit: form.unit.trim() || null,
      min_quantity: n(form.min_quantity),
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (isEdit && item) {
      // Edição: atualiza tudo MENOS quantity (qty muda via movement)
      const { error } = await supabase
        .from("store_items")
        .update(payload)
        .eq("id", item.id);
      setSaving(false);
      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }
      toast.success("Item atualizado");
    } else {
      // Criação: cria item com qty inicial 0, depois lança movement 'in' se qty > 0
      const initialQty = n(form.quantity) ?? 0;
      const { data: created, error } = await supabase
        .from("store_items")
        .insert({ ...payload, quantity: 0 })
        .select("id")
        .single();
      if (error || !created) {
        setSaving(false);
        toast.error(`Erro: ${error?.message ?? "?"}`);
        return;
      }
      if (initialQty > 0) {
        await supabase.from("store_movements").insert({
          item_id: created.id,
          kind: "in",
          quantity: initialQty,
          notes: "Estoque inicial",
        });
      }
      setSaving(false);
      toast.success("Item criado");
    }

    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item" : "Novo item"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize info do item. Quantidade muda via entrada/saída."
              : "Cadastre material novo no depósito."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Field label="Nome *">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Cedar 2x6 deck board"
              disabled={saving}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Wood"
                disabled={saving}
              />
            </Field>
            <Field label="Unidade">
              <Input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="tábuas, lb, saco"
                disabled={saving}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!isEdit && (
              <Field label="Qtd inicial">
                <Input
                  type="number"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  disabled={saving}
                />
              </Field>
            )}
            <Field label={isEdit ? "Estoque mínimo (alerta)" : "Mínimo (alerta)"}>
              <Input
                type="number"
                step="0.01"
                value={form.min_quantity}
                onChange={(e) =>
                  setForm({ ...form, min_quantity: e.target.value })
                }
                placeholder="0"
                disabled={saving}
              />
            </Field>
          </div>
          <Field label="Local">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Garagem - prateleira A"
              disabled={saving}
            />
          </Field>
          <Field label="Notas">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Specs, marca, data compra..."
              disabled={saving}
            />
          </Field>
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
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">{label}</Label>
      {children}
    </div>
  );
}
