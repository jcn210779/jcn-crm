"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { PriceUnit, SubPriceCatalog } from "@/lib/types";

const UNIT_SUFFIX: Record<PriceUnit, string> = {
  sqft: "/sqft",
  linear_ft: "/lft",
  day: "/dia",
  hour: "/hora",
  flat: " total",
  each: "/unid.",
};

type Props = {
  items: SubPriceCatalog[];
};

export function PrecosPublicView({ items }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) set.add(i.category);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        i.service_name.toLowerCase().includes(term) ||
        (i.description ?? "").toLowerCase().includes(term) ||
        i.category.toLowerCase().includes(term)
      );
    });
  }, [items, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, SubPriceCatalog[]>();
    for (const i of filtered) {
      const list = map.get(i.category) ?? [];
      list.push(i);
      map.set(i.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-jcn-ice/40" />
          <Input
            placeholder="Buscar serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="flex h-10 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-jcn-ice"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.1] bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-jcn-ice/55">
            {items.length === 0
              ? "Nenhum preço cadastrado ainda."
              : "Nenhum serviço encontrado com esse filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, list]) => (
            <section
              key={category}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 md:p-5"
            >
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-jcn-gold-300">
                {category}{" "}
                <span className="text-jcn-ice/40">({list.length})</span>
              </h2>
              <div className="space-y-2">
                {list.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="font-semibold text-jcn-ice">
                        {item.service_name}
                      </p>
                      {(!item.tiers || item.tiers.length === 0) && (
                        <p className="text-sm font-black text-jcn-gold-300">
                          {formatCurrency(item.price_min)} –{" "}
                          {formatCurrency(item.price_max)}
                          <span className="text-xs font-normal text-jcn-ice/55">
                            {UNIT_SUFFIX[item.unit]}
                          </span>
                        </p>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-1 text-xs text-jcn-ice/65">
                        {item.description}
                      </p>
                    )}
                    {item.tiers && item.tiers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tiers.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded-lg border border-jcn-gold-400/30 bg-jcn-gold-500/10 px-2 py-1 text-[11px]"
                          >
                            <span className="text-jcn-ice/70">{t.label}:</span>{" "}
                            <span className="font-black text-jcn-gold-300">
                              {formatCurrency(Number(t.price))}
                              <span className="text-[9px] font-normal text-jcn-ice/55">
                                {UNIT_SUFFIX[item.unit]}
                              </span>
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="mt-1 text-[11px] italic text-jcn-ice/45">
                        {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
