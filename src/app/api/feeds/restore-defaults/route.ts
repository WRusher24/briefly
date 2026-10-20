import { route } from "@/lib/api";
import { seedDefaultFeeds } from "@/lib/feeds";

/** Re-adds any built-in feed the user removed. Existing feeds (and their on/off state) are untouched. */
export const POST = route({}, async ({ user }) => ({ added: await seedDefaultFeeds(user.id) }));
