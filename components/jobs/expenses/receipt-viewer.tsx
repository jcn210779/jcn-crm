"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import type { JobExpense } from "@/lib/types";

type Props = {
  expense: JobExpense;
  signedUrl: string;
  open: boolean;
  onClose: () => void;
};

export function ReceiptViewer({ expense, signedUrl, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-jcn-midnight-dark/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-4 top-4 z-10 h-10 w-10 rounded-full bg-white/10 p-0 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      <div
        className="flex max-h-[90vh] max-w-[95vw] flex-col items-center gap-4 px-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt={expense.description}
          className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
        />

        <div className="max-w-md text-center">
          <p className="text-base font-bold text-jcn-ice">{expense.description}</p>
          <p className="mt-1 text-xs text-jcn-ice/65">
            {EXPENSE_CATEGORY_LABEL[expense.category]} ·{" "}
            {formatCurrency(Number(expense.amount))}
            {expense.vendor && ` · ${expense.vendor}`}
          </p>
        </div>
      </div>
    </div>
  );
}
