"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  Mail,
  MailX,
  MessageSquare,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SendFollowUpDialog } from "@/components/follow-ups/send-follow-up-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FOLLOW_UP_KIND_LABEL,
  FOLLOW_UP_STATUS_LABEL,
} from "@/lib/follow-up-templates";
import type { FollowUp, FollowUpStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  followUps: FollowUp[];
};

type FilterStatus = FollowUpStatus | "all";

const STATUS_ACCENT: Record<FollowUpStatus, string> = {
  pending: "border-jcn-gold-400/40 bg-jcn-gold-500/15 text-jcn-gold-300",
  sent: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  skipped: "border-white/[0.1] bg-white/[0.04] text-jcn-ice/55",
  failed: "border-rose-400/40 bg-rose-500/15 text-rose-300",
};

export function FollowUpsView({ followUps }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [target, setTarget] = useState<FollowUp | null>(null);

  const counts = useMemo(() => {
    const c: Record<FollowUpStatus | "all", number> = {
      all: followUps.length,
      pending: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    };
    for (const f of followUps) c[f.status]++;
    return c;
  }, [followUps]);

  const filtered = useMemo(() => {
    if (filter === "all") return followUps;
    return followUps.filter((f) => f.status === filter);
  }, [followUps, filter]);

  async function handleSkip(id: string) {
    const supabase = (await import("@/lib/supabase-client")).createSupabaseBrowserClient();
    const { error } = await supabase
      .from("follow_ups")
      .update({ status: "skipped" })
      .eq("id", id);
    if (error) {
      alert(`Erro: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-5 px-4 md:px-6">
      {/* Header */}
      <header className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
              Follow-ups
            </h1>
            <p className="text-xs text-jcn-ice/55">
              Drafts gerados automaticamente. Você revisa e envia (ou pula).
              Cron diário às 9h ET cria novos.
            </p>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <FilterChip
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
          icon={Clock}
          label="Aguardando"
          count={counts.pending}
        />
        <FilterChip
          active={filter === "sent"}
          onClick={() => setFilter("sent")}
          icon={CheckCircle2}
          label="Enviados"
          count={counts.sent}
        />
        <FilterChip
          active={filter === "skipped"}
          onClick={() => setFilter("skipped")}
          icon={SkipForward}
          label="Pulados"
          count={counts.skipped}
        />
        <FilterChip
          active={filter === "failed"}
          onClick={() => setFilter("failed")}
          icon={XCircle}
          label="Falharam"
          count={counts.failed}
        />
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          icon={Mail}
          label="Tudo"
          count={counts.all}
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
          <MailX className="mx-auto h-10 w-10 text-jcn-ice/30" />
          <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
            {filter === "pending"
              ? "Nenhum follow-up aguardando"
              : `Nenhum follow-up ${FOLLOW_UP_STATUS_LABEL[filter]?.toLowerCase() ?? ""}`}
          </p>
          <p className="mt-1 text-xs text-jcn-ice/40">
            Cron diário às 9h ET cria drafts baseado em leads novos, estimates
            esfriando e mudança de fase de jobs.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((fu) => (
            <FollowUpCard
              key={fu.id}
              followUp={fu}
              onOpen={() => setTarget(fu)}
              onSkip={() => handleSkip(fu.id)}
            />
          ))}
        </div>
      )}

      {/* Dialog enviar */}
      {target && (
        <SendFollowUpDialog
          open={!!target}
          onOpenChange={(o) => {
            if (!o) setTarget(null);
          }}
          followUp={target}
          onDone={() => {
            setTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
          : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold normal-case">
        {count}
      </span>
    </button>
  );
}

function FollowUpCard({
  followUp,
  onOpen,
  onSkip,
}: {
  followUp: FollowUp;
  onOpen: () => void;
  onSkip: () => void;
}) {
  const isPending = followUp.status === "pending";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-white/[0.025] p-4 md:flex-row md:items-center md:justify-between",
        isPending
          ? "border-jcn-gold-400/20 hover:border-jcn-gold-400/40 hover:bg-white/[0.04]"
          : "border-white/[0.06] opacity-80",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            followUp.channel === "sms"
              ? "border-violet-400/40 bg-violet-500/15 text-violet-300 border"
              : STATUS_ACCENT[followUp.status],
          )}
        >
          {followUp.channel === "sms" ? (
            <MessageSquare className="h-4 w-4" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-jcn-ice">
              {followUp.to_name ?? followUp.to_email ?? followUp.to_phone}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                followUp.channel === "sms"
                  ? "border-violet-400/40 bg-violet-500/15 text-violet-300"
                  : "border-jcn-gold-400/40 bg-jcn-gold-500/15 text-jcn-gold-300",
              )}
            >
              {followUp.channel === "sms" ? "📱 SMS" : "✉️ Email"}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                STATUS_ACCENT[followUp.status],
              )}
            >
              {FOLLOW_UP_STATUS_LABEL[followUp.status] ?? followUp.status}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/[0.1] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/55"
            >
              {FOLLOW_UP_KIND_LABEL[followUp.kind] ?? followUp.kind}
            </Badge>
          </div>
          <div className="mt-1 truncate text-xs text-jcn-ice/65">
            {followUp.draft_subject}
          </div>
          <div className="mt-0.5 text-[11px] text-jcn-ice/45">
            {followUp.to_email ?? followUp.to_phone} ·{" "}
            {formatDistanceToNow(new Date(followUp.created_at), {
              locale: ptBR,
              addSuffix: true,
            })}
          </div>
          {followUp.error_message && (
            <div className="mt-1 text-[11px] font-semibold text-rose-300">
              ⚠️ {followUp.error_message}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isPending && (
          <>
            <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs">
              <SkipForward className="h-3.5 w-3.5" />
              Pular
            </Button>
            <Button size="sm" onClick={onOpen} className="text-xs">
              <Mail className="h-3.5 w-3.5" />
              Revisar e enviar
            </Button>
          </>
        )}
        {!isPending && (
          <Button size="sm" variant="ghost" onClick={onOpen} className="text-xs">
            Ver detalhes
          </Button>
        )}
      </div>
    </div>
  );
}
