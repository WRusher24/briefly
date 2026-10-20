import type { Domain } from "./domains";

export interface DirectoryFeed {
  domain: Domain;
  subtopic: string;
  name: string;
  url: string;
}

const f = (domain: Domain, subtopic: string, name: string, url: string): DirectoryFeed => ({
  domain,
  subtopic,
  name,
  url,
});

/**
 * Built-in directory of top-tier feeds. It is copied into each user's own feed list on
 * registration (and by "Restore defaults"), so every user can toggle or remove feeds
 * without affecting anyone else. Dead feeds are tolerated: health is tracked per feed.
 */
export const DEFAULT_FEEDS: DirectoryFeed[] = [
  // ── Stock Market & Business ────────────────────────────────────────────
  f("markets", "Markets", "CNBC — Top News", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
  f("markets", "Markets", "CNBC — Finance", "https://www.cnbc.com/id/10000664/device/rss/rss.html"),
  f("markets", "Macro-economics", "CNBC — Economy", "https://www.cnbc.com/id/20910258/device/rss/rss.html"),
  f("markets", "Markets", "MarketWatch — Top Stories", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
  f("markets", "Markets", "MarketWatch — Market Pulse", "https://feeds.content.dowjones.io/public/rss/mw_marketpulse"),
  f("markets", "Markets", "WSJ — Markets", "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"),
  f("markets", "Business", "WSJ — Business", "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml"),
  f("markets", "Markets", "Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
  f("markets", "Markets", "Financial Times — Home", "https://www.ft.com/rss/home"),
  f("markets", "Business", "NYT — Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"),
  f("markets", "Macro-economics", "NYT — Economy", "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml"),
  f("markets", "Business", "BBC — Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
  f("markets", "Business", "The Guardian — Business", "https://www.theguardian.com/uk/business/rss"),
  f("markets", "Central Banks", "Federal Reserve — Press Releases", "https://www.federalreserve.gov/feeds/press_all.xml"),
  f("markets", "Central Banks", "ECB — Press", "https://www.ecb.europa.eu/rss/press.html"),
  f("markets", "Markets", "Seeking Alpha — Market Currents", "https://seekingalpha.com/market_currents.xml"),

  // ── Sports ─────────────────────────────────────────────────────────────
  f("sports", "Real Madrid", "The Guardian — Real Madrid", "https://www.theguardian.com/football/realmadrid/rss"),
  f("sports", "Newcastle United", "The Guardian — Newcastle United", "https://www.theguardian.com/football/newcastleunited/rss"),
  f("sports", "Champions League", "The Guardian — Champions League", "https://www.theguardian.com/football/championsleague/rss"),
  f("sports", "Premier League", "The Guardian — Premier League", "https://www.theguardian.com/football/premierleague/rss"),
  f("sports", "La Liga", "The Guardian — La Liga", "https://www.theguardian.com/football/laligafootball/rss"),
  f("sports", "Football", "BBC Sport — Football", "https://feeds.bbci.co.uk/sport/football/rss.xml"),
  f("sports", "Premier League", "BBC Sport — Premier League", "https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml"),
  f("sports", "Champions League", "BBC Sport — Champions League", "https://feeds.bbci.co.uk/sport/football/champions-league/rss.xml"),
  f("sports", "La Liga", "BBC Sport — La Liga", "https://feeds.bbci.co.uk/sport/football/spanish-la-liga/rss.xml"),
  f("sports", "Football", "ESPN — Soccer", "https://www.espn.com/espn/rss/soccer/news"),
  f("sports", "Football", "Sky Sports — Football", "https://www.skysports.com/rss/12040"),
  f("sports", "MMA / UFC", "MMA Fighting", "https://www.mmafighting.com/rss/current"),
  f("sports", "MMA / UFC", "MMA Junkie", "https://mmajunkie.usatoday.com/feed"),
  f("sports", "MMA / UFC", "BBC Sport — MMA", "https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml"),
  f("sports", "MMA / UFC", "ESPN — MMA", "https://www.espn.com/espn/rss/mma/news"),
  f("sports", "MMA / UFC", "The Guardian — MMA", "https://www.theguardian.com/sport/mixedmartialarts/rss"),
  f("sports", "Boxing", "BBC Sport — Boxing", "https://feeds.bbci.co.uk/sport/boxing/rss.xml"),
  f("sports", "Boxing", "The Guardian — Boxing", "https://www.theguardian.com/sport/boxing/rss"),
  f("sports", "NBA", "ESPN — NBA", "https://www.espn.com/espn/rss/nba/news"),
  f("sports", "NBA", "The Guardian — NBA", "https://www.theguardian.com/sport/nba/rss"),

  // ── Geopolitics ────────────────────────────────────────────────────────
  f("geopolitics", "World", "BBC — World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
  f("geopolitics", "Middle East", "BBC — Middle East", "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"),
  f("geopolitics", "Europe", "BBC — Europe", "https://feeds.bbci.co.uk/news/world/europe/rss.xml"),
  f("geopolitics", "Asia-Pacific", "BBC — Asia", "https://feeds.bbci.co.uk/news/world/asia/rss.xml"),
  f("geopolitics", "World", "Al Jazeera — All News", "https://www.aljazeera.com/xml/rss/all.xml"),
  f("geopolitics", "World", "The Guardian — World", "https://www.theguardian.com/world/rss"),
  f("geopolitics", "World", "NYT — World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
  f("geopolitics", "World", "NPR — World", "https://feeds.npr.org/1004/rss.xml"),
  f("geopolitics", "Europe", "DW — World", "https://rss.dw.com/xml/rss-en-world"),
  f("geopolitics", "World", "France 24", "https://www.france24.com/en/rss"),
  f("geopolitics", "Institutions", "UN News — Top Stories", "https://news.un.org/feed/subscribe/en/news/all/rss.xml"),
  f("geopolitics", "Analysis", "Foreign Policy", "https://foreignpolicy.com/feed"),
  f("geopolitics", "Asia-Pacific", "The Diplomat", "https://thediplomat.com/feed/"),
  f("geopolitics", "Trade", "WTO — News", "https://www.wto.org/library/rss/latest_news_e.xml"),
];
