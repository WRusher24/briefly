const STOPWORDS = new Set(
  "the a an and or of to in on for at by with from as is are was were be been it its this that after over into amid says say said new will could would may might has have had not but than about up out more less how why what who when where".split(" "),
);

/** Crude suffix stemmer — enough to equate "cuts/cut", "cooling/cools/cool", "rallies/rally". */
function stem(word: string): string {
  if (word === "fed") return "federal";
  return word
    .replace(/(ies)$/, "y")
    .replace(/(ing|ed|es|s)$/, "")
    .replace(/(.)\1$/, "$1");
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem)
      .filter((w) => w.length > 1),
  );
}

/** Same story if titles share a large fraction of terms (Jaccard) or a solid core of them (overlap). */
export function sameStory(a: Set<string>, b: Set<string>, threshold: number): boolean {
  if (jaccard(a, b) >= threshold) return true;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter >= 4 && inter / Math.min(a.size, b.size) >= 0.5;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface Clusterable {
  title: string;
  score: number;
}

export interface Cluster<T extends Clusterable> {
  primary: T;
  members: T[];
}

/**
 * Greedy near-duplicate grouping by title similarity. Items are visited best-score-first so the
 * strongest item becomes each cluster's primary.
 */
export function clusterItems<T extends Clusterable>(items: T[], threshold = 0.45): Cluster<T>[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const clusters: Array<Cluster<T> & { tokens: Set<string> }> = [];
  for (const item of sorted) {
    const tokens = titleTokens(item.title);
    const match = clusters.find((c) => sameStory(c.tokens, tokens, threshold));
    if (match) match.members.push(item);
    else clusters.push({ primary: item, members: [item], tokens });
  }
  return clusters.map(({ primary, members }) => ({ primary, members }));
}
