/**
 * Palette de cores por categoria (draw items, budget lines, etc).
 *
 * Cor é armazenada como TOKEN da palette (ex: "sky", "amber") em
 * flip_budget_lines.color (mig 0060). Frontend mapeia pra classes Tailwind.
 *
 * Se linha do orçamento tem cor definida → usa. Se não, cai no fallback
 * automático por keyword (ex: "permit" → sky).
 */

export type ColorToken =
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "emerald"
  | "teal"
  | "cyan"
  | "slate";

export const COLOR_TOKENS: ColorToken[] = [
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "red",
  "orange",
  "amber",
  "yellow",
  "emerald",
  "teal",
  "cyan",
  "slate",
];

export const COLOR_LABEL: Record<ColorToken, string> = {
  sky: "Azul céu",
  blue: "Azul",
  indigo: "Índigo",
  violet: "Violeta",
  purple: "Roxo",
  fuchsia: "Fúcsia",
  pink: "Rosa",
  rose: "Rosa escuro",
  red: "Vermelho",
  orange: "Laranja",
  amber: "Marrom",
  yellow: "Amarelo",
  emerald: "Verde",
  teal: "Teal",
  cyan: "Ciano",
  slate: "Cinza",
};

/** Classes Tailwind por token — bg + border + swatch (solid, pra picker). */
export const COLOR_CLASSES: Record<
  ColorToken,
  { bg: string; border: string; swatch: string }
> = {
  sky:      { bg: "bg-sky-500/10",     border: "border-sky-400/40",     swatch: "bg-sky-500" },
  blue:     { bg: "bg-blue-500/10",    border: "border-blue-400/40",    swatch: "bg-blue-500" },
  indigo:   { bg: "bg-indigo-500/10",  border: "border-indigo-400/40",  swatch: "bg-indigo-500" },
  violet:   { bg: "bg-violet-500/10",  border: "border-violet-400/40",  swatch: "bg-violet-500" },
  purple:   { bg: "bg-purple-500/10",  border: "border-purple-400/40",  swatch: "bg-purple-500" },
  fuchsia:  { bg: "bg-fuchsia-500/10", border: "border-fuchsia-400/40", swatch: "bg-fuchsia-500" },
  pink:     { bg: "bg-pink-500/10",    border: "border-pink-400/40",    swatch: "bg-pink-500" },
  rose:     { bg: "bg-rose-500/10",    border: "border-rose-400/40",    swatch: "bg-rose-500" },
  red:      { bg: "bg-red-500/10",     border: "border-red-400/40",     swatch: "bg-red-500" },
  orange:   { bg: "bg-orange-500/10",  border: "border-orange-400/40",  swatch: "bg-orange-500" },
  amber:    { bg: "bg-amber-700/15",   border: "border-amber-600/40",   swatch: "bg-amber-700" },
  yellow:   { bg: "bg-yellow-500/10",  border: "border-yellow-400/40",  swatch: "bg-yellow-500" },
  emerald:  { bg: "bg-emerald-500/10", border: "border-emerald-400/40", swatch: "bg-emerald-500" },
  teal:     { bg: "bg-teal-500/10",    border: "border-teal-400/40",    swatch: "bg-teal-500" },
  cyan:     { bg: "bg-cyan-500/10",    border: "border-cyan-400/40",    swatch: "bg-cyan-500" },
  slate:    { bg: "bg-slate-500/15",   border: "border-slate-400/40",   swatch: "bg-slate-500" },
};

/** Fallback: matching por keyword na categoria, com hash pro resto. */
const KEYWORD_TO_TOKEN: Array<[string, ColorToken]> = [
  ["permit", "sky"],
  ["framing", "amber"],
  ["demol", "slate"],
  ["eletric", "yellow"],
  ["electric", "yellow"],
  ["hidra", "cyan"],
  ["plumb", "cyan"],
  ["hvac", "violet"],
  ["isolam", "pink"],
  ["insulat", "pink"],
  ["drywall", "slate"],
  ["piso", "emerald"],
  ["floor", "emerald"],
  ["telhad", "rose"],
  ["roof", "rose"],
  ["siding", "orange"],
  ["cozinha", "red"],
  ["kitchen", "red"],
  ["banho", "teal"],
  ["bathroom", "teal"],
  ["material", "indigo"],
  ["mao", "fuchsia"],
  ["labor", "fuchsia"],
];

export function autoTokenForCategory(category: string): ColorToken {
  const norm = category.toLowerCase().trim();
  for (const [kw, tok] of KEYWORD_TO_TOKEN) {
    if (norm.includes(kw)) return tok;
  }
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 31 + norm.charCodeAt(i)) >>> 0;
  }
  return COLOR_TOKENS[hash % COLOR_TOKENS.length]!;
}

/**
 * Retorna { bg, border } pra usar em qualquer container.
 * Prioridade: color manual > auto por keyword > fallback hash.
 */
export function resolveCategoryColor(opts: {
  manualColor: string | null | undefined;
  category: string;
}): { bg: string; border: string } {
  const token: ColorToken =
    opts.manualColor && (COLOR_TOKENS as string[]).includes(opts.manualColor)
      ? (opts.manualColor as ColorToken)
      : autoTokenForCategory(opts.category);
  const { bg, border } = COLOR_CLASSES[token];
  return { bg, border };
}
