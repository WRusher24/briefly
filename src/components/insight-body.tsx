import type { SourceRef } from "@/db";
import { ExternalIcon } from "./icons";

interface Props {
  tldr: string;
  facts: string[];
  why: string;
  angle: string;
  sources: SourceRef[];
}

function Tier({ n, title, subtitle, children }: { n: number; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="relative border-l border-accent/40 pl-4">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        Tier {n} · {title}
      </p>
      <p className="mb-2 text-xs text-faint">{subtitle}</p>
      {children}
    </section>
  );
}

/** The 3-tier insight structure, shared by the briefing modal and the saved library. */
export function InsightBody({ tldr, facts, why, angle, sources }: Props) {
  return (
    <div className="space-y-6">
      {tldr && <p className="text-[17px] leading-snug text-fg">{tldr}</p>}

      {facts.length > 0 && (
        <Tier n={1} title="What happened" subtitle="The facts, filler stripped out">
          <ul className="space-y-2">
            {facts.map((fact, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-fg/90">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </Tier>
      )}

      {why && (
        <Tier n={2} title="Why it matters" subtitle="The context behind the consequence">
          <p className="text-[15px] leading-relaxed text-fg/90">{why}</p>
        </Tier>
      )}

      {angle && (
        <Tier n={3} title="The angle" subtitle="Forward-looking analysis — second-order effects & hidden context">
          <p className="text-[15px] leading-relaxed text-fg/90">{angle}</p>
        </Tier>
      )}

      {sources.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">Sources</p>
          <ul className="flex flex-wrap gap-2">
            {sources.slice(0, 5).map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="chip hover:border-accent/50 hover:text-fg">
                  {s.name}
                  <ExternalIcon className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">AI-assisted summary. Tiers 1–2 follow the source text; Tier 3 is analysis. Verify before acting.</p>
        </div>
      )}
    </div>
  );
}
