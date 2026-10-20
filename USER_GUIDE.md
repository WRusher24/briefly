# Briefly — User Guide

Briefly turns the noise of the news into a short, structured briefing for three areas: **Markets**, **Sports** and **Geopolitics**. You read headlines and verdicts in seconds, and open the full 3-tier breakdown only for what matters.

## 1. Create your account and plug in your AI key

1. Open the app and choose **Create an account** (name, email, password of 10+ characters). Your data is completely private to you.
2. You land on **Settings → AI**. Pick a provider and paste your API key:

| Provider | Where to get a free key | Suggested model |
| --- | --- | --- |
| **Groq** (recommended) | console.groq.com/keys | `llama-3.3-70b-versatile` |
| **Google Gemini** | aistudio.google.com/apikey | `gemini-3.5-flash-lite` |
| **OpenRouter** | openrouter.ai/keys | a model ending in `:free` |
| **OpenAI** | platform.openai.com/api-keys | `gpt-4o-mini` |
| **Custom** | any OpenAI-compatible server | your model id |

3. Press **Test connection**, then **Save settings**. Your key is encrypted and used only on the server.
4. Open **Briefing** and tap **Refresh**. The first update takes a minute or two. After that Briefly updates **automatically every 4 hours**.

## 2. The three domains

The three hubs sit at the top of the Briefing screen — tap to switch.

- **📈 Markets** — macro-economics, central banks, major market moves, institutional news and high-impact business events. Personal-finance advice and stock tips are filtered out.
- **⚽ Sports** — UFC/MMA and football (Champions League, Premier League, La Liga) with extra weight on **Real Madrid** and **Newcastle**. Boxing and NBA appear only for massive events (change this in Preferences). Routine games, previews and line-ups are dropped.
- **🌍 Geopolitics** — international relations, conflicts and ceasefires, sanctions, trade agreements and policy shifts.

### Reading a hub

1. **Daily Executive Flash** — three bullets summarising what happened globally in that sector.
2. **Story cards** — each shows a factual headline, a one-sentence verdict (TL;DR) and a read-time estimate such as *⏱️ 45 sec read*.
3. **Never repeats** — once you scroll past a card (after it has been on screen for a moment) or dismiss it, it will not come back. Dismiss with the **×** button or by **swiping** a card sideways on mobile. Anything you want to keep, save first.

## 3. The 3-tier insight view

Tap a card to open its debrief:

- **Tier 1 · What happened** — up to three bullet points of verified facts, filler removed.
- **Tier 2 · Why it matters** — the background you need to understand the consequence.
- **Tier 3 · The angle** — forward-looking analysis: secondary effects and hidden context. This tier is AI analysis, not reporting.

Use **Original** to open the source article, **Save debrief** to keep it, or **Dismiss** to clear it. Press Esc or tap outside to close.

## 4. Saved debriefs library

- Tap the **bookmark** on a card, inside a debrief, or on a **Daily Executive Flash** to save it permanently. Saving a flash briefing stores it as a **macro trend**.
- Open **Library** to browse everything by the date the events happened, grouped by month — ideal for looking back at market shifts or geopolitical turning points.
- Filter by domain, by *Stories* or *Macro trends*, or search titles, summaries and your own notes.
- Open an entry to add a **note** or remove it. Saved debriefs remain even after the original stories expire from the feed.

## 5. Sources and preferences

**Settings → Sources**
- Briefly ships with a curated directory of top-tier RSS feeds for each domain.
- Toggle any feed on/off, delete it, or **add your own** (the URL is validated before it is added). A red dot means the last fetch failed.
- **Restore removed built-in feeds** re-adds anything you deleted.

**Settings → Preferences**
- **Priority teams** (default Real Madrid, Newcastle), and switches for massive boxing / NBA events.
- **Boost** or **mute** keywords across all domains.
- **New stories per domain, per update** — lower this for a tighter briefing and fewer AI calls (helpful on free tiers).
- Switch to the **light theme** (dark is the default), change your password, sign out or delete your account.

## Tips

- Install Briefly on your phone: use your browser's **Add to Home Screen** for a full-screen app experience.
- If a refresh fails, the Briefing screen shows the reason (for example an invalid key or an exhausted free-tier quota).
- Keep an eye on read time: most stories take well under a minute.
