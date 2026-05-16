"use client";

import { Camera, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
  uploadJobPhoto,
} from "@/lib/job-photos";
import { PHOTO_CATEGORY_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { PHOTO_CATEGORIES, type PhotoCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  userEmail: string;
  /** Categoria pré-selecionada (default `during`). */
  defaultCategory?: PhotoCategory;
  /** Próximo display_order (max + 1) — pode passar 0 se ordem livre. */
  nextOrder?: number;
};

const ACCEPT_ATTR = ALLOWED_PHOTO_MIME_TYPES.join(",");

type Selected = {
  file: File;
  previewUrl: string;
};

/**
 * Dialog pra subir fotos do job.
 *
 * UX:
 * - Categoria (3 botões: Antes / Durante / Depois)
 * - Picker dual: "Galeria" (input file padrão) + "Câmera" (input com capture)
 * - Suporte múltiplos arquivos: input[multiple], upload serial com progress
 * - Preview grid das selecionadas com botão X pra remover antes de enviar
 * - Legenda (textarea, opcional) — aplicada IGUAL pra todas as fotos do batch
 * - Submit chama uploadJobPhoto() pra cada uma, com toast de progresso
 */
export function UploadPhotoDialog({
  open,
  onOpenChange,
  jobId,
  userEmail,
  defaultCategory = "during",
  nextOrder = 0,
}: Props) {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<PhotoCategory>(defaultCategory);
  const [caption, setCaption] = useState("");
  const [selected, setSelected] = useState<Selected[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  // Reset quando abre/fecha
  useEffect(() => {
    if (open) {
      setCategory(defaultCategory);
      setCaption("");
      setSelected([]);
      setUploading(false);
      setProgress(null);
    } else {
      // Revogar object URLs pra evitar leak
      setSelected((current) => {
        current.forEach((s) => URL.revokeObjectURL(s.previewUrl));
        return [];
      });
    }
  }, [open, defaultCategory]);

  // Cleanup geral ao desmontar
  useEffect(() => {
    return () => {
      selected.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const validated: Selected[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        errors.push(`${file.name}: maior que 10 MB`);
        return;
      }
      const mime = (file.type || "").toLowerCase();
      const isAllowed =
        ALLOWED_PHOTO_MIME_TYPES.some((m) => m === mime) ||
        // HEIC do iPhone às vezes vem sem mime type — aceita se extensão bater
        /\.(heic|heif)$/i.test(file.name);
      if (!isAllowed) {
        errors.push(`${file.name}: formato não aceito`);
        return;
      }
      validated.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (errors.length > 0) {
      toast.error("Algumas fotos foram ignoradas", {
        description: errors.slice(0, 3).join(" · "),
      });
    }

    if (validated.length > 0) {
      setSelected((prev) => [...prev, ...validated]);
    }
  }

  function removeSelected(index: number) {
    setSelected((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  async function handleUpload() {
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma foto.");
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: selected.length });

    const supabase = createSupabaseBrowserClient();
    let successCount = 0;
    let firstError: string | null = null;

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      if (!item) continue;
      const result = await uploadJobPhoto({
        supabase,
        jobId,
        file: item.file,
        category,
        caption: caption.trim() || undefined,
        userEmail,
        displayOrder: nextOrder + i,
      });

      if (result.error) {
        if (!firstError) firstError = result.error;
      } else {
        successCount++;
      }

      setProgress({ done: i + 1, total: selected.length });
    }

    setUploading(false);

    if (successCount === selected.length) {
      toast.success(
        successCount === 1
          ? "Foto adicionada."
          : `${successCount} fotos adicionadas.`,
      );
      onOpenChange(false);
      router.refresh();
    } else if (successCount > 0) {
      toast.warning(
        `${successCount} de ${selected.length} fotos enviadas. ${firstError ?? ""}`,
      );
      router.refresh();
    } else {
      toast.error(`Falha no upload. ${firstError ?? ""}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/[0.08] bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            Adicionar fotos
          </DialogTitle>
          <DialogDescription>
            Suba fotos da obra. Categoriza por momento e adicione legenda
            opcional. Aceita JPG, PNG, WEBP e HEIC. Limite de 10 MB por arquivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Categoria — 3 chips */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Categoria
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {PHOTO_CATEGORIES.map((cat) => {
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-bold uppercase tracking-[0.1em] transition",
                      selected
                        ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_24px_-12px_rgba(250,204,21,0.6)]"
                        : "border-white/[0.08] bg-white/[0.025] text-white/55 hover:border-white/[0.15] hover:text-white",
                    )}
                  >
                    {PHOTO_CATEGORY_LABEL[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pickers — Galeria + Câmera */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Selecionar fotos
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <input
                ref={galleryInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploading}
                className="h-14 flex-col gap-1 border-white/[0.1] bg-white/[0.025] font-semibold"
              >
                <ImagePlus className="h-5 w-5 text-primary" />
                <span className="text-xs">Galeria</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="h-14 flex-col gap-1 border-white/[0.1] bg-white/[0.025] font-semibold"
              >
                <Camera className="h-5 w-5 text-primary" />
                <span className="text-xs">Câmera</span>
              </Button>
            </div>
          </div>

          {/* Preview grid */}
          {selected.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                {selected.length}{" "}
                {selected.length === 1 ? "foto selecionada" : "fotos selecionadas"}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {selected.map((item, idx) => (
                  <div
                    key={item.previewUrl}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.08] bg-black/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                    {!uploading ? (
                      <button
                        type="button"
                        onClick={() => removeSelected(idx)}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        aria-label="Remover foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Legenda */}
          <div className="space-y-1.5">
            <Label
              htmlFor="photo-caption"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Legenda (opcional)
            </Label>
            <Textarea
              id="photo-caption"
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ex: fundação preparada, demolição concluída, dia 3 de instalação."
              className="resize-none"
              disabled={uploading}
            />
            {selected.length > 1 ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
                Mesma legenda aplicada a todas as {selected.length} fotos.
              </p>
            ) : null}
          </div>

          {/* Progresso */}
          {progress ? (
            <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.15em] text-primary">
                <span>Enviando</span>
                <span>
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-jcn-gold-400 to-primary transition-all duration-300"
                  style={{
                    width: `${(progress.done / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || selected.length === 0}
            className="font-semibold"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Enviar{" "}
                {selected.length > 0
                  ? selected.length === 1
                    ? "1 foto"
                    : `${selected.length} fotos`
                  : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
