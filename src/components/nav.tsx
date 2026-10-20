"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOMAINS, DOMAIN_META, type Domain } from "@/lib/domains";
import { BriefIcon, LibraryIcon, SettingsIcon } from "./icons";
import { Logo } from "./logo";

const LINKS = [
  { href: "/briefing/markets", match: "/briefing", label: "Briefing", Icon: BriefIcon },
  { href: "/library", match: "/library", label: "Library", Icon: LibraryIcon },
  { href: "/settings", match: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/briefing/markets" aria-label="Briefly home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {LINKS.map(({ href, match, label }) => {
            const active = pathname.startsWith(match);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${active ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl sm:hidden" aria-label="Main">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {LINKS.map(({ href, match, label, Icon }) => {
          const active = pathname.startsWith(match);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] transition ${active ? "text-fg" : "text-faint"}`}
              >
                <Icon className="h-[22px] w-[22px]" filled={active && match === "/library"} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The three primary hubs, pinned at the top of every briefing screen. */
export function HubTabs({ active }: { active: Domain }) {
  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-bg/90 px-4 backdrop-blur-xl">
      <div role="tablist" aria-label="Domains" className="grid grid-cols-3">
        {DOMAINS.map((d) => {
          const meta = DOMAIN_META[d];
          const isActive = d === active;
          return (
            <Link
              key={d}
              href={`/briefing/${d}`}
              role="tab"
              aria-selected={isActive}
              className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-2 text-[13px] font-medium transition sm:flex-row sm:gap-2 sm:text-sm ${
                isActive ? "text-fg" : "text-faint hover:text-muted"
              }`}
            >
              <span className="text-lg leading-none sm:text-base" aria-hidden="true">
                {meta.emoji}
              </span>
              <span>{meta.short}</span>
              {isActive && <span className={`absolute inset-x-6 bottom-0 h-[2px] rounded-full ${meta.bg}`} />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
