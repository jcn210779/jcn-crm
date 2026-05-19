"use client";

import { Loader2, MessageSquare, Send } from "lucide-react";
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
import type { FollowUp } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp: FollowUp;
  onDone: () => void;
};

export function SendFollowUpDialog({
  open,
  onOpenChange,
  followUp,
  onDone,
}: Props) {
  const [subject, setSubject] = useState(followUp.draft_subject);
  const [body, setBody] = useState(followUp.draft_body);
  const [sending, setSending] = useState(false);
  const [smsOpened, setSmsOpened] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(followUp.draft_subject);
    setBody(followUp.draft_body);
    setSmsOpened(false);
  }, [open, followUp]);

  const isPending = followUp.status === "pending";
  const isSms = followUp.channel === "sms";

  async function handleSendEmail() {
    setSending(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follow_up_id: followUp.id,
          subject,
          body,
          to_email: followUp.to_email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Erro: ${data.error ?? res.statusText}`);
        return;
      }
      toast.success(`E-mail enviado pra ${followUp.to_email}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSending(false);
    }
  }

  function handleOpenSms() {
    if (!followUp.to_phone) {
      toast.error("Telefone não cadastrado");
      return;
    }
    // Limpa telefone: só dígitos e +
    const cleanPhone = followUp.to_phone.replace(/[^\d+]/g, "");
    const encoded = encodeURIComponent(body);
    // sms:+phone?body=... funciona em iOS e Android
    const smsUrl = `sms:${cleanPhone}?&body=${encoded}`;
    window.location.href = smsUrl;
    setSmsOpened(true);
  }

  async function handleMarkSmsSent() {
    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("follow_ups")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          draft_subject: subject,
          draft_body: body,
        })
        .eq("id", followUp.id);
      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }
      toast.success("Marcado como enviado");
      onDone();
    } finally {
      setSending(false);
    }
  }

  const charCount = body.length;
  const smsSegments = Math.ceil(charCount / 160);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-background sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            {isSms ? (
              <>
                <MessageSquare className="h-5 w-5 text-violet-300" />
                {isPending ? "Revisar e enviar SMS" : "Detalhes do SMS"}
              </>
            ) : (
              <>
                <Send className="h-5 w-5 text-jcn-gold-300" />
                {isPending ? "Revisar e enviar e-mail" : "Detalhes do e-mail"}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Pra: <b>{followUp.to_name ?? "—"}</b>{" "}
            <span className="text-jcn-ice/45">
              &lt;{isSms ? followUp.to_phone : followUp.to_email}&gt;
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isSms && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                Assunto
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!isPending || sending}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              {isSms ? "Mensagem" : "Corpo do e-mail"}
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={isSms ? 6 : 18}
              disabled={!isPending || sending}
              className="font-mono text-xs leading-relaxed"
            />
            {isSms && (
              <p className="text-[11px] text-jcn-ice/55">
                {charCount} caracteres
                {smsSegments > 1 && (
                  <span className="ml-1 text-amber-300">
                    ({smsSegments} SMS — pode dividir em mais de uma mensagem)
                  </span>
                )}
              </p>
            )}
            {isPending && !isSms && (
              <p className="text-[11px] text-jcn-ice/45">
                Edite à vontade antes de enviar. Após enviar, fica registrado e
                não pode mais alterar.
              </p>
            )}
            {isPending && isSms && (
              <p className="text-[11px] text-jcn-ice/45">
                Edite se quiser. Ao clicar em Abrir SMS, o app de mensagem do
                seu celular abre com o texto pronto.
              </p>
            )}
          </div>

          {smsOpened && isPending && (
            <div className="rounded-lg border border-jcn-gold-400/30 bg-jcn-gold-500/[0.08] px-3 py-2 text-sm">
              <p className="font-bold text-jcn-gold-300">
                📱 Aplicativo de SMS aberto.
              </p>
              <p className="text-xs text-jcn-ice/65">
                Quando enviar a mensagem no seu celular, volta aqui e clica em
                <b> Marcar como enviado</b>.
              </p>
            </div>
          )}

          {!isPending && followUp.sent_at && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm">
              ✅ Enviado em{" "}
              {new Date(followUp.sent_at).toLocaleString("pt-BR")}
              {followUp.resend_email_id && (
                <span className="ml-2 text-[10px] text-jcn-ice/45">
                  ID: {followUp.resend_email_id}
                </span>
              )}
            </div>
          )}

          {followUp.error_message && (
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              ⚠️ {followUp.error_message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            {isPending ? "Cancelar" : "Fechar"}
          </Button>

          {isPending && !isSms && (
            <Button
              onClick={handleSendEmail}
              disabled={sending || !subject.trim() || !body.trim()}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar e-mail
                </>
              )}
            </Button>
          )}

          {isPending && isSms && !smsOpened && (
            <Button
              onClick={handleOpenSms}
              disabled={!body.trim() || !followUp.to_phone}
              className="bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 border-violet-400/40"
              variant="outline"
            >
              <MessageSquare className="h-4 w-4" />
              Abrir SMS no celular
            </Button>
          )}

          {isPending && isSms && smsOpened && (
            <Button onClick={handleMarkSmsSent} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Marcar como enviado
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
