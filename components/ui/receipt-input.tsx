"use client";

import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_SIZE_BYTES,
} from "@/lib/job-expenses";
import { cn } from "@/lib/utils";

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Label do botão de adicionar. Default "Anexar recibo". */
  label?: string;
  /** Versão compacta (pra usar em linhas de tabela). */
  compact?: boolean;
  disabled?: boolean;
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT = ALLOWED_RECEIPT_MIME_TYPES.join(",");

export function ReceiptInput({
  file,
  onChange,
  label = "Anexar recibo",
  compact = false,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePick() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_RECEIPT_SIZE_BYTES) {
      onChange(null);
      e.target.value = "";
      alert("Arquivo grande demais (máximo 20 MB).");
      return;
    }
    onChange(f);
    e.target.value = "";
  }

  function handleRemove() {
    onChange(null);
  }

  const isImage = file?.type.startsWith("image/");

  if (file) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-jcn-gold-400/30 bg-jcn-gold-500/[0.08] p-2.5",
          compact && "p-1.5",
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-jcn-gold-500/15 text-jcn-gold-300",
            compact && "h-7 w-7",
          )}
        >
          {isImage ? (
            <ImageIcon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          ) : (
            <FileText className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate font-semibold text-jcn-ice",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {file.name}
          </div>
          <div className="text-[10px] text-jcn-ice/55">{humanSize(file.size)}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={disabled}
          className="h-7 w-7 p-0 text-jcn-ice/55 hover:text-rose-300"
          title="Remover"
        >
          <X className="h-4 w-4" />
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePick}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-jcn-ice/55 transition hover:border-jcn-gold-400/40 hover:bg-jcn-gold-500/[0.05] hover:text-jcn-gold-300",
          compact ? "py-1.5 text-[11px]" : "w-full",
          disabled && "opacity-50",
        )}
      >
        <Paperclip className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}
