"use client";

import { ExternalLink, Quote } from "lucide-react";
import { IconRing, cx } from "@/components/ui";
import { domainOf, type PublicStatement, type Sentiment } from "./data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 28, 2026" from "2026-09-28". */
export function statementDate(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
}

/** The sentiment of one statement's text: teal when supportive, lavender when critical. */
export function SentimentChip({ sentiment, className }: { sentiment: Sentiment; className?: string }) {
  return (
    <span
      data-sentiment={sentiment.tone}
      className={cx(
        "inline-flex h-[18px] shrink-0 items-center rounded-chip border px-1.5 text-[11px] leading-none font-semibold whitespace-nowrap",
        sentiment.tone === "supportive"
          ? "border-[var(--teal-edge)] bg-[var(--teal-soft)] text-teal-bright"
          : "border-[color-mix(in_srgb,var(--lavender)_50%,transparent)] bg-[var(--lavender-soft)] text-lavender",
        className,
      )}
    >
      {sentiment.label}
    </span>
  );
}

function openStatement(s: PublicStatement) {
  window.open(s.url, "_blank", "noopener,noreferrer");
}

/**
 * One public statement: the verbatim quote, its sentiment, its source site, and its date. It
 * opens the original, never Explore: a statement is not a cited record. On Home it keeps the
 * height of a public-record row (one line of quote), so the feed's fit count holds; in the chat
 * (`wrap`) the whole quote shows.
 */
export function StatementRow({ statement, wrap }: { statement: PublicStatement; wrap?: boolean }) {
  const domain = domainOf(statement.url);
  return (
    <button
      type="button"
      data-statement={statement.id}
      onClick={() => openStatement(statement)}
      aria-label={`“${statement.quote}” ${statement.kind}, ${domain}, ${statementDate(statement.date)}. ${statement.sentiment.label}. Opens the original in a new tab.`}
      className={cx(
        "group flex w-full min-w-0 gap-3 rounded-card px-2 text-left transition-[background-color] duration-[120ms] hover:bg-surface-2",
        wrap ? "items-start py-2" : "items-center py-2",
      )}
    >
      {wrap ? null : <IconRing icon={Quote} size={40} iconSize={18} />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span title={wrap ? undefined : statement.quote} className={cx("leading-5 font-medium text-fg-1", wrap ? "text-[13px]" : "truncate text-[14px]")}>
          “{statement.quote}”
        </span>
        <span className={cx("flex min-w-0 items-center gap-2", wrap ? "flex-wrap gap-y-1" : "h-5")}>
          <SentimentChip sentiment={statement.sentiment} />
          <span className="t-meta truncate">
            {wrap ? `${statementDate(statement.date)} · ` : null}
            {domain}
          </span>
        </span>
      </span>
      {wrap ? null : (
        <span className="t-meta flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="text-fg-2">{statementDate(statement.date).replace(/, \d{4}$/, "")}</span>
          <span>Statement</span>
        </span>
      )}
      <ExternalLink
        size={16}
        strokeWidth={1.5}
        aria-hidden="true"
        className={cx("-ml-1 shrink-0 text-fg-3 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100", wrap && "mt-1")}
      />
    </button>
  );
}
