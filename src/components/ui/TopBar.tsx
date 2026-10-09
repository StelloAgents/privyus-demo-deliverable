"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu, WorkspaceMenu } from "./AccountMenus";
import { LOGO_DARK, LOGO_LIGHT } from "./logo-data";
import { ThemeToggle } from "./ThemeToggle";
import { startPresenting } from "./TourProvider";
import { Presentation } from "lucide-react";
import { cx } from "./cx";

const NAV = [
  { label: "Home", href: "/", match: (p: string) => p === "/" },
  { label: "Search", href: "/search", match: (p: string) => p.startsWith("/search") },
  { label: "Explore", href: "/explore", match: (p: string) => p.startsWith("/explore") },
  { label: "Technical", href: "/technical", match: (p: string) => p.startsWith("/technical") },
  { label: "Alternative Designs", href: "/lab", match: (p: string) => p.startsWith("/lab") },
];

/** App shell top bar: wordmark, nav (Home, Search, Explore, Technical, Alternative Designs), Workspace, and the user avatar. */
export function TopBar() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center rounded-panel border border-line bg-surface-1 pr-4 pl-6">
      <Link href="/" aria-label="Privyus home" className="flex shrink-0 items-center">
        {/* Both logos are inlined and in the DOM; CSS shows the one for data-theme, so the
            right logo paints in the first frame (no image request, no swap after hydration). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_DARK.src}
          alt="Privyus"
          width={LOGO_DARK.width}
          height={LOGO_DARK.height}
          decoding="sync"
          className="theme-dark-only h-[38px] w-auto"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_LIGHT.src}
          alt="Privyus"
          width={LOGO_LIGHT.width}
          height={LOGO_LIGHT.height}
          decoding="sync"
          className="theme-light-only h-[38px] w-auto"
        />
      </Link>
      <nav className="ml-12 flex h-full items-stretch gap-2" aria-label="Main">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex items-center rounded-button px-4 text-[15px] leading-5 font-medium transition-colors duration-[120ms] focus-visible:outline-offset-[-10px]",
                active ? "text-orange-ink" : "text-fg-2 hover:text-fg-1",
              )}
            >
              {item.label}
              {active ? <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-orange" /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => startPresenting(0, true)}
          title="Present (P)"
          className="flex h-9 items-center gap-1.5 rounded-button px-2.5 text-[15px] leading-5 font-medium text-fg-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1"
        >
          <Presentation size={16} strokeWidth={1.5} aria-hidden="true" />
          Present
        </button>
        <span className="h-6 w-px bg-line" aria-hidden="true" />
        <ThemeToggle />
        <WorkspaceMenu />
        <AccountMenu />
      </div>
    </header>
  );
}
