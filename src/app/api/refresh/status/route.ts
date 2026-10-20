import { route } from "@/lib/api";
import { getRefreshState } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const GET = route({}, async ({ user }) => {
  const settings = await getSettings(user.id);
  return getRefreshState(user.id, settings.lastRefreshAt);
});
