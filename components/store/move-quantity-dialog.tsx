"use client";

import { Loader2, Minus, Plus, Save } from "lucide-react";
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
  item: StoreItemStats;
  kind: "in" | "out";
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

type JobOption = { id: string; label: string };

export function MoveQuantityDialog({
  open,
  item,
  kind,
  onOpenChange,
  onDone,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [jobId, setJobId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [jobs, setJobs] = useState<JobOption[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuantity("1");
    setJobId("");
    setNotes("");

    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("jobs")
        .select("id, lead:leads(name)")
        .neq("current_phase", "completed");
      type JobRow = { id: string; lead?: { name?: string } | null };
      const opts: JobOption[] = ((data ?? []) as unknown as JobRow[]).map(
        (j) => ({
          id: j.id,
          label: j.lead?.name ?? "Job sem nome",
        }),
      );
      setJobs(opts);
    })();
  }, [open]);

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

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("store_movements").insert({
      item_id: item.id,
      kind,
      quantity: qty,
      job_id: jobId || null,
      notes: notes.trim() || null,
    });
    setSaving(false);

    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success(
      `${kind === "in" ? "+" : "-"}${qty} ${item.unit ?? "un"} de ${item.name}`,
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
            <strong className="text-jcn-ice">{item.quantity}</strong>{" "}
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

          {jobs.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                {kind === "in" ? "Job de origem (opcional)" : "Pra qual job? (opcional)"}
              </Label>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                disabled={saving}
                className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-jcn-ice"
              >
                <option value="">Sem job linkado</option>
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
              Notas
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={kind === "in" ? "Comprei Home Depot" : "Usado no deck do Nick"}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
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
