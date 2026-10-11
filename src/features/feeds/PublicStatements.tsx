"use client";

import type { JSX } from "react";
import { Megaphone } from "lucide-react";
import { SENTIMENT_FOOTNOTE, STATEMENTS_HEADING, STATEMENTS_SUBHEAD, ukraineToneLine } from "./data";
import { StatementRow } from "./StatementRow";
import { statementsFor } from "./store";

/**
 * A person's public statements under an answer: verbatim quotes from public sources, each with
 * its date, source site, and a sentiment label, newest first. Returns null when the person has
 * none. Mount it beside, never inside, the answer's sources: a statement is not a citation.
 */
export function PublicStatements({ personId, limit }: { personId: string; limit?: number }): JSX.Element | null {
  const all = statementsFor(personId);
  if (all.length === 0) return null;
  const shown = limit === undefined ? all : all.slice(0, Math.max(0, limit));
  const tone = ukraineToneLine(shown);
  return (
    <section aria-label={STATEMENTS_HEADING} data-tour="public-statements" data-public-statements={personId} className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-col px-2">
        <span className="t-meta flex items-center gap-1.5 font-semibold text-fg-1">
          <Megaphone size={14} strokeWidth={1.5} aria-hidden="true" className="text-teal" />
          {STATEMENTS_HEADING}
        </span>
        <span className="t-meta">{STATEMENTS_SUBHEAD}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {shown.map((s) => (
          <li key={s.id}>
            <StatementRow statement={s} wrap />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-0.5 px-2">
        {tone ? (
          <p className="t-meta text-fg-2" data-statements-tone>
            {tone}
          </p>
        ) : null}
        <p className="t-meta" data-statements-footnote>
          {SENTIMENT_FOOTNOTE}
        </p>
      </div>
    </section>
  );
}
