"use client";

import { useState } from "react";
import { DOMAINS, DOMAIN_META, type Domain } from "@/lib/domains";
import { api } from "@/lib/client-api";
import { timeAgo } from "@/lib/time";
import { TrashIcon } from "./icons";
import { Banner, Switch } from "./ui";

export interface FeedRow {
  id: string;
  domain: Domain;
  subtopic: string;
  name: string;
  url: string;
  enabled: boolean;
  isDefault: boolean;
  lastStatus: string | null;
  lastError: string | null;
  lastFetchedAt: string | null;
  lastItemCount: number | null;
}

export function SourcesManager({ initial }: { initial: FeedRow[] }) {
  const [feeds, setFeeds] = useState(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", domain: "markets" as Domain, subtopic: "" });
  const [collapsed, setCollapsed] = useState<Set<Domain>>(new Set());

  async function toggle(feed: FeedRow, enabled: boolean) {
    setFeeds((f) => f.map((x) => (x.id === feed.id ? { ...x, enabled } : x)));
    try {
      await api(`/api/feeds/${feed.id}`, { method: "PATCH", body: { enabled } });
    } catch (err) {
      setFeeds((f) => f.map((x) => (x.id === feed.id ? { ...x, enabled: feed.enabled } : x)));
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not update the feed" });
    }
  }

  async function remove(feed: FeedRow) {
    const previous = feeds;
    setFeeds((f) => f.filter((x) => x.id !== feed.id));
    try {
      await api(`/api/feeds/${feed.id}`, { method: "DELETE" });
    } catch (err) {
      setFeeds(previous);
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not delete the feed" });
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setMessage(null);
    try {
      const created = await api<FeedRow>("/api/feeds", { body: form });
      setFeeds((f) => [...f, created]);
      setForm({ name: "", url: "", domain: form.domain, subtopic: "" });
      setMessage({ kind: "ok", text: `Added “${created.name}” (${created.lastItemCount ?? 0} items found).` });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not add the feed" });
    } finally {
      setAdding(false);
    }
  }

  async function restore() {
    setMessage(null);
    try {
      const { added } = await api<{ added: number }>("/api/feeds/restore-defaults", { method: "POST", body: {} });
      if (added > 0) {
        setFeeds(await api<FeedRow[]>("/api/feeds"));
        setMessage({ kind: "ok", text: `Restored ${added} built-in ${added === 1 ? "feed" : "feeds"}.` });
      } else {
        setMessage({ kind: "ok", text: "All built-in feeds are already in your list." });
      }
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not restore feeds" });
    }
  }

  const enabledCount = feeds.filter((f) => f.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Sources</h1>
        <p className="mt-1 text-[13px] text-muted">
          {enabledCount} of {feeds.length} feeds active. Briefly fetches these every 4 hours, filters them for relevance, and only sends the best to your AI.
        </p>
      </div>

      {message && <Banner kind={message.kind}>{message.text}</Banner>}

      <form onSubmit={add} className="card space-y-3 p-4">
        <p className="text-sm font-medium">Add a custom feed</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input aria-label="Feed name" className="input" placeholder="Name (e.g. Bloomberg Markets)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
          <select aria-label="Domain" className="input" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value as Domain })}>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_META[d].emoji} {DOMAIN_META[d].label}
              </option>
            ))}
          </select>
        </div>
        <input aria-label="Feed URL" className="input font-mono text-sm" type="url" placeholder="https://example.com/rss.xml" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required />
        <input aria-label="Sub-topic" className="input" placeholder="Sub-topic (optional, e.g. Central Banks)" value={form.subtopic} onChange={(e) => setForm({ ...form, subtopic: e.target.value })} maxLength={40} />
        <button type="submit" disabled={adding} className="btn-primary w-full sm:w-auto">
          {adding ? "Checking feed…" : "Validate & add"}
        </button>
      </form>

      {DOMAINS.map((d) => {
        const meta = DOMAIN_META[d];
        const list = feeds.filter((f) => f.domain === d);
        const isCollapsed = collapsed.has(d);
        return (
          <section key={d} aria-label={meta.label}>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => { const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n; })}
              aria-expanded={!isCollapsed}
              className="flex min-h-[44px] w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden="true">{meta.emoji}</span>
                {meta.label}
                <span className="chip py-0.5 text-[11px]">{list.length}</span>
              </span>
              <span className="text-xs text-faint">{isCollapsed ? "Show" : "Hide"}</span>
            </button>
            {!isCollapsed && (
              <ul className="card divide-y divide-line">
                {list.length === 0 && <li className="p-4 text-sm text-muted">No feeds in this domain.</li>}
                {list.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[14px] font-medium">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${f.lastStatus === "error" ? "bg-danger" : f.lastStatus === "ok" ? "bg-ok" : "bg-faint"}`}
                          title={f.lastStatus === "error" ? `Last fetch failed: ${f.lastError}` : f.lastStatus === "ok" ? "Healthy" : "Not fetched yet"}
                          aria-hidden="true"
                        />
                        <span className="truncate">{f.name}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-faint">
                        {f.subtopic}
                        {f.isDefault ? "" : " · custom"}
                        {f.lastStatus === "error" && <span className="text-danger"> · {f.lastError}</span>}
                        {f.lastStatus === "ok" && f.lastFetchedAt && ` · checked ${timeAgo(f.lastFetchedAt)}`}
                      </p>
                    </div>
                    <Switch checked={f.enabled} onChange={(v) => toggle(f, v)} label={`${f.enabled ? "Disable" : "Enable"} ${f.name}`} />
                    <button onClick={() => remove(f)} aria-label={`Delete ${f.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-faint hover:bg-raised hover:text-danger">
                      <TrashIcon className="h-[18px] w-[18px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <button onClick={restore} className="btn-ghost w-full sm:w-auto">
        Restore removed built-in feeds
      </button>
    </div>
  );
}
