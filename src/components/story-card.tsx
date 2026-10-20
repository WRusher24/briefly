"use client";

import { useRef, useState } from "react";
import { DOMAIN_META } from "@/lib/domains";
import type { CardItem } from "@/lib/queries";
import { formatReadTime } from "@/lib/readtime";
import { timeAgo } from "@/lib/time";
import { CloseIcon, LibraryIcon } from "./icons";

interface Props {
  item: CardItem;
  seen: boolean;
  leaving: boolean;
  onOpen: (item: CardItem) => void;
  onDismiss: (item: CardItem) => void;
  onToggleSave: (item: CardItem) => void;
}

const SWIPE_DISMISS_PX = 110;

export function StoryCard({ item, seen, leaving, onOpen, onDismiss, onToggleSave }: Props) {
  const meta = DOMAIN_META[item.domain];
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; active: boolean; moved: boolean } | null>(null);
  const saved = !!item.savedId;
  const suppressClick = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return; // swipe is a touch gesture; desktop uses the × button
    drag.current = { x: e.clientX, y: e.clientY, active: false, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
        drag.current = null; // vertical scroll wins
        return;
      }
      if (Math.abs(mx) > 12) {
        d.active = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
    if (d.active) {
      d.moved = true;
      setDx(mx);
    }
  }
  function onPointerEnd() {
    const d = drag.current;
    drag.current = null;
    if (d?.active && Math.abs(dx) > SWIPE_DISMISS_PX) {
      onDismiss(item);
      return;
    }
    setDx(0);
    if (d?.moved) suppressClick.current = true;
  }
  function handleClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onOpen(item);
  }

  const progress = Math.min(1, Math.abs(dx) / SWIPE_DISMISS_PX);

  return (
    <article
      data-card-id={item.id}
      className={`relative transition-all duration-300 ${leaving ? "max-h-0 -translate-x-8 overflow-hidden opacity-0" : "max-h-[600px]"} ${seen ? "opacity-70" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open debrief: ${item.insight.headline}`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(item);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, opacity: dx ? 1 - progress * 0.5 : undefined, touchAction: "pan-y" }}
        className={`card group relative block w-full cursor-pointer select-none p-4 text-left outline-none transition-colors hover:border-faint/50 focus-visible:border-accent ${dx ? "" : "transition-transform"}`}
      >
        <span className={`absolute inset-y-4 left-0 w-[2px] rounded-full ${meta.bg}`} aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <span className="truncate font-medium">{item.sourceName}</span>
            <span className="text-faint">·</span>
            <span className="shrink-0">{timeAgo(item.publishedAt)}</span>
            {item.sources.length > 1 && (
              <>
                <span className="text-faint">·</span>
                <span className="shrink-0 text-faint">{item.sources.length} sources</span>
              </>
            )}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(item);
            }}
            aria-label="Dismiss story"
            className="-mr-2 -mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-faint transition hover:bg-raised hover:text-fg"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </button>
        </div>

        <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">{item.insight.headline}</h3>
        <p className="mt-1.5 text-[15px] leading-snug text-muted">{item.insight.tldr}</p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-faint">{formatReadTime(item.readSeconds)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(item);
            }}
            aria-label={saved ? "Remove from saved debriefs" : "Save debrief"}
            aria-pressed={saved}
            className={`-mb-2 -mr-2 grid h-10 w-10 place-items-center rounded-full transition hover:bg-raised ${saved ? "text-accent" : "text-faint hover:text-fg"}`}
          >
            <LibraryIcon className="h-[18px] w-[18px]" filled={saved} />
          </button>
        </div>
      </div>
    </article>
  );
}
