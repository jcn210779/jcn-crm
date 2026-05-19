"use client";

import { Loader2, Send } from "lucide-react";
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

  useEffect(() => {
    if (!open) return;
    setSubject(followUp.draft_subject);
    setBody(followUp.draft_body);
  }, [open, followUp]);

  const isPending = followUp.status === "pending";

  async function handleSend() {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-background sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            {isPending ? "Revisar e enviar" : "Detalhes do follow-up"}
          </DialogTitle>
          <DialogDescription>
            Pra: <b>{followUp.to_name ?? followUp.to_email}</b>{" "}
            <span className="text-jcn-ice/45">&lt;{followUp.to_email}&gt;</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Corpo do e-mail
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              disabled={!isPending || sending}
              className="font-mono text-xs leading-relaxed"
            />
            {isPending && (
              <p className="text-[11px] text-jcn-ice/45">
                Edite à vontade antes de enviar. Após enviar, fica registrado e
                não pode mais alterar.
              </p>
            )}
          </div>

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
          {isPending && (
            <Button
              onClick={handleSend}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
