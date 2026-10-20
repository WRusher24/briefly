"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOMAIN_META, type Domain } from "@/lib/domains";
import { api } from "@/lib/client-api";
import type { CardItem, FlashData, RefreshState } from "@/lib/queries";
import { REFRESH_INTERVAL_MS, timeAgo } from "@/lib/time";
import { LibraryIcon, RefreshIcon } from "./icons";
import { InsightSheet } from "./insight-sheet";
import { StoryCard } from "./story-card";

interface Props {
  domain: Domain;
  hasKey: boolean;
  initialItems: CardItem[];
  initialFlash: FlashData | null;
  initialRefresh: RefreshState;
}

const DWELL_MS = 1200;

/**
 * Marks a card as "seen" once it has been on screen for DWELL_MS and then scrolled out of the
 * top of the viewport. Seen ids are batched to the server so the card never returns on reload.
 */
function useSeenTracker(onSeen: (id: string) => void) {
  const visibleSince = useRef(new Map<string, number>());
  const queue = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback((useBeacon = false) => {
    if (queue.current.size === 0) return;
    const ids = [...queue.current];
    queue.current.clear();
    if (useBeacon && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/items/seen", new Blob([JSON.stringify({ ids })], { type: "application/json" }));
    } else {
      api("/api/items/seen", { body: { ids } }).catch(() => ids.forEach((id) => queue.current.add(id)));
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.cardId;
          if (!id) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            if (!visibleSince.current.has(id)) visibleSince.current.set(id, Date.now());
            continue;
          }
          const since = visibleSince.current.get(id);
          const aboveViewport = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
          if (since !== undefined) {
            visibleSince.current.delete(id);
            if (aboveViewport && Date.now() - since >= DWELL_MS) {
              onSeen(id);
              queue.current.add(id);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => flush(), 1500);
            }
          }
        }
      },
      { threshold: [0, 0.6] },
    );

    const watched = new Set<Element>();
    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-card-id]").forEach((el) => {
        if (!watched.has(el)) {
          watched.add(el);
          observer.observe(el);
        }
      });
    };
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });

    const onHide = () => flush(true);
    const onVisibility = () => document.visibilityState === "hidden" && flush(true);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush(true);
    };
  }, [flush, onSeen]);
}

