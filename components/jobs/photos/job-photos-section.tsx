"use client";

import { Camera, ImageIcon, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PhotoLightbox } from "@/components/jobs/photos/photo-lightbox";
import { UploadPhotoDialog } from "@/components/jobs/photos/upload-photo-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSignedPhotoUrls } from "@/lib/job-photos";
import { PHOTO_CATEGORY_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  PHOTO_CATEGORIES,
  type JobPhoto,
  type PhotoCategory,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  jobId: string;
  userEmail: string;
  photos: JobPhoto[];
  /** Mapa storage_path -> signed URL gerado no server (TTL 1h). */
  initialSignedUrls: Record<string, string | null>;
};

const TAB_TONE: Record<PhotoCategory, string> = {
  before: "border-sky-400/40 bg-sky-500/10 text-sky-300",
  during: "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300",
  after: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
};

export function JobPhotosSection({
  jobId,
  userEmail,
  photos,
  initialSignedUrls,
}: Props) {
  const [activeTab, setActiveTab] = useState<PhotoCategory>("during");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [signedUrls, setSignedUrls] =
    useState<Record<string, string | null>>(initialSignedUrls);

  // Refresh signed URLs no client se mudou (router.refresh re-fetcha photos
  // mas urls vêm do server inicial). Re-gera se aparecer foto sem url no mapa.
  useEffect(() => {
    const missing = photos
      .map((p) => p.storage_path)
      .filter((path) => !(path in signedUrls));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const fresh = await getSignedPhotoUrls({
        supabase,
        storagePaths: missing,
      });
      if (!cancelled) {
        setSignedUrls((prev) => ({ ...prev, ...fresh }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, signedUrls]);

  // Sincroniza initialSignedUrls quando muda (router.refresh)
  useEffect(() => {
    setSignedUrls((prev) => ({ ...prev, ...initialSignedUrls }));
  }, [initialSignedUrls]);

  const counts = useMemo(() => {
    const acc: Record<PhotoCategory, number> = {
      before: 0,
      during: 0,
      after: 0,
    };
    photos.forEach((p) => {
      acc[p.category] += 1;
    });
    return acc;
  }, [photos]);

  const filtered = useMemo(
    () =>
      photos
        .filter((p) => p.category === activeTab)
        .sort((a, b) => {
          if (a.display_order !== b.display_order) {
            return a.display_order - b.display_order;
          }
          return b.created_at.localeCompare(a.created_at);
        }),
    [photos, activeTab],
  );

  const nextOrder = useMemo(() => {
    if (photos.length === 0) return 0;
    return Math.max(...photos.map((p) => p.display_order)) + 1;
  }, [photos]);

  function openLightbox(idx: number) {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  }

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/45">
            Fotos da obra
          </h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-black tracking-[-0.02em] text-white">
              {photos.length}
            </span>
            <span className="text-sm font-semibold text-white/45">
              {photos.length === 1 ? "foto" : "fotos"} no total
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/55">
            <span>{counts.before} antes</span>
            <span className="text-white/20">·</span>
            <span>{counts.during} durante</span>
            <span className="text-white/20">·</span>
            <span>{counts.after} depois</span>
          </div>
        </div>

        <Button
          onClick={() => setUploadOpen(true)}
          className="h-10 font-semibold"
        >
          <Plus className="h-4 w-4" />
          Adicionar foto
        </Button>
      </div>

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {PHOTO_CATEGORIES.map((cat) => {
          const active = activeTab === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-bold uppercase tracking-[0.1em] transition",
                active
                  ? TAB_TONE[cat]
                  : "border-white/[0.06] bg-white/[0.02] text-white/45 hover:border-white/[0.12] hover:text-white/75",
              )}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>{PHOTO_CATEGORY_LABEL[cat]}</span>
                <span
                  className={cn(
                    "text-[10px] font-bold opacity-70",
                    active ? "" : "text-white/35",
                  )}
                >
                  {counts[cat]}{" "}
                  {counts[cat] === 1 ? "foto" : "fotos"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="mt-5">
        {filtered.length === 0 ? (
          <EmptyCategory
            category={activeTab}
            onAdd={() => {
              setUploadOpen(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((photo, idx) => {
              const url = signedUrls[photo.storage_path];
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => openLightbox(idx)}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-black/40 transition hover:border-primary/40 hover:shadow-[0_0_24px_-12px_rgba(250,204,21,0.5)]"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={photo.caption ?? photo.file_name ?? "Foto da obra"}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/25">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  {photo.caption ? (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2">
                      <p className="line-clamp-2 text-[11px] font-semibold text-white">
                        {photo.caption}
                      </p>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <UploadPhotoDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        jobId={jobId}
        userEmail={userEmail}
        defaultCategory={activeTab}
        nextOrder={nextOrder}
      />
      <PhotoLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        photos={filtered}
        signedUrls={signedUrls}
        initialIndex={lightboxIndex}
      />
    </section>
  );
}

function EmptyCategory({
  category,
  onAdd,
}: {
  category: PhotoCategory;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.015] p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Camera className="h-5 w-5" />
      </div>
      <h4 className="mt-4 flex flex-wrap items-center justify-center gap-2 text-base font-bold text-white">
        <span>Nenhuma foto na categoria</span>
        <Badge
          variant="outline"
          className="border-primary/25 bg-primary/10 font-bold text-primary"
        >
          {PHOTO_CATEGORY_LABEL[category]}
        </Badge>
      </h4>
      <p className="mt-2 text-sm text-white/55">
        Suba a primeira foto pra começar a documentar este momento da obra.
      </p>
      <Button onClick={onAdd} className="mt-4 font-semibold">
        <Plus className="h-4 w-4" />
        Adicionar foto
      </Button>
    </div>
  );
}
