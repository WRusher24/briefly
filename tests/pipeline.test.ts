import { describe, expect, it } from "vitest";
import { parseFeed, stripHtml, canonicalUrl } from "@/lib/pipeline/rss";
import { scoreItem } from "@/lib/pipeline/relevance";
import { clusterItems } from "@/lib/pipeline/cluster";
import { extractArticleText } from "@/lib/pipeline/article";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

const now = new Date("2026-10-20T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const score = (title: string, domain: "markets" | "sports" | "geopolitics", opts: { text?: string; subtopic?: string; h?: number; prefs?: Partial<typeof DEFAULT_PREFERENCES> } = {}) =>
  scoreItem(
    { title, text: opts.text ?? "", publishedAt: hoursAgo(opts.h ?? 2) },
    { domain, subtopic: opts.subtopic ?? "General", prefs: { ...DEFAULT_PREFERENCES, ...opts.prefs }, now },
  );

describe("parseFeed", () => {
  it("parses RSS 2.0 with CDATA, entities and content:encoded", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
      <item><title><![CDATA[Fed holds rates &amp; signals cuts]]></title><link>https://ex.com/a?utm_source=x</link>
      <pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate><description>short</description>
      <content:encoded><![CDATA[<p>Full <b>body</b> text</p>]]></content:encoded></item>
      <item><title>No link</title></item></channel></rss>`;
    const items = parseFeed(xml, now);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Fed holds rates & signals cuts");
    expect(items[0].text).toBe("Full body text");
    expect(items[0].publishedAt.toISOString()).toBe("2026-10-20T10:00:00.000Z");
  });

  it("parses Atom feeds with link attributes", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom story</title>
      <link rel="alternate" href="https://ex.com/atom"/><updated>2026-10-20T09:00:00Z</updated><summary>Sum</summary></entry></feed>`;
    const [item] = parseFeed(xml, now);
    expect(item.url).toBe("https://ex.com/atom");
    expect(item.text).toBe("Sum");
  });

  it("parses RSS 1.0 (RDF) and falls back to now for future dates", () => {
    const xml = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <item><title>RDF item</title><link>https://ex.com/rdf</link><dc:date>2030-01-01T00:00:00Z</dc:date></item></rdf:RDF>`;
    const [item] = parseFeed(xml, now);
    expect(item.publishedAt.getTime()).toBe(now.getTime());
  });

  it("returns an empty list for non-feed XML", () => {
    expect(parseFeed("<html><body>hi</body></html>", now)).toEqual([]);
  });
});

describe("helpers", () => {
  it("strips html and decodes entities", () => {
    expect(stripHtml("<p>A&nbsp;&amp; B</p><script>x()</script><p>&#8217;ok</p>")).toBe("A & B ’ok");
  });
  it("canonicalises URLs by dropping tracking params and hashes", () => {
    expect(canonicalUrl("https://Ex.com/a/?utm_source=t&id=3#frag")).toBe("https://ex.com/a/?id=3");
  });
  it("extracts paragraph text from article html", () => {
    const html = `<nav><p>Menu menu menu menu menu menu menu menu menu menu menu menu menu menu menu</p></nav>
      <article><p>The central bank raised interest rates by a quarter point on Tuesday, citing sticky inflation.</p><p>short</p></article>`;
    expect(extractArticleText(html)).toBe("The central bank raised interest rates by a quarter point on Tuesday, citing sticky inflation.");
  });
});

describe("relevance scoring — markets", () => {
  it("rewards macro/market news and rejects personal-finance filler", () => {
    expect(score("Fed signals rate cut as inflation cools", "markets", { subtopic: "Central Banks" }).score).toBeGreaterThan(60);
    expect(score("Best credit cards for travel in 2026", "markets").reject).toBe(true);
    expect(score("A local bakery opens its doors", "markets").score).toBeLessThan(25);
  });
  it("rejects stale items and muted keywords", () => {
    expect(score("Fed signals rate cut", "markets", { h: 60 }).reject).toBe(true);
    expect(score("Fed signals rate cut over bitcoin", "markets", { prefs: { muteKeywords: ["bitcoin"] } }).reject).toBe(true);
  });
});

describe("relevance scoring — sports", () => {
  it("prioritises Real Madrid and Newcastle", () => {
    const rm = score("Real Madrid sign new striker ahead of Champions League clash", "sports");
    const nufc = score("Newcastle United confirm Eddie Howe contract extension", "sports");
    const generic = score("Brentford beat Fulham in a dull league game", "sports");
    expect(rm.score).toBeGreaterThan(70);
    expect(nufc.score).toBeGreaterThan(55);
    expect(generic.score).toBeLessThan(25);
  });
  it("keeps UFC news and drops other sports", () => {
    expect(score("UFC 320 main event: champion defends title with knockout", "sports").score).toBeGreaterThan(60);
    expect(score("England win the Ashes in dramatic cricket finish", "sports").reject).toBe(true);
  });
  it("only lets massive boxing and NBA events through", () => {
    expect(score("Usyk vs Fury undisputed heavyweight rematch confirmed", "sports").reject).toBe(false);
    expect(score("Local boxing card announced for March", "sports").reject).toBe(true);
    expect(score("Lakers beat Celtics in regular season game", "sports").reject).toBe(true);
    expect(score("Celtics clinch NBA Finals berth", "sports").reject).toBe(false);
    expect(score("Usyk vs Fury undisputed heavyweight rematch confirmed", "sports", { prefs: { includeBoxing: false } }).reject).toBe(true);
  });
  it("does not treat Boxing Day football as boxing", () => {
    expect(score("Premier League Boxing Day fixtures: Newcastle host Liverpool", "sports").reject).toBe(false);
  });
  it("penalises routine content even for priority teams", () => {
    expect(score("Real Madrid vs Girona: predicted line-ups and team news", "sports").score).toBeLessThan(40);
  });
});

describe("relevance scoring — geopolitics", () => {
  it("scores conflicts and trade deals highly and rejects celebrity news", () => {
    expect(score("Russia and Ukraine agree to ceasefire after summit", "geopolitics").score).toBeGreaterThan(55);
    expect(score("EU and China reach trade agreement on tariffs", "geopolitics").score).toBeGreaterThan(50);
    expect(score("Royal family celebrity gala dazzles", "geopolitics").reject).toBe(true);
  });
});

describe("clustering", () => {
  it("groups near-duplicate headlines and keeps the best-scored as primary", () => {
    const clusters = clusterItems([
      { title: "Fed cuts interest rates by quarter point", score: 50 },
      { title: "Federal Reserve cuts interest rates by quarter point amid cooling inflation", score: 70 },
      { title: "Newcastle sign midfielder from Brighton", score: 40 },
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].primary.score).toBe(70);
    expect(clusters[0].members).toHaveLength(2);
  });
});

describe("clustering — paraphrased headlines", () => {
  it("merges the same story reported with different wording", () => {
    const clusters = clusterItems([
      { title: "Fed cuts interest rates by a quarter point as inflation cools", score: 68 },
      { title: "Federal Reserve cuts rates amid cooling inflation, Wall Street rallies", score: 78 },
      { title: "Oil prices surge as OPEC announces surprise output cut", score: 33 },
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].members).toHaveLength(2);
  });
});
