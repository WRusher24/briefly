import { z } from "zod";

export const preferencesSchema = z.object({
  favoriteTeams: z.array(z.string().trim().min(2).max(60)).max(12),
  includeBoxing: z.boolean(),
  includeNba: z.boolean(),
  boostKeywords: z.array(z.string().trim().min(2).max(40)).max(30),
  muteKeywords: z.array(z.string().trim().min(2).max(40)).max(30),
  maxStoriesPerDomain: z.number().int().min(3).max(15),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  favoriteTeams: ["Real Madrid", "Newcastle"],
  includeBoxing: true,
  includeNba: true,
  boostKeywords: [],
  muteKeywords: [],
  maxStoriesPerDomain: 5,
};

/** Merge a stored (possibly partial / older) preferences blob with defaults. */
export function normalizePreferences(raw: unknown): Preferences {
  const parsed = preferencesSchema.partial().safeParse(raw ?? {});
  return { ...DEFAULT_PREFERENCES, ...(parsed.success ? parsed.data : {}) };
}