export function BriefingView({ domain, hasKey, initialItems, initialFlash, initialRefresh }: Props) {
  const meta = DOMAIN_META[domain];
  const [items, setItems] = useState(initialItems);
  const [flash, setFlash] = useState(initialFlash);
  const [refresh, setRefresh] = useState(initialRefresh);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wasRunning = useRef(initialRefresh.running);

  const markSeen = useCallback((id: string) => setSeen((prev) => new Set(prev).add(id)), []);
  useSeenTracker(markSeen);

  const open = items.find((i) => i.id === openId) ?? null;

  const reload = useCallback(async () => {
    const data = await api<{ items: CardItem[]; flash: FlashData | null; refresh: RefreshState }>(`/api/briefing/${domain}`);
    setFlash(data.flash);
    setRefresh(data.refresh);
    setItems((current) => {
      const known = new Set(current.map((i) => i.id));
      const fresh = data.items.filter((i) => !known.has(i.id));
      if (fresh.length) setNotice(`${fresh.length} new ${fresh.length === 1 ? "story" : "stories"} added`);
      return [...fresh, ...current];
    });
  }, [domain]);

  // Poll while a refresh is running; pull in the results when it finishes.
  useEffect(() => {
    if (!refresh.running) {
      if (wasRunning.current) {
        wasRunning.current = false;
        reload().catch(() => undefined);
      }
      return;
    }
    wasRunning.current = true;
    const id = setInterval(async () => {
      try {
        setRefresh(await api<RefreshState>("/api/refresh/status"));
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [refresh.running, reload]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function startRefresh() {
    setBusy(true);
    setNotice(null);
    try {
      await api("/api/refresh", { method: "POST", body: {} });
      setRefresh((r) => ({ ...r, running: true }));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start the refresh");
    } finally {
      setBusy(false);
    }
  }

  const dismiss = useCallback((item: CardItem) => {
    setLeaving((prev) => new Set(prev).add(item.id));
    api(`/api/items/${item.id}/dismiss`, { method: "POST", body: {} }).catch(() => undefined);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== item.id)), 320);
  }, []);

  const toggleSave = useCallback(async (item: CardItem) => {
    const patch = (savedId: string | null) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, savedId } : i)));
    try {
      if (item.savedId) {
        patch(null);
        await api(`/api/saved/${item.savedId}`, { method: "DELETE" });
      } else {
        patch("pending");
        const { id } = await api<{ id: string }>("/api/saved", { body: { itemId: item.id } });
        patch(id);
      }
    } catch (err) {
      patch(item.savedId);
      setNotice(err instanceof Error ? err.message : "Could not update saved debriefs");
    }
  }, []);

  async function toggleSaveFlash() {
    if (!flash) return;
    const previous = flash.savedId;
    try {
      if (previous) {
        setFlash({ ...flash, savedId: null });
        await api(`/api/saved/${previous}`, { method: "DELETE" });
      } else {
        setFlash({ ...flash, savedId: "pending" });
        const { id } = await api<{ id: string }>("/api/saved", { body: { flashId: flash.id } });
        setFlash((f) => (f ? { ...f, savedId: id } : f));
        setNotice("Flash briefing saved to your library");
      }
    } catch (err) {
      setFlash((f) => (f ? { ...f, savedId: previous } : f));
      setNotice(err instanceof Error ? err.message : "Could not save the briefing");
    }
  }

  const nextUpdate = useMemo(() => {
    if (!refresh.lastRefreshAt) return null;
    const at = new Date(refresh.lastRefreshAt).getTime() + REFRESH_INTERVAL_MS;
    const mins = Math.max(0, Math.round((at - Date.now()) / 60000));
    return mins <= 0 ? "due now" : mins < 60 ? `in ~${mins} min` : `in ~${Math.round(mins / 60)}h`;
  }, [refresh.lastRefreshAt]);

  const visible = items.length;

  return (
    <div className="pt-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{meta.label}</h1>
          <p className="mt-1 text-[13px] leading-snug text-muted">{meta.tagline}</p>
        </div>
        {hasKey && (
          <button onClick={startRefresh} disabled={busy || refresh.running} className="btn-ghost shrink-0 px-3" aria-label="Refresh briefing">
            <RefreshIcon className={`h-[18px] w-[18px] ${refresh.running ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refresh.running ? "Updating…" : "Refresh"}</span>
          </button>
        )}
      </div>

      {hasKey && (
        <p className="mt-2 text-xs text-faint" aria-live="polite">
          {refresh.running
            ? "Fetching feeds and synthesising insights — this takes a minute or two."
            : refresh.lastRefreshAt
              ? `Updated ${timeAgo(refresh.lastRefreshAt)} · next update ${nextUpdate}`
              : "Your first briefing is being prepared."}
        </p>
      )}

      {notice && (
        <div role="status" className="mt-3 animate-fadeIn rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-sm text-fg">
          {notice}
        </div>
      )}

      {!hasKey && (
        <div className="card mt-5 p-5">
          <p className="text-[15px] font-medium">Connect your AI key to start</p>
          <p className="mt-1.5 text-sm text-muted">
            Briefly uses your own free-tier key (Groq, Gemini, OpenRouter or any OpenAI-compatible endpoint) to filter and summarise the news. It takes about a minute.
          </p>
          <Link href="/settings" className="btn-primary mt-4">
            Add API key
          </Link>
        </div>
      )}

      {hasKey && !refresh.running && refresh.lastRun?.status === "failed" && refresh.lastRun.error && (
        <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm">
          <p className="font-medium text-danger">The last update failed</p>
          <p className="mt-1 text-muted">{refresh.lastRun.error}</p>
          <Link href="/settings" className="mt-2 inline-block text-fg underline underline-offset-4">
            Check AI settings
          </Link>
        </div>
      )}

      {hasKey && flash && (
        <section aria-labelledby="flash-title" className="card relative mt-5 overflow-hidden p-4 sm:p-5">
          <span className={`absolute inset-x-0 top-0 h-[2px] ${meta.bg}`} aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h2 id="flash-title" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Daily Executive Flash
            </h2>
            <div className="flex items-center gap-1">
              <span className="text-xs text-faint">{timeAgo(flash.generatedAt)}</span>
              <button
                onClick={toggleSaveFlash}
                aria-label={flash.savedId ? "Remove flash briefing from library" : "Save flash briefing to library"}
                aria-pressed={!!flash.savedId}
                className={`-mr-2 grid h-9 w-9 place-items-center rounded-full transition hover:bg-raised ${flash.savedId ? "text-accent" : "text-faint hover:text-fg"}`}
              >
                <LibraryIcon className="h-[18px] w-[18px]" filled={!!flash.savedId} />
              </button>
            </div>
          </div>
          <ol className="mt-3 space-y-3">
            {flash.bullets.map((b, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-snug">
                <span className={`mt-px font-mono text-xs ${meta.text}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-fg/95">{b}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {hasKey && (
        <section aria-label="Stories" className="mt-5 space-y-3">
          {items.map((item) => (
            <StoryCard key={item.id} item={item} seen={seen.has(item.id)} leaving={leaving.has(item.id)} onOpen={(i) => setOpenId(i.id)} onDismiss={dismiss} onToggleSave={toggleSave} />
          ))}

          {visible === 0 && !refresh.running && (
            <div className="card px-5 py-10 text-center">
              <p className="text-3xl" aria-hidden="true">
                {meta.emoji}
              </p>
              <p className="mt-3 text-[15px] font-medium">You’re all caught up</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
                Nothing new that clears the bar for this domain. Briefly checks again {nextUpdate ?? "every 4 hours"}.
              </p>
            </div>
          )}

          {visible > 0 && (
            <p className="px-2 pt-3 text-center text-xs text-faint">
              Stories you scroll past or dismiss won’t come back. Save anything you want to keep.
            </p>
          )}
        </section>
      )}

      {open && <InsightSheet item={open} onClose={() => setOpenId(null)} onToggleSave={toggleSave} onDismiss={dismiss} />}
    </div>
  );
}
