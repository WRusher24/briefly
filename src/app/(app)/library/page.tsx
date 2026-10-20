import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { LibraryView } from "@/components/library-view";
import { db, savedDebriefs } from "@/db";
import { requirePageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await requirePageUser();
  const rows = await db().select().from(savedDebriefs).where(eq(savedDebriefs.userId, user.id)).orderBy(desc(savedDebriefs.savedAt)).limit(500);

  return (
    <LibraryView
      entries={rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        domain: r.domain,
        title: r.title,
        tldr: r.tldr,
        note: r.note,
        eventAt: r.eventAt.toISOString(),
        savedAt: r.savedAt.toISOString(),
      }))}
    />
  );
}
