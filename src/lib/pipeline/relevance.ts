import type { Domain } from "@/lib/domains";
import type { Preferences } from "@/lib/preferences";

type Rule = [RegExp, number];

export interface Scorable {
  title: string;
  text: string;
  publishedAt: Date;
}

export interface ScoreContext {
  domain: Domain;
  subtopic: string;
  prefs: Preferences;
  now?: Date;
}

export interface ScoreResult {
  score: number;
  /** Hard-rejected (muted keyword, wrong sport, too old, evergreen filler…). */
  reject: boolean;
}

export const MAX_AGE_HOURS = 48;
export const CANDIDATE_THRESHOLD = 25;

const rx = (pattern: string) => new RegExp(`\\b(?:${pattern})\\b`, "i");

// ── Markets ───────────────────────────────────────────────────────────────
const MARKETS_RULES: Rule[] = [
  [rx("federal reserve|the fed|fomc|ecb|bank of england|bank of japan|boj|central banks?|powell|lagarde"), 22],
  [rx("interest rates?|rate (?:cut|hike|decision)|inflation|cpi|ppi|gdp|jobs report|nonfarm payrolls?|unemployment|recession|stagflation"), 20],
  [rx("treasury yields?|bond yields?|s&p 500|nasdaq|dow jones|wall street|stock market|stocks|equities|sell-?off|rally|bear market|bull market|volatility"), 18],
  [rx("oil prices?|crude|opec|natural gas|gold|dollar|yen|yuan|euro|currency|bitcoin"), 12],
  [rx("tariffs?|trade war|sanctions?|antitrust|regulators?|sec|imf|world bank|g7|g20"), 12],
  [rx("earnings|guidance|ipo|merger|acquisition|takeover|buyout|bankruptcy|layoffs?|downgrade|upgrade|profit warning|billion|trillion"), 10],
  [rx("semiconductors?|chips?|ai spending|nvidia|apple|microsoft|amazon|alphabet|tesla|jpmorgan|goldman sachs"), 6],
];
const MARKETS_REJECT = rx(
  "how to|best (?:credit cards?|savings accounts?)|should you|stocks? to (?:buy|watch)|your money|personal finance|mortgage rates? today|horoscope|sponsored|podcast|newsletter|quiz|retirement (?:tips|savings)|coupon|gift guide|celebrity",
);
const MARKETS_SUBTOPIC: Record<string, number> = { "Central Banks": 25, "Macro-economics": 10, Markets: 6, Business: 3 };

// ── Geopolitics ───────────────────────────────────────────────────────────
const GEO_RULES: Rule[] = [
  [rx("war|ceasefire|truce|sanctions?|treaty|summit|nato|security council|invasion|invade|missiles?|nuclear|airstrikes?|troops|coup|annex(?:ation|ed)?|embargo|blockade"), 20],
  [rx("peace (?:talks?|deal|agreement|plan)|trade (?:deal|agreement|talks|war)|tariffs?|diplomat(?:ic|s)?|g7|g20|brics|asean|un general assembly|referendum|regime|geopolitic(?:s|al)?|alliance|extradit(?:e|ion)"), 16],
  [rx("election|president|prime minister|parliament|border|refugees?|migration policy|energy security|foreign minister|defen[cs]e minister"), 9],
  [rx("russia|ukraine|china|taiwan|israel|gaza|iran|north korea|india|pakistan|european union|eu|south china sea|red sea|middle east|hamas|hezbollah|syria|sudan|venezuela|kremlin|beijing|washington"), 8],
];
const GEO_REJECT = rx(
  "celebrity|royal family|prince|princess|recipe|horoscope|weather|obituary|lottery|football|premier league|cricket|tennis|golf|movie|film|box office|fashion|podcast|quiz|sponsored",
);
const GEO_SUBTOPIC: Record<string, number> = { Institutions: 8, Trade: 8, Analysis: 4, World: 3 };

// ── Sports ────────────────────────────────────────────────────────────────
const TEAM_ALIASES: Record<string, string[]> = {
  "real madrid": ["los blancos", "bernabeu", "bernabéu", "ancelotti", "mbappe", "mbappé", "vinicius", "bellingham"],
  newcastle: ["nufc", "magpies", "st james' park", "st james’ park", "eddie howe"],
};
const OTHER_SPORTS = rx(
  "cricket|rugby|tennis|golf|formula (?:1|one)|f1|nfl|mlb|nhl|cycling|athletics|olympics?|darts|snooker|netball|motogp|wwe|nascar|baseball|ice hockey|swimming|horse racing|ashes|grand prix|wimbledon",
);
const SPORTS_ROUTINE = rx(
  "fantasy|betting|odds|predictions?|tips|picks|line-?ups?|team news|how to watch|tv guide|live blog|as it happened|minute-by-minute|player ratings|talking points|mailbag|quiz|highlights|gossip|podcast|sponsored",
);
const OTHER_LEAGUES = rx("serie a|bundesliga|ligue 1|mls|scottish premiership|eredivisie|league one|league two|saudi pro league|carabao cup|national league|women'?s super league");
const FOOTBALL_RULES: Rule[] = [
  [rx("champions league"), 28],
  [rx("el cl[aá]sico"), 35],
  [rx("la liga|laliga"), 22],
  [rx("premier league"), 20],
  [rx("world cup|euro 20\\d\\d|nations league"), 18],
  [rx("europa league|fa cup|copa del rey|super cup"), 8],
  [rx("transfer|signs?|signing|contract|sacked|appointed|manager|injur(?:y|ed)|suspended|ban"), 7],
];
const MMA_RULES: Rule[] = [
  [rx("ufc"), 32],
  [rx("mma|mixed martial arts|octagon|dana white|pfl|bellator|one championship"), 16],
  [rx("title fight|champion|championship|belt|main event|knockout|submission|interim|ufc \\d{3}|retire[sd]?"), 12],
];
const BOXING_WORDS = rx("boxing|boxer|bout|heavyweight|undisputed|wbc|wba|ibf|wbo");
const BOXING_MEGA = rx(
  "undisputed|unification|heavyweight title|world title|usyk|fury|canelo|joshua|inoue|crawford|haney|beterbiev|bivol|wilder|tyson|dubois|stevenson|garcia",
);
const NBA_WORDS = rx("nba|lakers|celtics|warriors|knicks|bucks|lebron|curry|wembanyama|jokic|doncic|durant");
const NBA_MEGA = rx("nba finals|finals|playoffs?|conference finals|mvp|traded?|draft|championship|all-star|record|retire[sd]?|ruled out|suspend(?:ed)?");

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function teamPattern(team: string): RegExp {
  const key = Object.keys(TEAM_ALIASES).find((k) => team.toLowerCase().includes(k));
  const terms = [team.toLowerCase(), ...(key ? TEAM_ALIASES[key] : [])].map(escapeRegExp);
  return new RegExp(`(?:^|[^\\p{L}])(?:${terms.join("|")})(?![\\p{L}])`, "iu");
}

