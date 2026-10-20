import { after } from "next/server";
import { HttpError, json, route } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getAiConfig, getSettings } from "@/lib/settings";
import { isRefreshRunning, runRefreshForUser } from "@/lib/pipeline/run";

export const maxDuration = 300;

/** Starts a refresh in the background and returns immediately; clients poll /api/refresh/status. */
export const POST = route({}, async ({ user }) => {
  const settings = await getSettings(user.id);
  if (!getAiConfig(settings)) throw new HttpError(400, "Add your AI API key in Settings → AI before refreshing.");
  if (await isRefreshRunning(user.id)) return json({ started: false, running: true }, { status: 202 });
  if (!(await rateLimit(`refresh:${user.id}`, 6, 3600))) {
    throw new HttpError(429, "You can refresh up to 6 times per hour. Briefly also updates automatically every 4 hours.");
  }
  after(async () => {
    try {
      await runRefreshForUser(user.id, { trigger: "manual", deadline: Date.now() + 270_000 });
    } catch (err) {
      console.error("[refresh] manual run crashed", err);
    }
  });
  return json({ started: true, running: true }, { status: 202 });
});
