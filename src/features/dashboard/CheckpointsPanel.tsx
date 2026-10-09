"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { dashboard } from "@/data/dashboard";
import { describeCheckpoint, listSavedCheckpoints, type Checkpoint as SavedCheckpoint } from "@/lib/checkpoints";
import { fadeRiseStyle } from "@/lib/motion";
import { ListDialog, ViewAllLink } from "./ListDialog";
import { fixtureCheckpointHref, savedCheckpointHref } from "./links";
import { Reveal } from "./HomeGate";
import { useFitCount } from "./useFitCount";

interface Row {
  id: string;
  title: string;
  meta: string;
  central: string;
  counts: string;
  href: string;
  saved: boolean;
}

/** "Central: Ukraine. 12 members, 3 bills, 1 org, 43 travels" into its two parts. */
function splitSummary(summary: string): { central: string; counts: string } {
  const m = summary.match(/^(?:Central:\s*)?(.*?)\.\s+(\d+ members?\b.*)$/);
  if (!m) return { central: summary, counts: "" };
  return { central: m[1], counts: m[2].replace(/, /g, " · ") };
}

function savedTime(iso: string): string {
  const d = new Date(iso);
  return `Saved ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

const FIXTURE_ROWS: Row[] = dashboard.checkpoints.map((c) => ({
  id: c.id,
  title: c.title,
  meta: "",
  ...splitSummary(c.summary),
  href: fixtureCheckpointHref(c.id, c.entityId),
  saved: false,
}));

function savedRow(c: SavedCheckpoint): Row {
  return {
    id: c.id,
    title: c.title,
    meta: savedTime(c.createdAt),
    ...splitSummary(describeCheckpoint(c)),
    href: savedCheckpointHref(c.id),
    saved: true,
  };
}

function CheckpointCard({ row, index, onLoad }: { row: Row; index: number; onLoad: (href: string) => void }) {
  return (
    <li
      // The newest checkpoint (first in the list) is a presenter-mode anchor.
      data-tour={index === 0 ? "checkpoint-latest" : undefined}
      style={fadeRiseStyle(index)}
      className="flex min-w-0 flex-col gap-0.5 rounded-card border border-line bg-surface-2 py-1 pr-1 pl-4"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="t-card-title truncate">{row.title}</span>
        {row.meta ? <span className="t-meta shrink-0 text-teal-bright">{row.meta}</span> : null}
        <button
          type="button"
          onClick={() => onLoad(row.href)}
          aria-label={`Load checkpoint: ${row.title}`}
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-button border border-line bg-surface-1 px-2.5 text-[13px] leading-none font-semibold text-fg-1 transition-[background-color,border-color] duration-[120ms] hover:border-line-strong hover:bg-surface-3"
        >
          <Play size={14} strokeWidth={1.5} aria-hidden="true" />
          Load
        </button>
      </div>
      <div className="t-meta truncate pr-2 pb-1">
        <span className="text-fg-2">{row.central}</span>
        {row.counts ? <> · {row.counts}</> : null}
      </div>
    </li>
  );
}

const GAP = 8;
const HINT_H = 28;

/**
 * 1.7 Checkpoints: saved explorations. The user's saves come first (newest first),
 * then the fixtures. Only the cards that fit fully show; "View all" lists the rest.
 */
export function CheckpointsPanel({ className }: { className?: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Row[]>([]);
  const [showAll, setShowAll] = useState(false);

  // localStorage is read after mount so the server and client markup match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(listSavedCheckpoints().map(savedRow));
  }, []);

  const rows = [...saved, ...FIXTURE_ROWS];
  const { boxRef, listRef, count } = useFitCount<HTMLDivElement, HTMLUListElement>(rows.length, GAP);
  const hidden = rows.length - count;
  const load = (href: string) => router.push(href);

  // The hint shows only when it fits under the cards.
  const [hintFits, setHintFits] = useState(false);
  useEffect(() => {
    const box = boxRef.current;
    const list = listRef.current;
    if (!box || !list) return;
    const check = () => setHintFits(hidden === 0 && box.clientHeight - list.offsetHeight >= HINT_H + 12);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(box);
    return () => ro.disconnect();
  }, [boxRef, listRef, hidden, count]);

  return (
    <Panel
      data-tour="checkpoints"
      title="Checkpoints"
      className={className}
      action={<ViewAllLink count={rows.length} noun="checkpoints" onClick={() => setShowAll(true)} />}
      bodyClassName="overflow-hidden"
    >
      <Reveal shape="list" className="h-full">
      <div ref={boxRef} className="h-full">
        <ul ref={listRef} className="flex flex-col" style={{ gap: GAP }}>
          {rows.slice(0, count).map((r, i) => (
            <CheckpointCard key={r.id} row={r} index={i} onLoad={load} />
          ))}
        </ul>
        {hintFits ? (
          <p className="t-meta mt-3 px-1">Save a view in Explore with the bookmark icon to add it here.</p>
        ) : null}
      </div>
      </Reveal>
      {showAll ? <AllCheckpoints rows={rows} onLoad={load} onClose={() => setShowAll(false)} /> : null}
    </Panel>
  );
}

function AllCheckpoints({ rows, onLoad, onClose }: { rows: Row[]; onLoad: (href: string) => void; onClose: () => void }) {
  return (
    <ListDialog title="All Checkpoints" onClose={onClose}>
      <ul className="flex flex-col" style={{ gap: GAP }}>
        {rows.map((r, i) => (
          <CheckpointCard key={r.id} row={r} index={i} onLoad={onLoad} />
        ))}
      </ul>
    </ListDialog>
  );
}
