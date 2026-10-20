import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { InsightBody } from "@/components/insight-body";
import { SavedActions } from "@/components/saved-actions";
import { db, savedDebriefs } from "@/db";
import { requirePageUser } from "@/lib/auth";
import { DOMAIN_META } from "@/lib/domains";
import { estimateReadSeconds, formatReadTime } from "@/lib/readtime";

export const metadata: Metadata = { title: "Saved debrief" };
export const dynamic = "force-dynamic";

const longDate = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function SavedDebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requirePageUser();
  const [row] = await db()
    .select()
    .from(savedDebriefs)
    .where(and(eq(savedDebriefs.id, id), eq(savedDebriefs.userId, user.id)))
    .limit(1);
  if (!row) notFound();

  const meta = DOMAIN_META[row.domain];
  const isTrend = row.kind === "trend";

  return (
    <article className="pt-5">
      <Link href="/library" className="inline-flex min-h-[44px] items-center text-sm text-muted hover:text-fg">
        ← Library
      </Link>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${meta.bg}`} aria-hidden="true" />
        <span className={meta.text}>{meta.label}</span>
        <span className="text-faint">·</span>
        <span>{longDate(row.eventAt)}</span>
        {isTrend && <span className="chip py-0.5 text-[11px]">Macro trend</span>}
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{row.title}</h1>
      <p className="mt-1.5 text-xs text-faint">
        {formatReadTime(estimateReadSeconds(row.tldr, row.facts.join(" "), row.why, row.angle))} · saved {longDate(row.savedAt)}
      </p>

      <div className="mt-6">
        {isTrend ? (
          <ol className="space-y-4 border-l border-accent/40 pl-4">
            {row.facts.map((bullet, i) => (
              <li key={i} className="flex gap-3 text-[16px] leading-relaxed">
                <span className={`mt-0.5 font-mono text-xs ${meta.text}`}>{String(i + 1).padStart(2, "0")}</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ol>
        ) : (
          <InsightBody tldr={row.tldr} facts={row.facts} why={row.why} angle={row.angle} sources={row.sources} />
        )}
      </div>

      <SavedActions id={row.id} initialNote={row.note} />
    </article>
  );
}
