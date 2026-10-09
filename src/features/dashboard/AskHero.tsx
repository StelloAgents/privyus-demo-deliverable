"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AskBar, cx } from "@/components/ui";
import { dashboard } from "@/data/dashboard";
import { useHome } from "./homeStore";
import { askHref } from "./links";

/** 1.1 Headline and ask bar: the headline on the left, the ask bar on the right of the same row. */
export function AskHero({ className }: { className?: string }) {
  const router = useRouter();
  // In the Home store, so presenter mode can type the question.
  const text = useHome((s) => s.askText);
  const setText = useHome((s) => s.setAskText);
  // The field starts empty each time Home opens (as a local field would).
  useEffect(() => () => useHome.getState().setAskText(""), []);
  return (
    <section
      aria-label="Ask Privyus"
      className={cx("grid grid-cols-[minmax(0,42fr)_minmax(0,58fr)] items-center gap-8 px-2", className)}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[34px] leading-[40px] font-bold text-fg-1">{dashboard.greeting}</h1>
      </div>
      <div data-tour="ask-bar" className="min-w-0">
      <AskBar
        value={text}
        onChange={setText}
        onSubmit={(q) => router.push(askHref(q))}
        placeholder="Ask anything about people, bills, or connections"
        clearOnSubmit={false}
      />
      </div>
    </section>
  );
}
