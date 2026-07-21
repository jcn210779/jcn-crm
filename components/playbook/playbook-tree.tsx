"use client";

import { Check, ChevronRight, Phone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type StepStatus = "todo" | "doing" | "done" | "blocked";

export type PlaybookStep = {
  id: string;
  title: string;
  status: StepStatus;
  responsavel: string;
  telefone: string;
  notas: string;
};

export type PlaybookPhase = {
  id: string;
  title: string;
  open: boolean;
  steps: PlaybookStep[];
};

export type PlaybookData = {
  version: number;
  phases: PlaybookPhase[];
};

const STATUS_ORDER: StepStatus[] = ["todo", "doing", "done", "blocked"];

const STATUS_META: Record<
  StepStatus,
  { label: string; chip: string; dot: string; node: string }
> = {
  todo: {
    label: "A fazer",
    chip: "border-white/15 text-white/55",
    dot: "bg-white/40",
    node: "border-white/15 text-white/50",
  },
  doing: {
    label: "Em andamento",
    chip: "border-sky-400/50 text-sky-300 bg-sky-400/10",
    dot: "bg-sky-400",
    node: "border-sky-400/60 text-sky-300",
  },
  done: {
    label: "Feito",
    chip: "border-emerald-400/50 text-emerald-300 bg-emerald-400/10",
    dot: "bg-emerald-400",
    node: "border-emerald-400 bg-emerald-500 text-white",
  },
  blocked: {
    label: "Travado",
    chip: "border-red-400/50 text-red-300 bg-red-400/10",
    dot: "bg-red-400",
    node: "border-red-400/60 text-red-300",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function mkStep(
  title: string,
  extra?: Partial<Omit<PlaybookStep, "id" | "title">>,
): PlaybookStep {
  return {
    id: uid(),
    title,
    status: extra?.status ?? "todo",
    responsavel: extra?.responsavel ?? "",
    telefone: extra?.telefone ?? "",
    notas: extra?.notas ?? "",
  };
}

function mkPhase(title: string, steps: PlaybookStep[], open = false): PlaybookPhase {
  return { id: uid(), title, open, steps };
}

function defaultData(): PlaybookData {
  return {
    version: 1,
    phases: [
      mkPhase(
        "1. Comprar & Fechar (Closing)",
        [
          mkStep("Assinar Purchase & Sale (P&S) com contingências", {
            responsavel: "Advogado RE",
            notas:
              "Contingências ativas: inspeção + financiamento + zoning. É a rede pra sair sem perder o depósito.",
          }),
          mkStep(
            "Mapear os prazos das contingências (inspeção / financiamento / zoning)",
            {
              notas:
                "CRÍTICO: cada contingência tem data limite. Se expirar antes da inspeção e do arquiteto darem OK, o depósito vira risco.",
            },
          ),
          mkStep(
            "Inspeção completa: estrutural, telhado, fundação, elétrica, encanamento, HVAC",
            { responsavel: "Inspetor" },
          ),
          mkStep("Testes de casa antiga: chumbo / asbestos / radônio / pragas"),
          mkStep("Title search + title insurance", { responsavel: "Advogado RE" }),
          mkStep("Fechar mortgage: down, taxa, pontos + appraisal do lender", {
            responsavel: "Lender",
          }),
          mkStep("Confirmar earnest money + data de closing"),
          mkStep("CLOSING — compra fechada"),
        ],
        true,
      ),
      mkPhase("2. Permits & Zoning", [
        mkStep("Reunião com arquiteto — validar tese / zoning (feasibility do ARV)", {
          responsavel: "Arquiteto",
          notas: "O ARV só existe se você PODE legalmente construir o que gera esse valor.",
        }),
        mkStep("Confirmar zoning de Somerville + variance / special permit se preciso"),
        mkStep("Aplicar permits"),
        mkStep("Permits liberados"),
      ]),
      mkPhase("3. Demolição", [
        mkStep("Iniciar demo"),
        mkStep("Dumpster / carrego / descarte"),
      ]),
      mkPhase("4. Reforma estrutural & sistemas", [
        mkStep("Estrutural"),
        mkStep("Elétrica, encanamento e HVAC (rough-in)"),
        mkStep("Inspeção de rough (elétrica / encanamento)"),
      ]),
      mkPhase("5. Cozinha & Banheiros", [
        mkStep("Cozinha: cabinets, countertop, appliances", {
          notas: "Prazo de entrega do countertop costuma travar o resto.",
        }),
        mkStep("Banheiros"),
      ]),
      mkPhase("6. Acabamento", [
        mkStep("Pintura"),
        mkStep("Piso"),
        mkStep("Trim / acabamento final"),
      ]),
      mkPhase("7. Exterior & Curb appeal", [
        mkStep("Siding / deck / paisagismo"),
        mkStep("Fachada e entrada"),
      ]),
      mkPhase("8. Inspeção final & limpeza", [
        mkStep("Inspeção final / CO (certificate of occupancy)"),
        mkStep("Limpeza pesada"),
      ]),
      mkPhase("9. Staging & Fotos", [
        mkStep("Staging"),
        mkStep("Fotos profissionais"),
      ]),
      mkPhase("10. Listar no mercado", [
        mkStep("Definir preço de lista com corretor", { responsavel: "Corretor" }),
        mkStep("Listar (MLS / Zillow)"),
      ]),
      mkPhase("11. Ofertas & Sob contrato", [
        mkStep("Receber e avaliar ofertas", { responsavel: "Corretor" }),
        mkStep("Aceitar oferta — sob contrato"),
        mkStep("Inspeção do comprador"),
      ]),
      mkPhase("12. Venda fechada", [
        mkStep("Closing da venda — lucro realizado"),
      ]),
    ],
  };
}

function normalize(input: PlaybookData | null): PlaybookData {
  if (input && Array.isArray(input.phases) && input.phases.length > 0) {
    return {
      version: input.version ?? 1,
      phases: input.phases.map((p) => ({
        id: p.id ?? uid(),
        title: p.title ?? "",
        open: p.open ?? false,
        steps: (p.steps ?? []).map((s) => ({
          id: s.id ?? uid(),
          title: s.title ?? "",
          status: (s.status as StepStatus) ?? "todo",
          responsavel: s.responsavel ?? "",
          telefone: s.telefone ?? "",
          notas: s.notas ?? "",
        })),
      })),
    };
  }
  return defaultData();
}

function phaseStatus(p: PlaybookPhase): StepStatus {
  if (!p.steps.length) return "todo";
  const done = p.steps.filter((s) => s.status === "done").length;
  const blocked = p.steps.some((s) => s.status === "blocked");
  const doing = p.steps.some((s) => s.status === "doing");
  if (done === p.steps.length) return "done";
  if (blocked) return "blocked";
  if (doing || done) return "doing";
  return "todo";
}

// ---------------------------------------------------------------------------
// Textarea auto-grow
// ---------------------------------------------------------------------------
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => {
    resize();
  }, [value, resize]);
  return (
    <textarea
      ref={ref}
      aria-label={ariaLabel}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn("resize-none overflow-hidden", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
type SaveState = "saved" | "saving" | "error";

export function PlaybookTree({ initialData }: { initialData: PlaybookData | null }) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [data, setData] = useState<PlaybookData>(() => normalize(initialData));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const seededRef = useRef(false);

  const persist = useCallback(
    async (next: PlaybookData) => {
      savingRef.current = true;
      setSaveState("saving");
      const { error } = await supabase
        .from("flip_playbook")
        .update({ data: next, updated_at: new Date().toISOString() })
        .eq("id", true);
      savingRef.current = false;
      setSaveState(error ? "error" : "saved");
    },
    [supabase],
  );

  const commit = useCallback(
    (next: PlaybookData) => {
      setData(next);
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), 600);
    },
    [persist],
  );

  // Semeia o default no servidor se o documento veio vazio (1ª abertura)
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const empty = !initialData || !initialData.phases || initialData.phases.length === 0;
    if (empty) persist(defaultData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza ao voltar pra aba (pega o que foi editado no outro aparelho)
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      if (savingRef.current || saveState === "saving") return;
      const { data: row } = await supabase
        .from("flip_playbook")
        .select("data")
        .eq("id", true)
        .single();
      const remote = (row?.data ?? null) as PlaybookData | null;
      if (remote?.phases?.length) setData(normalize(remote));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [supabase, saveState]);

  // ---- mutações ----
  const patchPhase = (pid: string, fn: (p: PlaybookPhase) => PlaybookPhase) =>
    commit({ ...data, phases: data.phases.map((p) => (p.id === pid ? fn(p) : p)) });

  const patchStep = (
    pid: string,
    sid: string,
    fn: (s: PlaybookStep) => PlaybookStep,
  ) =>
    patchPhase(pid, (p) => ({
      ...p,
      steps: p.steps.map((s) => (s.id === sid ? fn(s) : s)),
    }));

  const togglePhase = (pid: string) =>
    setData((d) => ({
      ...d,
      phases: d.phases.map((p) => (p.id === pid ? { ...p, open: !p.open } : p)),
    }));

  const cycleStatus = (pid: string, sid: string) =>
    patchStep(pid, sid, (s) => ({
      ...s,
      status: STATUS_ORDER[
        (STATUS_ORDER.indexOf(s.status) + 1) % STATUS_ORDER.length
      ] as StepStatus,
    }));

  const addStep = (pid: string) =>
    patchPhase(pid, (p) => ({ ...p, open: true, steps: [...p.steps, mkStep("Nova etapa")] }));

  const delStep = (pid: string, sid: string, title: string) => {
    if (!confirm(`Remover a etapa "${title || "sem título"}"?`)) return;
    patchPhase(pid, (p) => ({ ...p, steps: p.steps.filter((s) => s.id !== sid) }));
  };

  const addPhase = () =>
    commit({
      ...data,
      phases: [
        ...data.phases,
        mkPhase(`${data.phases.length + 1}. Nova fase`, [], true),
      ],
    });

  const delPhase = (pid: string, title: string) => {
    if (!confirm(`Remover a fase "${title || "sem título"}" e todas as etapas dela?`)) return;
    commit({ ...data, phases: data.phases.filter((p) => p.id !== pid) });
  };

  // ---- progresso ----
  const { total, done } = useMemo(() => {
    let t = 0;
    let d = 0;
    data.phases.forEach((p) => {
      t += p.steps.length;
      d += p.steps.filter((s) => s.status === "done").length;
    });
    return { total: t, done: d };
  }, [data]);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho / progresso */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Processo de Flip
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Do primeiro contato ao closing da venda — fase por fase.
            </p>
          </div>
          <SaveBadge state={saveState} />
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-3xl font-bold tabular-nums text-primary">{pct}%</span>
          <span className="text-xs text-muted-foreground">
            {done} de {total} etapas concluídas
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* Árvore */}
      <div className="relative space-y-3 pl-11">
        <span
          aria-hidden
          className="absolute left-[17px] top-3 bottom-10 w-px bg-white/10"
        />
        {data.phases.map((phase, idx) => {
          const st = phaseStatus(phase);
          const doneCount = phase.steps.filter((s) => s.status === "done").length;
          return (
            <div key={phase.id} className="relative">
              <span
                className={cn(
                  "absolute -left-11 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 bg-background text-sm font-bold tabular-nums shadow",
                  STATUS_META[st].node,
                )}
              >
                {st === "done" ? <Check className="h-4 w-4" /> : idx + 1}
              </span>

              <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => togglePhase(phase.id)}
                    aria-label={phase.open ? "Recolher fase" : "Expandir fase"}
                    className="flex-none rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                  >
                    <ChevronRight
                      className={cn("h-4 w-4 transition-transform", phase.open && "rotate-90")}
                    />
                  </button>
                  <input
                    value={phase.title}
                    onChange={(e) =>
                      patchPhase(phase.id, (p) => ({ ...p, title: e.target.value }))
                    }
                    aria-label="Título da fase"
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-base font-semibold text-foreground outline-none focus:bg-white/[0.04]"
                  />
                  <span className="flex-none text-xs tabular-nums text-muted-foreground">
                    {doneCount}/{phase.steps.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => delPhase(phase.id, phase.title)}
                    aria-label="Remover fase"
                    className="flex-none rounded-md p-1.5 text-muted-foreground/60 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {phase.open && (
                  <div className="space-y-3 px-3 pb-3">
                    {phase.steps.map((step) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        onCycle={() => cycleStatus(phase.id, step.id)}
                        onField={(field, v) =>
                          patchStep(phase.id, step.id, (s) => ({ ...s, [field]: v }))
                        }
                        onDelete={() => delStep(phase.id, step.id, step.title)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => addStep(phase.id)}
                      className="w-full rounded-xl border border-dashed border-white/15 py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                    >
                      + Adicionar etapa
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addPhase}
          className="relative w-full rounded-2xl border border-dashed border-white/15 bg-card/40 py-3 text-sm font-bold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
        >
          <span className="absolute -left-11 top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-white/15 bg-background text-lg font-light text-muted-foreground">
            +
          </span>
          Adicionar fase
        </button>
      </div>

      <p className="pb-4 text-center text-xs leading-relaxed text-muted-foreground">
        Toque no selo de status pra avançar a etapa · toque no telefone verde pra ligar ·
        tudo é salvo no servidor e aparece igual no celular e no computador.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------
function SaveBadge({ state }: { state: SaveState }) {
  const map = {
    saved: { label: "Salvo", dot: "bg-emerald-400", text: "text-muted-foreground" },
    saving: { label: "Salvando…", dot: "bg-amber-400 animate-pulse", text: "text-muted-foreground" },
    error: { label: "Erro ao salvar", dot: "bg-red-400", text: "text-red-400" },
  }[state];
  return (
    <span className={cn("flex flex-none items-center gap-1.5 text-xs font-medium", map.text)}>
      <span className={cn("h-2 w-2 rounded-full", map.dot)} />
      {map.label}
    </span>
  );
}

function StepCard({
  step,
  onCycle,
  onField,
  onDelete,
}: {
  step: PlaybookStep;
  onCycle: () => void;
  onField: (field: keyof PlaybookStep, value: string) => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[step.status];
  const tel = step.telefone.replace(/[^0-9+]/g, "");
  const callable = tel.length >= 5;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onCycle}
          aria-label={`Status: ${meta.label}. Toque pra mudar.`}
          className={cn(
            "mt-0.5 flex-none rounded-full border px-2.5 py-1 text-[11px] font-bold transition active:scale-95",
            meta.chip,
          )}
        >
          {meta.label}
        </button>
        <AutoTextarea
          ariaLabel="Etapa"
          value={step.title}
          onChange={(v) => onField("title", v)}
          className={cn(
            "min-w-0 flex-1 bg-transparent py-1 text-sm font-semibold text-foreground outline-none",
            step.status === "done" && "text-muted-foreground line-through",
          )}
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remover etapa"
          className="flex-none rounded-md p-1.5 text-muted-foreground/50 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 pl-1 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Responsável / quem aciona
          </span>
          <input
            value={step.responsavel}
            onChange={(e) => onField("responsavel", e.target.value)}
            placeholder="Ex: Corretor, Advogado…"
            className="rounded-lg border border-white/[0.08] bg-background/50 px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
          />
        </label>
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Telefone
            </span>
            <input
              value={step.telefone}
              onChange={(e) => onField("telefone", e.target.value)}
              placeholder="+1 …"
              inputMode="tel"
              className="rounded-lg border border-white/[0.08] bg-background/50 px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </label>
          {callable ? (
            <a
              href={`tel:${tel}`}
              className="flex-none rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-emerald-600"
            >
              <Phone className="h-4 w-4" />
            </a>
          ) : (
            <span className="flex-none rounded-lg border border-white/[0.08] px-3 py-1.5 text-muted-foreground/40">
              <Phone className="h-4 w-4" />
            </span>
          )}
        </div>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notas
          </span>
          <AutoTextarea
            ariaLabel="Notas"
            value={step.notas}
            onChange={(v) => onField("notas", v)}
            placeholder="Detalhes, o que fazer, quem cobrar…"
            className="min-h-[38px] rounded-lg border border-white/[0.08] bg-background/50 px-2.5 py-1.5 text-sm leading-relaxed text-foreground outline-none focus:border-primary/50"
          />
        </label>
      </div>
    </div>
  );
}
