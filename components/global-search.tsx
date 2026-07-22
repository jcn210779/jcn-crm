"use client";

/**
 * GlobalSearch — busca universal do CRM.
 *
 * Trigger: ícone lupa no header. Também abre com Cmd/Ctrl+K.
 * Faz queries paralelas em: leads, jobs, subcontractors, job_expenses,
 * business_expenses, flip_details, sub_price_catalog. Resultados agrupados
 * por tipo, click abre página relevante.
 *
 * Busca por ILIKE '%termo%' (suficiente pro volume atual). Trigger 300ms
 * debounce pra não bombardear DB.
 */

import {
  Building,
  DollarSign,
  Home,
  Loader2,
  Package,
  Receipt,
  Search,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type ResultItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
};

type ResultGroup = {
  label: string;
  items: ResultItem[];
};

const DEBOUNCE_MS = 300;
const LIMIT_PER_TABLE = 8;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd/Ctrl+K abre
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-focus quando abre
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ("");
      setGroups([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      void runSearch(term);
    }, DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  async function runSearch(term: string) {
    const supabase = createSupabaseBrowserClient();
    const like = `%${term}%`;

    const [leadsRes, subsRes, jobExpRes, bizExpRes, flipsRes, pricesRes] =
      await Promise.all([
        supabase
          .from("leads")
          .select("id, name, phone, email, city, stage")
          .or(
            `name.ilike.${like},phone.ilike.${like},email.ilike.${like},city.ilike.${like},address.ilike.${like}`,
          )
          .limit(LIMIT_PER_TABLE),
        supabase
          .from("subcontractors")
          .select("id, name, company_name, specialty, phone")
          .or(
            `name.ilike.${like},company_name.ilike.${like},phone.ilike.${like}`,
          )
          .limit(LIMIT_PER_TABLE),
        supabase
          .from("job_expenses")
          .select(
            "id, description, vendor, amount, expense_date, category, job_id",
          )
          .or(
            `description.ilike.${like},vendor.ilike.${like},check_number.ilike.${like}`,
          )
          .order("expense_date", { ascending: false })
          .limit(LIMIT_PER_TABLE),
        supabase
          .from("business_expenses")
          .select(
            "id, description, vendor, amount, expense_date, category, check_number",
          )
          .or(
            `description.ilike.${like},vendor.ilike.${like},check_number.ilike.${like}`,
          )
          .order("expense_date", { ascending: false })
          .limit(LIMIT_PER_TABLE),
        supabase
          .from("flip_details")
          .select(
            "id, property_address, property_city, purchase_price, job_id",
          )
          .or(
            `property_address.ilike.${like},property_city.ilike.${like}`,
          )
          .limit(LIMIT_PER_TABLE),
        supabase
          .from("sub_price_catalog")
          .select("id, service_name, category, price_min, price_max, unit")
          .or(
            `service_name.ilike.${like},category.ilike.${like},description.ilike.${like}`,
          )
          .eq("is_active", true)
          .limit(LIMIT_PER_TABLE),
      ]);

    // Pra jobs: quando o termo bate em lead.name, pegar jobs vinculados
    const leadIds = ((leadsRes.data ?? []) as { id: string }[]).map(
      (l) => l.id,
    );
    let jobsData: {
      id: string;
      value: number;
      current_phase: string;
      is_flip: boolean;
      lead: { name: string; city: string | null } | null;
    }[] = [];
    if (leadIds.length > 0) {
      const jobsRes = await supabase
        .from("jobs")
        .select(
          "id, value, current_phase, is_flip, lead:leads(name, city)",
        )
        .in("lead_id", leadIds);
      jobsData = (jobsRes.data ?? []) as typeof jobsData;
    }

    const groups: ResultGroup[] = [];

    if ((leadsRes.data ?? []).length > 0) {
      groups.push({
        label: "Leads",
        items: (leadsRes.data as {
          id: string;
          name: string;
          phone: string | null;
          city: string | null;
          stage: string;
        }[]).map((l) => ({
          id: `lead-${l.id}`,
          href: `/lead/${l.id}`,
          title: l.name,
          subtitle: `${l.stage}${l.city ? ` · ${l.city}` : ""}${l.phone ? ` · ${l.phone}` : ""}`,
          icon: User,
        })),
      });
    }

    if (jobsData.length > 0) {
      groups.push({
        label: "Jobs (via lead)",
        items: jobsData.map((j) => ({
          id: `job-${j.id}`,
          href: `/job/${j.id}`,
          title: `${j.lead?.name ?? "?"}${j.is_flip ? " · 🏠 FLIP" : ""}`,
          subtitle: `${j.current_phase} · ${formatCurrency(Number(j.value))}${j.lead?.city ? ` · ${j.lead.city}` : ""}`,
          icon: Home,
        })),
      });
    }

    if ((flipsRes.data ?? []).length > 0) {
      groups.push({
        label: "Flips",
        items: (flipsRes.data as unknown as {
          id: string;
          property_address: string | null;
          property_city: string | null;
          purchase_price: number | null;
          job_id: string;
        }[]).map((f) => ({
          id: `flip-${f.id}`,
          href: `/job/${f.job_id}`,
          title: `${f.property_address ?? "Sem endereço"}${f.property_city ? `, ${f.property_city}` : ""}`,
          subtitle: `Compra ${f.purchase_price ? formatCurrency(Number(f.purchase_price)) : "?"}`,
          icon: Home,
        })),
      });
    }

    if ((subsRes.data ?? []).length > 0) {
      groups.push({
        label: "Subempreiteiros",
        items: (subsRes.data as {
          id: string;
          name: string;
          company_name: string | null;
          specialty: string | null;
          phone: string | null;
        }[]).map((s) => ({
          id: `sub-${s.id}`,
          href: `/subcontractors`,
          title: s.name,
          subtitle: `${s.specialty ?? "?"}${s.company_name ? ` · ${s.company_name}` : ""}${s.phone ? ` · ${s.phone}` : ""}`,
          icon: Users,
        })),
      });
    }

    if ((jobExpRes.data ?? []).length > 0) {
      groups.push({
        label: "Despesas de job",
        items: (jobExpRes.data as {
          id: string;
          description: string;
          vendor: string | null;
          amount: number;
          expense_date: string;
          category: string;
          job_id: string;
        }[]).map((e) => ({
          id: `jobexp-${e.id}`,
          href: `/job/${e.job_id}`,
          title: `${e.description.slice(0, 60)}${e.description.length > 60 ? "..." : ""}`,
          subtitle: `${formatCurrency(Number(e.amount))} · ${e.expense_date} · ${e.vendor ?? e.category}`,
          icon: Receipt,
        })),
      });
    }

    if ((bizExpRes.data ?? []).length > 0) {
      groups.push({
        label: "Gastos da empresa",
        items: (bizExpRes.data as {
          id: string;
          description: string;
          vendor: string | null;
          amount: number;
          expense_date: string;
          check_number: string | null;
        }[]).map((b) => ({
          id: `bizexp-${b.id}`,
          href: `/finance`,
          title: `${b.description.slice(0, 60)}${b.description.length > 60 ? "..." : ""}`,
          subtitle: `${formatCurrency(Number(b.amount))} · ${b.expense_date}${b.vendor ? ` · ${b.vendor}` : ""}${b.check_number ? ` · cheque #${b.check_number}` : ""}`,
          icon: DollarSign,
        })),
      });
    }

    if ((pricesRes.data ?? []).length > 0) {
      groups.push({
        label: "Preços de sub",
        items: (pricesRes.data as {
          id: string;
          service_name: string;
          category: string;
          price_min: number;
          price_max: number;
          unit: string;
        }[]).map((p) => ({
          id: `price-${p.id}`,
          href: `/precos`,
          title: p.service_name,
          subtitle: `${p.category} · ${formatCurrency(Number(p.price_min))}–${formatCurrency(Number(p.price_max))} /${p.unit}`,
          icon: Tag,
        })),
      });
    }

    setGroups(groups);
    setLoading(false);
  }

  const totalResults = useMemo(
    () => groups.reduce((s, g) => s + g.items.length, 0),
    [groups],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white/85"
        title="Buscar (Cmd+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Buscar</span>
        <span className="hidden rounded border border-white/[0.1] bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/45 md:inline">
          ⌘K
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-[10vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.1] bg-jcn-midnight shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-white/[0.08] p-3">
              <Search className="h-4 w-4 text-jcn-ice/45" />
              <Input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Busca por lead, sub, cheque, endereço, vendor..."
                className="border-none bg-transparent text-base placeholder:text-jcn-ice/35 focus-visible:ring-0"
              />
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin text-jcn-gold-300" />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-jcn-ice/45 hover:bg-white/[0.06] hover:text-jcn-ice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <p className="p-6 text-center text-sm text-jcn-ice/45">
                  Digite pelo menos 2 caracteres pra buscar
                </p>
              ) : loading && groups.length === 0 ? (
                <p className="p-6 text-center text-sm text-jcn-ice/45">
                  Buscando...
                </p>
              ) : totalResults === 0 ? (
                <p className="p-6 text-center text-sm text-jcn-ice/45">
                  Nenhum resultado pra <strong>&quot;{q}&quot;</strong>
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.label} className="mb-3">
                    <h3 className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-gold-300">
                      {g.label} ({g.items.length})
                    </h3>
                    <ul className="space-y-0.5">
                      {g.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className="flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.05]"
                            >
                              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-jcn-ice/55" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-jcn-ice">
                                  {item.title}
                                </p>
                                <p className="truncate text-xs text-jcn-ice/55">
                                  {item.subtitle}
                                </p>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-white/[0.08] px-3 py-2 text-[10px] text-jcn-ice/40">
              Cmd+K abre · Esc fecha · Enter no primeiro resultado
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Unused icons stubbed to avoid lint (mantidos pra uso futuro se surgirem tabelas novas)
void Building;
void Package;
