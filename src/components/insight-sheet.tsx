"use client";

import { useEffect, useRef } from "react";
import { DOMAIN_META } from "@/lib/domains";
import type { CardItem } from "@/lib/queries";
import { formatReadTime } from "@/lib/readtime";
import { timeAgo } from "@/lib/time";
import { CloseIcon, ExternalIcon, LibraryIcon } from "./icons";
import { InsightBody } from "./insight-body";

interface Props {
  item: CardItem;
  onClose: () => void;
  onToggleSave: (item: CardItem) => void;
  onDismiss: (item: CardItem) => void;
}

/** Bottom sheet on mobile, centred modal on desktop. */
export function InsightSheet({ item, onClose, onToggleSave, onDismiss }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const meta = DOMAIN_META[item.domain];
  const saved = !!item.savedId;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 animate-fadeIn bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="insight-title"
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full animate-sheetUp flex-col rounded-t-3xl border border-line bg-surface shadow-2xl outline-none sm:max-h-[86dvh] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${meta.bg}`} aria-hidden="true" />
              <span className={meta.text}>{meta.short}</span>
              <span className="text-faint">·</span>
              <span className="truncate">{item.sourceName}</span>
              <span className="text-faint">·</span>
              <span className="shrink-0">{timeAgo(item.publishedAt)}</span>
            </p>
            <h2 id="insight-title" className="mt-2 text-xl font-semibold leading-tight tracking-tight">
              {item.insight.headline}
            </h2>
            <p className="mt-1.5 text-xs text-faint">{formatReadTime(item.readSeconds)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg">
            <CloseIcon />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 pb-4 pt-2">
          <InsightBody tldr={item.insight.tldr} facts={item.insight.facts} why={item.insight.why} angle={item.insight.angle} sources={item.sources.length ? item.sources : [{ name: item.sourceName, url: item.url }]} />
        </div>

        <div className="pb-safe flex gap-2 border-t border-line px-5 py-3">
          <button onClick={() => onToggleSave(item)} className={`btn flex-1 ${saved ? "bg-accent/15 text-accent" : "btn-primary"}`} aria-pressed={saved}>
            <LibraryIcon className="h-[18px] w-[18px]" filled={saved} />
            {saved ? "Saved" : "Save debrief"}
          </button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-ghost" aria-label="Read the original article">
            <ExternalIcon className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Original</span>
          </a>
          <button
            onClick={() => {
              onDismiss(item);
              onClose();
            }}
            className="btn-ghost"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
