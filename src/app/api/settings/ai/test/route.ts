import { z } from "zod";
import { HttpError, route } from "@/lib/api";
import { AiClient, AiError } from "@/lib/ai/client";
import { env } from "@/lib/env";
import { assertPublicUrl } from "@/lib/net";
import { rateLimit } from "@/lib/rate-limit";
import { getAiConfig, getSettings } from "@/lib/settings";

const schema = z.object({
  baseUrl: z.string().trim().url().max(300),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().max(500).optional(),
});

/** Verifies the entered (or stored) credentials with a 1-token request. Nothing is saved. */
export const POST = route({ body: schema }, async ({ user, body }) => {
  if (!(await rateLimit(`ai-test:${user.id}`, 20, 3600))) throw new HttpError(429, "Too many connection tests. Try again later.");

  const url = await assertPublicUrl(body.baseUrl);
  if (url.protocol !== "https:" && !env().ALLOW_PRIVATE_HOSTS) throw new HttpError(400, "The AI base URL must use https");

  const stored = getAiConfig(await getSettings(user.id));
  const apiKey = body.apiKey || stored?.apiKey;
  if (!apiKey) throw new HttpError(400, "Enter an API key first");

  try {
    const result = await new AiClient({ baseUrl: body.baseUrl, model: body.model, apiKey }).ping();
    return { ok: true, message: `Connected. Model replied: “${result.sample}”` };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, message: err.message };
    throw err;
  }
});