/** Distinct matches of a rule inside `text` (case-insensitive). */
function distinctMatches(re: RegExp, text: string): number {
  const found = new Set<string>();
  for (const m of text.matchAll(new RegExp(re.source, "gi"))) found.add(m[0].toLowerCase());
  return found.size;
}

/** Each rule counts once, plus a diminishing bonus for further distinct terms from the same rule. */
function weighted(rules: Rule[], title: string, body: string, cap: number): number {
  let sum = 0;
  for (const [re, weight] of rules) {
    const inTitle = distinctMatches(re, title);
    const hits = inTitle > 0 ? inTitle : distinctMatches(re, body);
    if (hits === 0) continue;
    const strength = Math.min(1 + 0.6 * (hits - 1), 2);
    sum += weight * strength * (inTitle > 0 ? 1 : 0.5);
  }
  return Math.min(sum, cap);
}

function recencyBonus(publishedAt: Date, now: Date): number {
  const hours = (now.getTime() - publishedAt.getTime()) / 3_600_000;
  if (hours < 3) return 10;
  if (hours < 12) return 6;
  if (hours < 24) return 3;
  if (hours > 36) return -8;
  return 0;
}

function keywordRegex(words: string[]): RegExp | null {
  const cleaned = words.map((w) => w.trim()).filter(Boolean).map(escapeRegExp);
  return cleaned.length ? new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${cleaned.join("|")})(?![\\p{L}\\p{N}])`, "iu") : null;
}

/** Cheap, deterministic pre-filter. Runs before any AI call so irrelevant items cost nothing. */
export function scoreItem(item: Scorable, ctx: ScoreContext): ScoreResult {
  const now = ctx.now ?? new Date();
  const ageHours = (now.getTime() - item.publishedAt.getTime()) / 3_600_000;
  if (ageHours > MAX_AGE_HOURS) return { score: 0, reject: true };

  const title = item.title;
  const body = item.text.slice(0, 700);
  const both = `${title} ${body}`;

  const mute = keywordRegex(ctx.prefs.muteKeywords);
  if (mute?.test(both)) return { score: 0, reject: true };

  let score = recencyBonus(item.publishedAt, now);
  const boost = keywordRegex(ctx.prefs.boostKeywords);
  if (boost?.test(title)) score += 25;
  else if (boost?.test(body)) score += 12;

  switch (ctx.domain) {
    case "markets": {
      if (MARKETS_REJECT.test(title)) return { score: 0, reject: true };
      score += 8 + (MARKETS_SUBTOPIC[ctx.subtopic] ?? 0) + weighted(MARKETS_RULES, title, body, 75);
      break;
    }
    case "geopolitics": {
      if (GEO_REJECT.test(title)) return { score: 0, reject: true };
      score += 8 + (GEO_SUBTOPIC[ctx.subtopic] ?? 0) + weighted(GEO_RULES, title, body, 75);
      break;
    }
    case "sports": {
      const priority = ctx.prefs.favoriteTeams.some((team) => {
        const re = teamPattern(team);
        return re.test(title) || re.test(body);
      });
      const priorityInTitle = ctx.prefs.favoriteTeams.some((team) => teamPattern(team).test(title));
      const mma = MMA_RULES[0][0].test(both) || MMA_RULES[1][0].test(both);
      const boxing = BOXING_WORDS.test(both.replace(/boxing day/gi, "")) && !mma;
      const nba = NBA_WORDS.test(title) && !priority;

      if (OTHER_SPORTS.test(title) && !priority && !mma) return { score: 0, reject: true };

      if (boxing) {
        if (!ctx.prefs.includeBoxing || !BOXING_MEGA.test(both)) return { score: 0, reject: true };
        score += 38;
      } else if (nba) {
        if (!ctx.prefs.includeNba || !NBA_MEGA.test(both)) return { score: 0, reject: true };
        score += 34;
      } else {
        score += 3 + weighted(MMA_RULES, title, body, 60) + weighted(FOOTBALL_RULES, title, body, 60);
        if (priorityInTitle) score += 45;
        else if (priority) score += 25;
        if (OTHER_LEAGUES.test(title) && !priority) score -= 22;
        if (/^(Real Madrid|Newcastle United)$/i.test(ctx.subtopic)) score += 12;
      }
      if (SPORTS_ROUTINE.test(title)) score -= 32;
      break;
    }
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reject: false };
}
