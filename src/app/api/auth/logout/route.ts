import { destroySession } from "@/lib/auth";
import { route } from "@/lib/api";

export const POST = route({ auth: false }, async () => {
  await destroySession();
  return { ok: true };
});
