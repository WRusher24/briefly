export const DOMAINS = ["markets", "sports", "geopolitics"] as const;
export type Domain = (typeof DOMAINS)[number];

export interface DomainMeta {
  id: Domain;
  label: string;
  short: string;
  emoji: string;
  /** Tailwind text/bg token name, see tailwind.config.ts */
  color: "markets" | "sports" | "geo";
  /** Full class names so Tailwind can see them statically. */
  bg: string;
  text: string;
  tagline: string;
}

export const DOMAIN_META: Record<Domain, DomainMeta> = {
  markets: {
    id: "markets",
    label: "Stock Market & Business",
    short: "Markets",
    emoji: "📈",
    color: "markets",
    bg: "bg-markets",
    text: "text-markets",
    tagline: "Macro-economics, market shifts, institutions and high-impact business events.",
  },
  sports: {
    id: "sports",
    label: "Sports",
    short: "Sports",
    emoji: "⚽",
    color: "sports",
    bg: "bg-sports",
    text: "text-sports",
    tagline: "UFC/MMA and top-tier football — Real Madrid and Newcastle first.",
  },
  geopolitics: {
    id: "geopolitics",
    label: "Geopolitics",
    short: "Geopolitics",
    emoji: "🌍",
    color: "geo",
    bg: "bg-geo",
    text: "text-geo",
    tagline: "International relations, conflicts, trade agreements and policy shifts.",
  },
};

export function isDomain(value: string): value is Domain {
  return (DOMAINS as readonly string[]).includes(value);
}
