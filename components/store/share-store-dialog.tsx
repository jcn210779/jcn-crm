"use client";

import { Copy, Loader2, MessageCircle, RefreshCw } from "lucide-react";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "https://jcn-crm.vercel.app";
}

export function ShareStoreDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");
  const [rotatedAt, setRotatedAt] = useState<string | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("store_share")
      .select("token, rotated_at, last_used_at")
      .single();
    if (data) {
      setToken(data.token);
      setRotatedAt(data.rotated_at);
      setLastUsedAt(data.last_used_at);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const url = `${getBaseUrl()}/deposito/${token}`;

  function copy() {
    if (!navigator.clipboard) {
      toast.error("Navegador não suporta copiar");
      return;
    }
    void navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copiado");
    });
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(
      `Link do depósito JCN — só você tem acesso, não compartilha:\n\n${url}`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  async function rotate() {
    if (
      !confirm(
        "Gerar link novo? O link atual vai parar de funcionar AGORA.\n\nVocê vai precisar mandar o link novo pro menino do depósito.",
      )
    )
      return;
    setRotating(true);
    const res = await fetch("/api/deposito/rotate", { method: "POST" });
    setRotating(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(`Erro: ${err.error ?? res.statusText}`);
      return;
    }
    toast.success("Link novo gerado");
    await load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar com o depósito</DialogTitle>
          <DialogDescription>
            Link público pro menino do depósito ver e mexer no estoque (sem
            login). Só ele tem acesso — não compartilha com ninguém.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-jcn-gold-300" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                Link
              </Label>
              <div className="flex gap-2">
                <Input value={url} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={copy} className="shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-jcn-ice/45">
                {rotatedAt && (
                  <>
                    Link gerado{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(rotatedAt))}
                    {lastUsedAt && (
                      <>
                        {" · "}último uso{" "}
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(lastUsedAt))}
                      </>
                    )}
                  </>
                )}
              </p>
            </div>

            <Button onClick={shareWhatsApp} className="w-full">
              <MessageCircle className="h-4 w-4" />
              Enviar no WhatsApp
            </Button>

            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200/85">
              <p className="font-bold">⚠️ Permissões do link:</p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                <li>Ver lista completa do depósito</li>
                <li>Fazer entrada e saída (saída obriga indicar obra)</li>
                <li>
                  <strong>NÃO pode</strong> criar item novo, editar nome, nem
                  apagar
                </li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={rotate}
            disabled={rotating || loading}
            className="text-rose-300 hover:bg-rose-500/15"
          >
            {rotating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Gerar link novo (invalida atual)
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
