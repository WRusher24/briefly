const WORDS_PER_MINUTE = 220;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Estimated seconds to read a debrief, rounded to 5s with a 15s floor. */
export function estimateReadSeconds(...parts: string[]): number {
  const words = parts.reduce((sum, p) => sum + countWords(p), 0);
  const seconds = (words / WORDS_PER_MINUTE) * 60;
  return Math.max(15, Math.round(seconds / 5) * 5);
}

export function formatReadTime(seconds: number | null | undefined): string {
  const s = seconds ?? 30;
  if (s < 90) return `⏱️ ${s} sec read`;
  return `⏱️ ${Math.round(s / 60)} min read`;
}
