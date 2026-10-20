import { HttpError, route } from "@/lib/api";
import { isDomain } from "@/lib/domains";
import { getBriefingItems, getLatestFlash, getRefreshState } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const GET = route<{ domain: string }>({}, async ({ user, params }) => {
  if (!isDomain(params.domain)) throw new HttpError(404, "Unknown domain");
  const settings = await getSettings(user.id);
  const [cards, flash, refresh] = await Promise.all([
    getBriefingItems(user.id, params.domain),
    getLatestFlash(user.id, params.domain),
    getRefreshState(user.id, settings.lastRefreshAt),
  ]);
  return { items: cards, flash, refresh };
});
