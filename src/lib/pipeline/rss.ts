import { XMLParser } from "fast-xml-parser";
import { sha1 } from "@/lib/crypto";
import { readText, safeFetch } from "@/lib/net";

export interface RawItem {
  title: string;
  url: string;
  text: string;
  publishedAt: Date;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  trimValues: true,
});

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

export function stripHtml(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Reduces any node shape fast-xml-parser can emit (string, {#text}, {@_href}) to a string. */
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    return text(o["#text"] ?? o["@_href"] ?? "");
  }
  return "";
}

function link(node: unknown): string {
  if (Array.isArray(node)) {
    const alt = node.find((l) => typeof l === "object" && (l as Record<string, string>)["@_rel"] !== "self" && (l as Record<string, string>)["@_href"]);
    return link(alt ?? node[0]);
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, string>;
    return o["@_href"] ?? text(node);
  }
  return text(node);
}

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|cmp$|at_|xtor)/i.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

export function hashUrl(url: string): string {
  return sha1(canonicalUrl(url));
}

function toArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom documents. Items without a title/link are dropped. */
export function parseFeed(xml: string, now = new Date()): RawItem[] {
  const doc = parser.parse(xml);
  let entries: Record<string, unknown>[] = [];
  if (doc?.rss?.channel) entries = toArray(doc.rss.channel.item ?? []);
  else if (doc?.["rdf:RDF"]) entries = toArray(doc["rdf:RDF"].item ?? []);
  else if (doc?.feed) entries = toArray(doc.feed.entry ?? []);
  else if (doc?.rss === "" || doc?.rss?.channel === undefined) entries = [];

  const items: RawItem[] = [];
  for (const e of entries) {
    const title = stripHtml(text(e.title));
    const url = (link(e.link) || text(e.guid) || text(e.id)).trim();
    if (!title || !/^https?:\/\//i.test(url)) continue;

    const body = text(e["content:encoded"]) || text(e.content) || text(e.description) || text(e.summary) || text(e["media:description"]);
    const rawDate = text(e.pubDate) || text(e["dc:date"]) || text(e.published) || text(e.updated);
    const parsed = rawDate ? new Date(rawDate) : null;
    // Future-dated or missing dates fall back to "now" so ordering stays sane.
    const publishedAt = parsed && !Number.isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime() + 3_600_000 ? parsed : now;

    items.push({ title, url, text: stripHtml(body).slice(0, 4000), publishedAt });
  }
  return items;
}

export interface FeedFetchResult {
  status: "ok" | "not_modified" | "error";
  items: RawItem[];
  etag?: string | null;
  lastModified?: string | null;
  error?: string;
}

export async function fetchFeed(
  url: string,
  cache: { etag?: string | null; lastModified?: string | null } = {},
): Promise<FeedFetchResult> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; BrieflyBot/1.0; +https://briefly.app)",
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
    };
    if (cache.etag) headers["If-None-Match"] = cache.etag;
    if (cache.lastModified) headers["If-Modified-Since"] = cache.lastModified;

    const res = await safeFetch(url, { headers, timeoutMs: 9_000 });
    if (res.status === 304) return { status: "not_modified", items: [] };
    if (!res.ok) return { status: "error", items: [], error: `HTTP ${res.status}` };

    const xml = await readText(res, 3_000_000);
    const items = parseFeed(xml);
    if (items.length === 0 && !/<(rss|feed|rdf:RDF)[\s>]/i.test(xml.slice(0, 2000))) {
      return { status: "error", items: [], error: "Not a valid RSS/Atom feed" };
    }
    return { status: "ok", items, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "TimeoutError" ? "Timed out" : err.message) : "Fetch failed";
    return { status: "error", items: [], error: message.slice(0, 200) };
  }
}
