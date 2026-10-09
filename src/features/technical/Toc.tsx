"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui/cx";
import { SECTIONS } from "./content";

/** "On this page": a sticky list of the sections. The section in view is marked. */
export function Toc() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => Boolean(e));
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        // The first section (in page order) that is in the reading band.
        const first = SECTIONS.find((s) => visible.has(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-15% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav aria-label="On this page" className="sticky top-6">
      <p className="t-meta mb-3">On this page</p>
      <ul className="flex flex-col border-l border-line">
        {SECTIONS.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? "location" : undefined}
                className={cx(
                  "-ml-px block border-l-2 py-1.5 pl-3 text-[13px] leading-5 transition-colors duration-[120ms]",
                  on ? "border-teal-bright font-medium text-fg-1" : "border-transparent text-fg-3 hover:text-fg-1",
                )}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
