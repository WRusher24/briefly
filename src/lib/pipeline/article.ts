import { readText, safeFetch } from "@/lib/net";
import { stripHtml } from "./rss";

const MAX_CHARS = 3200;

/** Pulls readable paragraph text out of an HTML page (no DOM dependency). */
export function extractArticleText(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|nav|header|footer|aside|form|figure|svg)[\s\S]*?<\/\1>/gi, " ");

  const paragraphs = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((p) => p.length >= 60 && !/^(read more|sign up|subscribe|advertisement|follow us|copyright)/i.test(p));

  if (paragraphs.length === 0) {
    const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i);
    return meta ? stripHtml(meta[1]) : "";
  }
  return paragraphs.join("\n").slice(0, MAX_CHARS);
}

/** Best-effort full-text fetch; returns "" on any failure (paywalls, bot walls, timeouts). */
export async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await safeFetch(url, {
      timeoutMs: 6_000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BrieflyBot/1.0; +https://briefly.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return "";
    return extractArticleText(await readText(res, 800_000));
  } catch {
    return "";
  }
}
