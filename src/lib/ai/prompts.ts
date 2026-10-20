import type { Domain } from "@/lib/domains";
import type { Preferences } from "@/lib/preferences";

const DOMAIN_RUBRIC: Record<Domain, (prefs: Preferences) => string> = {
  markets: () =>
    [
      "DOMAIN: Stock Market & Business.",
      "KEEP only: macro-economics (inflation, rates, growth, jobs, central banks), major market shifts, institutional / regulatory news, and high-impact business events (large M&A, bankruptcies, earnings that move markets, major layoffs, supply shocks).",
      "REJECT: personal-finance advice, stock tips, product news, minor company stories, opinion filler, listicles, crypto hype without market-wide impact.",
    ].join("\n"),
  sports: (prefs) =>
    [
      "DOMAIN: Sports.",
      "KEEP: UFC/MMA (title fights, major cards, big results, notable retirements); football with priority on the Champions League, Premier League and La Liga;" +
        ` always keep significant news about: ${prefs.favoriteTeams.join(", ") || "none specified"}.`,
      prefs.includeBoxing ? "Boxing ONLY for massive events (unification/undisputed fights, superstar bouts)." : "REJECT all boxing.",
      prefs.includeNba ? "NBA ONLY for massive events (Finals, playoffs turning points, MVP-level news, blockbuster trades)." : "REJECT all NBA.",
      "REJECT: routine league games, match previews, line-ups, minor transfers, gossip, betting content, other sports and lower leagues.",
    ].join("\n"),
  geopolitics: () =>
    [
      "DOMAIN: Geopolitics.",
      "KEEP: macro-level international relations, armed conflicts and ceasefires, sanctions, trade agreements and disputes, alliances, major elections and policy shifts with cross-border consequences.",
      "REJECT: domestic crime, celebrity/royal news, local politics without international impact, human-interest stories.",
    ].join("\n"),
};

export const ANALYST_SYSTEM = `You are the analyst engine behind "Briefly", a zero-waste briefing app. You turn raw news items into ultra-efficient debriefs.

Rules:
- Use ONLY information present in the provided item text for facts. Never invent numbers, quotes, names or dates.
- Be neutral, factual and concise. No hype, no filler, no emojis.
- "angle" is explicitly analysis: secondary effects, second-order consequences, hidden context. Mark uncertainty with words like "likely" or "could" — never state speculation as fact.
- Reply with a single JSON object and nothing else.`;

export function batchPrompt(domain: Domain, prefs: Preferences, items: Array<Record<string, unknown>>): string {
  return `${DOMAIN_RUBRIC[domain](prefs)}

For EACH item below decide if it deserves a place in a premium briefing for this domain, then write the debrief.

Return JSON of the form:
{"items":[{"id":"<same id>","relevant":true|false,"importance":1-10,"headline":"...","tldr":"...","facts":["...","...","..."],"why":"...","angle":"..."}]}

Field requirements:
- relevant: false if the item fails the domain rules or has no real news value (then you may omit the other fields).
- importance: 1-10 global significance within this domain (10 = defining event of the week; <=3 = marginal).
- headline: factual, neutral, max 90 characters, no clickbait.
- tldr: ONE sentence verdict (max 28 words) stating what it means, not just what happened.
- facts: Tier 1 "What happened" — exactly 3 short bullet strings (max 25 words each) of verified events from the text. If the text supports fewer than 3 distinct facts, provide only what it supports; never pad.
- why: Tier 2 "Why it matters" — 2-3 sentences of background and consequence a smart reader needs.
- angle: Tier 3 "The angle" — 2-3 sentences of forward-looking analysis on second-order effects and hidden context.

Items:
${JSON.stringify(items, null, 1)}`;
}

export function flashPrompt(domain: Domain, items: Array<{ headline: string; tldr: string }>): string {
  const label = { markets: "stock markets and business", sports: "sports (MMA/UFC and top football)", geopolitics: "geopolitics" }[domain];
  return `Write the Daily Executive Flash Briefing for ${label}.

Using ONLY the stories below, write exactly 3 bullet points summarising what happened globally in this sector, most important first. Each bullet: one sentence, max 30 words, concrete (who/what/number), no filler.

Return JSON: {"bullets":["...","...","..."]}

Stories:
${items.map((i, n) => `${n + 1}. ${i.headline} — ${i.tldr}`).join("\n")}`;
}
