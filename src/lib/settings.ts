import { eq } from "drizzle-orm";
import { db, userSettings, type UserSettings } from "@/db";
import { decryptSecret } from "./crypto";
import type { AiConfig } from "./ai/client";
import { normalizePreferences, type Preferences } from "./preferences";

/** Returns the user's settings row, creating the default one on first access. */
export async function getSettings(userId: string): Promise<UserSettings> {
  const [existing] = await db().select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db().insert(userSettings).values({ userId }).onConflictDoNothing().returning();
  if (created) return created;
  const [row] = await db().select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return row;
}

export function getPreferences(settings: UserSettings): Preferences {
  return normalizePreferences(settings.preferences);
}

/** Decrypts the stored key. Returns null if no key is configured or it can no longer be decrypted. */
export function getAiConfig(settings: UserSettings): AiConfig | null {
  if (!settings.aiApiKeyEnc || !settings.aiBaseUrl || !settings.aiModel) return null;
  try {
    return { baseUrl: settings.aiBaseUrl, model: settings.aiModel, apiKey: decryptSecret(settings.aiApiKeyEnc) };
  } catch {
    return null;
  }
}
