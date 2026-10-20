"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DOMAINS, DOMAIN_META, type Domain } from "@/lib/domains";

export interface LibraryEntry {
  id: string;
  kind: "story" | "trend";
  domain: Domain;
  title: string;
  tldr: string;
  note: string;
  eventAt: string;
  savedAt: string;
}

type DomainFilter = Domain | "all";
type KindFilter = "all" | "story" | "trend";

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[36px] shrink-0 rounded-full border px-3.5 text-[13px] transition ${active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

export function LibraryView({ entries }: { entries: LibraryEntry[] }) {
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries
      .filter((e) => (domain === "all" || e.domain === domain) && (kind === "all" || e.kind === kind))
      .filter((e) => !q || `${e.title} ${e.tldr} ${e.note}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime());

    const map = new Map<string, LibraryEntry[]>();
    for (const e of filtered) {
      const key = monthLabel(e.eventAt);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries, domain, kind, query]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="pt-5">
      <h1 className="text-[22px] font-semibold tracking-tight">Saved debriefs</h1>
      <p className="mt-1 text-[13px] text-muted">Your permanent archive of insights and macro trends, ordered by when the events happened.</p>

      <div className="mt-4">
        <label htmlFor="library-search" className="sr-only">
          Search saved debriefs
        </label>
        <input id="library-search" className="input" type="search" placeholder="Search titles, summaries and notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filters">
        <Pill active={domain === "all"} onClick={() => setDomain("all")}>
          All
        </Pill>
        {DOMAINS.map((d) => (
          <Pill key={d} active={domain === d} onClick={() => setDomain(d)}>
            {DOMAIN_META[d].emoji} {DOMAIN_META[d].short}
          </Pill>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />
        <Pill active={kind === "all"} onClick={() => setKind("all")}>
          Everything
        </Pill>
        <Pill active={kind === "story"} onClick={() => setKind("story")}>
          Stories
        </Pill>
        <Pill active={kind === "trend"} onClick={() => setKind("trend")}>
          Macro trends
        </Pill>
      </div>

      {entries.length === 0 ? (
        <div className="card mt-6 px-5 py-10 text-center">
          <p className="text-[15px] font-medium">Nothing saved yet</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
            Tap the bookmark on a story, or on a Daily Executive Flash, to keep it here for good.
          </p>
          <Link href="/briefing/markets" className="btn-primary mt-5">
            Go to your briefing
          </Link>
        </div>
      ) : total === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">No saved debriefs match these filters.</p>
      ) : (
        <div className="mt-6 space-y-7">
          {groups.map(([month, list]) => (
            <section key={month} aria-label={month}>
              <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">{month}</h2>
              <ul className="space-y-2.5">
                {list.map((e) => {
                  const meta = DOMAIN_META[e.domain];
                  return (
                    <li key={e.id}>
                      <Link href={`/library/${e.id}`} className="card relative block p-4 transition-colors hover:border-faint/50">
                        <span className={`absolute inset-y-4 left-0 w-[2px] rounded-full ${meta.bg}`} aria-hidden="true" />
                        <p className="flex items-center gap-2 text-xs text-muted">
                          <span className={meta.text}>{meta.short}</span>
                          <span className="text-faint">·</span>
                          <span>{dayLabel(e.eventAt)}</span>
                          {e.kind === "trend" && <span className="chip py-0.5 text-[11px]">Macro trend</span>}
                        </p>
                        <h3 className="mt-1 text-[16px] font-semibold leading-snug tracking-tight">{e.title}</h3>
                        {e.tldr && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{e.tldr}</p>}
                        {e.note && <p className="mt-2 border-l border-accent/40 pl-2.5 text-xs italic text-faint">{e.note}</p>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
