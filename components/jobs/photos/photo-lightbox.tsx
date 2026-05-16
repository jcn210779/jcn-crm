"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteJobPhoto } from "@/lib/job-photos";
import { PHOTO_CATEGORY_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { JobPhoto } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lista de fotos do contexto atual (categoria filtrada). */
  photos: JobPhoto[];
  /** Mapa storage_path -> signed URL. */
  signedUrls: Record<string, string | null>;
  /** Index inicial dentro do array `photos`. */
  initialIndex: number;
};

/**
 * Lightbox fullscreen pra visualizar fotos.
 *
 * - Foto centralizada, max-h 90vh, fundo preto translúcido com blur
 * - Setas prev/next (desktop) + swipe horizontal (mobile)
 * - Tecla ESC fecha, ArrowLeft/ArrowRight navega
 * - Botão "Excluir foto" com confirmação dupla (regra anti-DELETE)
 * - Legenda + categoria embaixo
 */
export function PhotoLightbox({
  open,
  onOpenChange,
  photos,
  signedUrls,
  initialIndex,
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(initialIndex);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Swipe tracking
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Reset quando abre
  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setConfirmDelete(false);
      setDeleting(false);
    }
  }, [open, initialIndex]);

  // Atalhos teclado
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
        setConfirmDelete(false);
      } else if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(photos.length - 1, i + 1));
        setConfirmDelete(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length, onOpenChange]);

  // Bloqueia scroll do body
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open || photos.length === 0) return null;

  const current = photos[Math.min(index, photos.length - 1)];
  if (!current) return null;
  const signedUrl = signedUrls[current.storage_path] ?? null;

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
    setConfirmDelete(false);
  }

  function goNext() {
    setIndex((i) => Math.min(photos.length - 1, i + 1));
    setConfirmDelete(false);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchEndX.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    touchEndX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd() {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const dx = touchEndX.current - touchStartX.current;
    const threshold = 60;
    if (dx > threshold) goPrev();
    else if (dx < -threshold) goNext();
    touchStartX.current = null;
    touchEndX.current = null;
  }

  async function handleDelete() {
    if (!current) return;
    setDeleting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await deleteJobPhoto({ supabase, photo: current });
    setDeleting(false);

    if (error) {
      toast.error(`Erro ao remover: ${error}`);
      return;
    }
    toast.success("Foto removida.");
    setConfirmDelete(false);

    // Fecha se era a última, senão move pra próxima/anterior
    if (photos.length === 1) {
      onOpenChange(false);
    } else if (index >= photos.length - 1) {
      setIndex(Math.max(0, photos.length - 2));
    }
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de foto"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white md:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/15 font-bold text-primary"
          >
            {PHOTO_CATEGORY_LABEL[current.category]}
          </Badge>
          <span>
            {index + 1} / {photos.length}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="h-9 border-white/15 bg-white/[0.04] text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
          Fechar
        </Button>
      </div>

      {/* Foto */}
      <div
        className="relative flex flex-1 items-center justify-center px-2 md:px-12"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Prev */}
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className={cn(
              "absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-25 md:left-6",
            )}
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}

        {/* Image */}
        <div className="max-h-[75vh] max-w-full">
          {signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt={current.caption ?? current.file_name ?? "Foto da obra"}
              className="max-h-[75vh] max-w-full rounded-2xl object-contain"
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-white/45">
              <AlertTriangle className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Next */}
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={index >= photos.length - 1}
            className={cn(
              "absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-25 md:right-6",
            )}
            aria-label="Próxima foto"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        ) : null}
      </div>

      {/* Footer: legenda + metadata + delete */}
      <div className="border-t border-white/10 bg-black/60 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            {current.caption ? (
              <p className="text-sm font-semibold leading-relaxed text-white">
                {current.caption}
              </p>
            ) : (
              <p className="text-sm font-semibold italic text-white/35">
                Sem legenda
              </p>
            )}
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Adicionada{" "}
              {format(parseISO(current.created_at), "dd 'de' MMM 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!confirmDelete ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="h-9 border-rose-500/30 bg-rose-500/[0.08] text-rose-300 hover:bg-rose-500/15"
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4" />
                Excluir foto
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-rose-300" />
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-rose-300">
                  Confirmar?
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  className="h-7 border-white/15 bg-white/[0.04] text-xs"
                  disabled={deleting}
                >
                  Não
                </Button>
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-7 bg-rose-500 text-xs font-semibold text-white hover:bg-rose-600"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Removendo
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Sim, excluir
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
