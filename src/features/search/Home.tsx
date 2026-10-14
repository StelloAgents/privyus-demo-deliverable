"use client";

import { CornerDownRight, History } from "lucide-react";
import { RECENT, TRY_ASKING, askHref } from "./search-index";

const row =
  "flex h-10 w-full items-center gap-3 rounded-card px-3 text-left transition-colors duration-[120ms] hover:bg-surface-2";

export interface HomeProps {
  onNavigate: (href: string) => void;
}

/** Quiet start content under the empty field: recent searches and script-backed questions. */
export function Home({ onNavigate }: HomeProps) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-8">
      <section aria-labelledby="recent-title" className="min-w-0">
        <h2 id="recent-title" className="t-meta px-3 pb-1.5">
          Recent searches
        </h2>
        {RECENT.map((r) => (
          <button key={r.label} type="button" className={row} onClick={() => onNavigate(r.href)}>
            <History size={16} strokeWidth={1.5} className="shrink-0 text-fg-3" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-fg-1">{r.label}</span>
            <span className="t-meta shrink-0">{r.when}</span>
          </button>
        ))}
      </section>
      <section aria-labelledby="try-title" className="min-w-0">
        <h2 id="try-title" className="t-meta px-3 pb-1.5">
          Try asking
        </h2>
        {TRY_ASKING.map((q) => (
          <button key={q} type="button" className={row} onClick={() => onNavigate(askHref(q))}>
            <CornerDownRight size={16} strokeWidth={1.5} className="shrink-0 text-teal" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[14px] text-fg-2">{q}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
