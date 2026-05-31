"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Plus,
  Receipt,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddInvoiceDialog } from "@/components/jobs/invoices/add-invoice-dialog";
import { DeleteInvoiceDialog } from "@/components/jobs/invoices/delete-invoice-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { JobInvoice } from "@/lib/types";

type Props = {
  jobId: string;
  invoices: JobInvoice[];
  invoiceUrls: Record<string, string | null>;
};

export function JobInvoicesSection({ jobId, invoices, invoiceUrls }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobInvoice | null>(null);

  const stats = useMemo(() => {
    let totalSent = 0;
    let valued = 0;
    for (const inv of invoices) {
      if (inv.amount != null) {
        totalSent += Number(inv.amount);
        valued++;
      }
    }
    return { totalSent, valued, count: invoices.length };
  }, [invoices]);

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-jcn-ice">
              Faturas enviadas
            </h3>
            <p className="text-xs text-jcn-ice/55">
              Invoices que você mandou pro cliente cobrar.
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="h-10 font-semibold">
          <Plus className="h-4 w-4" />
          Anexar fatura
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/10 p-3 text-jcn-gold-300 backdrop-blur-xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
            Total faturado
          </div>
          <div className="mt-1.5 text-lg font-black tracking-tight">
            {formatCurrency(stats.totalSent)}
          </div>
          {stats.valued < stats.count && stats.count > 0 && (
            <div className="mt-0.5 text-xs opacity-80">
              {stats.count - stats.valued} sem valor informado
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-jcn-ice backdrop-blur-xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
            Faturas
          </div>
          <div className="mt-1.5 text-lg font-black tracking-tight">
            {stats.count}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-5 space-y-2">
        {invoices.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          invoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              fileUrl={invoiceUrls[inv.file_path] ?? null}
              onDelete={() => setDeleteTarget(inv)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AddInvoiceDialog
        jobId={jobId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      {deleteTarget && (
        <DeleteInvoiceDialog
          invoice={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onDeleted={() => {
            setDeleteTarget(null);
            toast.success("Fatura excluída");
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
      <Receipt className="mx-auto h-8 w-8 text-jcn-ice/30" />
      <p className="mt-3 text-sm font-semibold text-jcn-ice/65">
        Nenhuma fatura enviada ainda
      </p>
      <p className="mt-1 text-xs text-jcn-ice/40">
        Anexe as faturas que você mandou pro cliente pra ter tudo num lugar só.
      </p>
      <Button onClick={onAdd} variant="outline" className="mt-4">
        <Plus className="h-4 w-4" />
        Anexar primeira
      </Button>
    </div>
  );
}

type InvoiceRowProps = {
  invoice: JobInvoice;
  fileUrl: string | null;
  onDelete: () => void;
};

function InvoiceRow({ invoice, fileUrl, onDelete }: InvoiceRowProps) {
  const isImage = invoice.mime?.startsWith("image/");
  const isPdf = invoice.mime === "application/pdf";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {invoice.invoice_number && (
            <Badge
              variant="outline"
              className="border-jcn-gold-400/30 bg-jcn-gold-500/10 text-[10px] font-semibold text-jcn-gold-300"
            >
              {invoice.invoice_number}
            </Badge>
          )}
          <span className="truncate text-sm font-semibold text-jcn-ice">
            {invoice.file_name}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jcn-ice/55">
          {invoice.sent_at && (
            <span>
              enviada em{" "}
              {format(new Date(invoice.sent_at), "d 'de' MMM 'de' yyyy", {
                locale: ptBR,
              })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="text-right">
          <div className="text-base font-black text-jcn-gold-300">
            {invoice.amount != null
              ? formatCurrency(Number(invoice.amount))
              : "—"}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {fileUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(fileUrl, "_blank")}
              className="h-9 w-9 p-0"
              title="Ver fatura"
            >
              {isPdf ? (
                <FileText className="h-4 w-4" />
              ) : isImage ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-9 w-9 p-0 text-rose-300/70 hover:text-rose-300"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
