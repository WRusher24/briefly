"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings", label: "AI" },
  { href: "/settings/sources", label: "Sources" },
  { href: "/settings/preferences", label: "Preferences" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-bg/90 px-4 backdrop-blur-xl">
      <nav className="flex gap-1" aria-label="Settings sections">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[48px] items-center px-3.5 text-sm font-medium transition ${active ? "text-fg" : "text-faint hover:text-muted"}`}
            >
              {t.label}
              {active && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
