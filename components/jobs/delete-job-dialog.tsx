"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Counts = {
  payments: number;
  expenses: number;
  extras: number;
  hours: number;
  subs: number;
  invoices: number;
  photos: number;
  logs: number;
};

type Props = {
  jobId: string;
  leadId: string;
  leadName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteJobDialog({
  jobId,
  leadId,
  leadName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirm("");
      setCounts(null);
      return;
    }
    void loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadCounts() {
    const supabase = createSupabaseBrowserClient();
    const headSel = { count: "exact", head: true } as const;
    const [p, e, x, h, s, i, ph, l] = await Promise.all([
      supabase.from("job_payments").select("*", headSel).eq("job_id", jobId),
      supabase.from("job_expenses").select("*", headSel).eq("job_id", jobId),
      supabase.from("job_extras").select("*", headSel).eq("job_id", jobId),
      supabase.from("job_hours").select("*", headSel).eq("job_id", jobId),
      supabase
        .from("job_subcontractors")
        .select("*", headSel)
        .eq("job_id", jobId),
      supabase.from("job_invoices").select("*", headSel).eq("job_id", jobId),
      supabase.from("job_photos").select("*", headSel).eq("job_id", jobId),
      supabase.from("job_daily_logs").select("*", headSel).eq("job_id", jobId),
    ]);
    setCounts({
      payments: p.count ?? 0,
      expenses: e.count ?? 0,
      extras: x.count ?? 0,
      hours: h.count ?? 0,
      subs: s.count ?? 0,
      invoices: i.count ?? 0,
      photos: ph.count ?? 0,
      logs: l.count ?? 0,
    });
  }

  const totalDeps = counts
    ? counts.payments +
      counts.expenses +
      counts.extras +
      counts.hours +
      counts.subs +
      counts.invoices +
      counts.photos +
      counts.logs
    : 0;

  const canDelete = confirm.trim().toUpperCase() === "APAGAR" && !deleting;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Volta lead pra "estimate_enviado" ANTES de apagar o job
    //    (assim quando trigger eventualmente disparar de novo, nao recria job)
    const { error: leadErr } = await supabase
      .from("leads")
      .update({ stage: "estimate_enviado" })
      .eq("id", leadId);
    if (leadErr) {
      setDeleting(false);
      toast.error(`Erro ao mover lead: ${leadErr.message}`);
      return;
    }

    // 2) Apaga o job (CASCADE leva todas as child rows junto)
    const { error: jobErr } = await supabase
      .from("jobs")
      .delete()
      .eq("id", jobId);
    if (jobErr) {
      setDeleting(false);
      toast.error(`Erro ao apagar job: ${jobErr.message}`);
      return;
    }

    toast.success("Job apagado. Lead voltou pra 'estimate enviado'.");
    router.push("/jobs");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
            Apagar job de {leadName}?
          </DialogTitle>
          <DialogDescription>
            Vai apagar o job e tudo dentro dele. O lead{" "}
            <strong>{leadName}</strong> volta pra etapa{" "}
            <strong>&quot;estimate enviado&quot;</strong> no Kanban.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-[12px] text-rose-100/90">
            <p className="font-bold">⚠️ Itens que serão apagados junto:</p>
            {counts ? (
              totalDeps === 0 ? (
                <p className="mt-1 text-rose-100/70">
                  Nenhum item filho — só o job em si.
                </p>
              ) : (
                <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 pl-0">
                  {counts.payments > 0 && (
                    <li>• {counts.payments} pagamento(s)</li>
                  )}
                  {counts.expenses > 0 && (
                    <li>• {counts.expenses} despesa(s)</li>
                  )}
                  {counts.extras > 0 && <li>• {counts.extras} extra(s)</li>}
                  {counts.hours > 0 && <li>• {counts.hours} hora(s)</li>}
                  {counts.subs > 0 && (
                    <li>• {counts.subs} subcontratado(s)</li>
                  )}
                  {counts.invoices > 0 && (
                    <li>• {counts.invoices} invoice(s)</li>
                  )}
                  {counts.photos > 0 && <li>• {counts.photos} foto(s)</li>}
                  {counts.logs > 0 && (
                    <li>• {counts.logs} entrada(s) de diário</li>
                  )}
                </ul>
              )
            ) : (
              <p className="mt-1 flex items-center gap-2 text-rose-100/70">
                <Loader2 className="h-3 w-3 animate-spin" />
                Contando...
              </p>
            )}
            <p className="mt-2 text-[11px] text-rose-100/70">
              O lead em si <strong>NÃO</strong> é apagado — só o job. Você pode
              recriar arrastando o lead pra &quot;ganho&quot; de novo (vai
              gerar job novo zerado).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete-job">
              Digite <strong>APAGAR</strong> pra confirmar:
            </Label>
            <Input
              id="confirm-delete-job"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="APAGAR"
              disabled={deleting}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            disabled={!canDelete}
            className="bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-40"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Apagar job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
