import { eq } from "drizzle-orm";
import { db, userSettings } from "@/db";
import { route } from "@/lib/api";
import { preferencesSchema } from "@/lib/preferences";
import { getPreferences, getSettings } from "@/lib/settings";

export const GET = route({}, async ({ user }) => getPreferences(await getSettings(user.id)));

export const PUT = route({ body: preferencesSchema }, async ({ user, body }) => {
  await getSettings(user.id);
  const clean = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  const prefs = { ...body, favoriteTeams: clean(body.favoriteTeams), boostKeywords: clean(body.boostKeywords), muteKeywords: clean(body.muteKeywords) };
  await db().update(userSettings).set({ preferences: prefs, updatedAt: new Date() }).where(eq(userSettings.userId, user.id));
  return prefs;
});
