import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, userSettings } from "@/db";
import { HttpError, route } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { assertPublicUrl } from "@/lib/net";
import { getSettings } from "@/lib/settings";

const aiSettingsSchema = z.object({
  provider: z.string().trim().min(1).max(30),
  baseUrl: z.string().trim().url("Enter a valid base URL").max(300),
  model: z.string().trim().min(1, "Model is required").max(120),
  /** Omit or leave empty to keep the stored key. */
  apiKey: z.string().trim().max(500).optional(),
});

export const GET = route({}, async ({ user }) => {
  const s = await getSettings(user.id);
  return { provider: s.aiProvider, baseUrl: s.aiBaseUrl, model: s.aiModel, hasKey: !!s.aiApiKeyEnc, keyLast4: s.aiKeyLast4 };
});

export const PUT = route({ body: aiSettingsSchema }, async ({ user, body }) => {
  const url = await assertPublicUrl(body.baseUrl);
  if (url.protocol !== "https:" && !env().ALLOW_PRIVATE_HOSTS) throw new HttpError(400, "The AI base URL must use https");
  await getSettings(user.id);

  const update: Partial<typeof userSettings.$inferInsert> = {
    aiProvider: body.provider,
    aiBaseUrl: body.baseUrl.replace(/\/+$/, ""),
    aiModel: body.model,
    updatedAt: new Date(),
  };
  if (body.apiKey) {
    update.aiApiKeyEnc = encryptSecret(body.apiKey);
    update.aiKeyLast4 = body.apiKey.slice(-4);
  }
  await db().update(userSettings).set(update).where(eq(userSettings.userId, user.id));
  return { ok: true };
});

export const DELETE = route({}, async ({ user }) => {
  await db()
    .update(userSettings)
    .set({ aiApiKeyEnc: null, aiKeyLast4: null, updatedAt: new Date() })
    .where(eq(userSettings.userId, user.id));
  return { ok: true };
});
