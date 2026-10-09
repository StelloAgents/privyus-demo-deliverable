import { cx } from "./cx";

/** The wording used everywhere the demo states that its data is illustrative. */
export const DISCLAIMER_TEXT =
  "Demonstration build. All names, records, and figures are illustrative and do not describe real people or events.";

/** Footer line on every page: a "Confidential" label and the illustrative-data notice. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <footer
      className={cx("flex min-h-[var(--footer-height)] shrink-0 items-center justify-end gap-2.5 py-1.5 text-right", className)}
      aria-label="Confidentiality notice"
    >
      <span className="shrink-0 rounded-chip border border-line px-1.5 py-px text-[12px] leading-4 font-semibold text-fg-2">
        Confidential
      </span>
      <p className="t-meta min-w-0">{DISCLAIMER_TEXT}</p>
    </footer>
  );
}
