"use client";

import { Briefcase, CircleDollarSign, Globe, Landmark, Megaphone, Plane, Vote, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EntityRow, IconRing, Panel, cx } from "@/components/ui";
import { dashboard } from "@/data/dashboard";
import { fadeRiseStyle } from "@/lib/motion";
import { fullDate, shortDate } from "./format";
import { exploreEntityHref } from "./links";
import { ListDialog, ViewAllLink } from "./ListDialog";
import { ago, useLive, useNow, type LiveKind, type LiveRow } from "./live";
import styles from "./live.module.css";
import { Reveal } from "./HomeGate";
import { StatementRow } from "@/features/feeds/StatementRow";
import { statementsFor } from "@/features/feeds/store";
import type { PublicStatement } from "@/features/feeds/data";
import { useFitCount } from "./useFitCount";

const ICON: Record<LiveKind, LucideIcon> = {
  vote: Vote,
  travel: Plane,
  hearing: Landmark,
  statement: Megaphone,
  filing: CircleDollarSign,
  lobbying: Briefcase,
  foreign: Globe,
};

const KIND_LABEL: Record<string, string> = { vote: "Vote", travel: "Travel", hearing: "Hearing", statement: "Statement" };

/** The fixture rows, in the same shape as the rows that arrive live. */
const BASE_ROWS: LiveRow[] = dashboard.activity.map((a) => ({
  id: a.id,
  date: a.date,
  kind: a.kind,
  kindLabel: KIND_LABEL[a.kind] ?? a.kind,
  title: a.title,
  description: a.description,
  entityId: a.entityId,
  sourceId: a.sourceId,
}));

/** The most rows the panel can hold at the largest size (the fit count never exceeds it). */
const MAX_ROWS = 12;

/** The panel shows at most this many public statements, so the records lead. "View all" shows every one, by date. */
const PANEL_STATEMENTS_MAX = 2;

/** Every public statement, newest first. */
const STATEMENT_ITEMS = statementsFor();

/** A feed entry: a public record, or a public statement (never a source). */
type FeedItem = { type: "record"; row: LiveRow } | { type: "statement"; post: PublicStatement };

/** Live arrivals stay on top. Below them, statements slot in by date among the fixture records (a statement on the same day sorts first). */
function interleave(arrivals: LiveRow[], base: LiveRow[], posts: PublicStatement[]): FeedItem[] {
  const out: FeedItem[] = arrivals.map((row) => ({ type: "record", row }));
  let p = 0;
  for (const row of base) {
    while (p < posts.length && posts[p].date >= row.date.slice(0, 10)) out.push({ type: "statement", post: posts[p++] });
    out.push({ type: "record", row });
  }
  while (p < posts.length) out.push({ type: "statement", post: posts[p++] });
  return out;
}

/** The panel's top slot is always a public record: statements that sort above it move just below it. */
function recordFirst(items: FeedItem[]): FeedItem[] {
  const first = items.findIndex((i) => i.type === "record");
  return first <= 0 ? items : [items[first], ...items.slice(0, first), ...items.slice(first + 1)];
}

function itemKey(item: FeedItem) {
  return item.type === "record" ? item.row.id : `statement-${item.post.id}`;
}

function ActivityItem({ row, index, arriving, now }: { row: LiveRow; index: number; arriving?: boolean; now: number }) {
  const router = useRouter();
  const live = row.arrivedAt !== undefined;
  // The presenter's fixed record keeps its tag (no 5s fade), so its steps look the same however they are reached.
  const tagged = arriving || !!row.forceArc;
  return (
    <li className={arriving ? styles.rowIn : undefined} style={arriving ? undefined : fadeRiseStyle(index)}>
      <EntityRow
        variant="plain"
        onClick={() => router.push(exploreEntityHref(row.entityId))}
        leading={<IconRing icon={ICON[row.kind]} />}
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px]">{row.title}</span>
            {tagged ? (
              <span
                className={cx(
                  !row.forceArc && styles.newTag,
                  "inline-flex h-[18px] shrink-0 items-center rounded-chip border border-[color-mix(in_srgb,var(--live)_50%,transparent)] px-1.5 text-[11px] leading-none font-semibold text-live",
                )}
              >
                New
              </span>
            ) : null}
          </span>
        }
        subtitle={
          <span className="t-meta text-fg-2">
            {live ? `${fullDate(row.date)} · ` : null}
            {row.description}
          </span>
        }
        meta={
          <span className="flex flex-col items-end gap-0.5">
            <span className={live ? "text-live" : "text-fg-2"}>{live ? ago(row.arrivedAt!, now) : shortDate(row.date)}</span>
            <span>{row.kindLabel}</span>
          </span>
        }
      />
    </li>
  );
}

/** 1.5 Activity feed: recent actions by tracked officials. New public records arrive live at the top. */
export function ActivityFeed({ className }: { className?: string }) {
  const arrivals = useLive((s) => s.arrivals);
  const now = useNow();
  const items = useMemo(() => recordFirst(interleave(arrivals, BASE_ROWS, STATEMENT_ITEMS.slice(0, PANEL_STATEMENTS_MAX))), [arrivals]);
  const allItems = useMemo(() => interleave(arrivals, BASE_ROWS, STATEMENT_ITEMS), [arrivals]);
  // Show only the rows that fit fully: no row is ever cut at the panel bottom.
  const { boxRef, listRef, count } = useFitCount<HTMLDivElement, HTMLUListElement>(MAX_ROWS, 2);
  const [showAll, setShowAll] = useState(false);
  const shown = Math.min(count, items.length);
  return (
    <Panel
      data-tour="activity"
      title="Activity"
      className={className}
      action={<ViewAllLink count={arrivals.length + BASE_ROWS.length} noun="activity records" onClick={() => setShowAll(true)} />}
      bodyClassName="-mx-2 overflow-hidden px-2"
    >
      <Reveal shape="list" className="h-full">
      <div ref={boxRef} className="h-full">
        <ul ref={listRef} className="flex flex-col gap-0.5" aria-live="polite">
          {items.slice(0, shown).map((item, i) =>
            item.type === "statement" ? (
              <li key={itemKey(item)} style={fadeRiseStyle(i)}>
                <StatementRow statement={item.post} />
              </li>
            ) : (
              // A `silent` record is put in place by a presenter step state: no arrival motion.
              <ActivityItem key={item.row.id} row={item.row} index={i} arriving={item.row.arrivedAt !== undefined && !item.row.silent} now={now} />
            ),
          )}
        </ul>
      </div>
      </Reveal>
      {showAll ? (
        <ListDialog title="Activity Feed" onClose={() => setShowAll(false)}>
          <ul className="-mx-2 flex flex-col gap-0.5">
            {allItems.map((item, i) =>
              item.type === "statement" ? (
                <li key={itemKey(item)} style={fadeRiseStyle(i)}>
                  <StatementRow statement={item.post} />
                </li>
              ) : (
                <ActivityItem key={item.row.id} row={item.row} index={i} now={now} />
              ),
            )}
          </ul>
        </ListDialog>
      ) : null}
    </Panel>
  );
}
