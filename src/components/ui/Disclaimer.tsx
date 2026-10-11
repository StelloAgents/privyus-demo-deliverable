"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "./cx";

/** The wording used everywhere the demo states where its data comes from. */
export const DISCLAIMER_TEXT =
  "Built from public records (senate.gov, clerk.house.gov, congress.gov, govinfo.gov, FEC, FARA, Senate press releases) retrieved October 2026. Records may be incomplete. Connections show records in common and do not imply wrongdoing. Dashboard counts and trends are illustrative.";

/** The one-line summary in the footer. The full wording opens from "Sources". */
export const DISCLAIMER_SHORT = "Public records, retrieved Oct 2026. Records in common, not wrongdoing.";

const CHIP = "shrink-0 rounded-chip border border-line px-1.5 py-px text-[11px] leading-4 font-semibold text-fg-2";

/**
 * Footer line on every page: "Confidential" and "Demo data" labels, a one-line data notice, and a
 * "Sources" button that opens the full notice (click, Enter or Space; Esc or a click outside closes it).
 * Always one line: the summary truncates before anything wraps.
 */
export function Disclaimer({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const popId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  return (
    <footer
      ref={rootRef}
      className={cx("relative -mx-4 flex h-[var(--footer-height)] shrink-0 items-center justify-end gap-2 bg-bg px-4 whitespace-nowrap", className)}
      aria-label="Confidentiality notice"
    >
      <span className={CHIP}>Confidential</span>
      <span className={CHIP}>Demo data</span>
      <p className="t-meta min-w-0 truncate" title={DISCLAIMER_SHORT}>
        {DISCLAIMER_SHORT}
      </p>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((v) => !v)}
        className="t-meta shrink-0 rounded-chip px-1 !text-fg-2 underline decoration-line-strong underline-offset-2 transition-colors duration-[120ms] hover:!text-fg-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal"
      >
        Sources
      </button>
      <div
        id={popId}
        role="dialog"
        aria-label="Data sources"
        data-disclaimer-pop=""
        hidden={!open}
        className="absolute right-4 bottom-[calc(100%+4px)] z-10 w-[min(440px,calc(100vw-32px))] rounded-overlay border border-line-strong bg-surface-1 px-3.5 py-3 text-left whitespace-normal shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
      >
        <p className="t-meta !text-fg-2">{DISCLAIMER_TEXT}</p>
      </div>
    </footer>
  );
}
