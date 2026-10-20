import { db, feeds } from "@/db";
import { DEFAULT_FEEDS } from "./feeds-directory";

/** Copies the built-in directory into the user's feed list; existing URLs are left untouched. */
export async function seedDefaultFeeds(userId: string): Promise<number> {
  const inserted = await db()
    .insert(feeds)
    .values(DEFAULT_FEEDS.map((f) => ({ ...f, userId, isDefault: true })))
    .onConflictDoNothing()
    .returning({ id: feeds.id });
  return inserted.length;
}
