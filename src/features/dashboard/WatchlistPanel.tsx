"use client";

import { ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, EntityRow, IconRing, Panel, cx } from "@/components/ui";
import { dashboard, type WatchlistEntry } from "@/data/dashboard";
import { entities } from "@/data/entities";
import { fadeRiseStyle } from "@/lib/motion";
import { exploreEntityHref } from "./links";
import { ListDialog, ViewAllLink } from "./ListDialog";
import { Reveal } from "./HomeGate";
import { useFitCount } from "./useFitCount";

const byId = new Map(entities.map((e) => [e.id, e]));

function splitBill(label: string): { number: string; title?: string } {
  const [number, ...rest] = label.split(/\s+·\s+/);
  return { number, title: rest.join(" · ") || undefined };
}

function WatchRow({ entry, index }: { entry: WatchlistEntry; index: number }) {
  const router = useRouter();
  const entity = byId.get(entry.entityId);
  const isPerson = entry.kind === "person";
  const bill = isPerson ? null : splitBill(entry.label);
  return (
    <EntityRow
      variant="plain"
      style={fadeRiseStyle(index)}
      className="-mx-2 w-[calc(100%+16px)]"
      leading={
        isPerson ? (
          <Avatar initials={entity?.initials ?? entry.label.slice(0, 2)} title={entry.label} />
        ) : (
          <IconRing icon={ScrollText} />
        )
      }
      title={isPerson ? entry.label : bill!.number}
      subtitle={
        <span className="t-meta text-fg-2">
          {isPerson ? entry.note : [bill!.title, entry.note].filter(Boolean).join(" · ")}
        </span>
      }
      trailing={
        <Button size="sm" onClick={() => router.push(exploreEntityHref(entry.entityId))}>
          Explore
        </Button>
      }
    />
  );
}

/** 1.3 Watchlist: tracked officials, then tracked legislation. Each one opens in Exploration Mode. */
export function WatchlistPanel({ className }: { className?: string }) {
  const people = dashboard.watchlist.filter((w) => w.kind === "person");
  const bills = dashboard.watchlist.filter((w) => w.kind === "bill");
  const rows = [...people, ...bills];
  // Show only the rows that fit fully.
  const { boxRef, listRef, count } = useFitCount<HTMLDivElement, HTMLDivElement>(rows.length, 0);
  const [showAll, setShowAll] = useState(false);
  return (
    <Panel
      data-tour="watchlist"
      id="watchlist"
      title="Watchlist"
      action={<ViewAllLink count={rows.length} noun="watchlist entries" onClick={() => setShowAll(true)} />}
      className={cx("scroll-mt-4", className)}
      bodyClassName="overflow-hidden"
    >
      <Reveal shape="list" className="h-full">
      <div ref={boxRef} className="h-full">
        <div ref={listRef} className="flex flex-col">
          {rows.slice(0, count).map((w, i) => (
            <WatchRow key={w.id} entry={w} index={i} />
          ))}
        </div>
      </div>
      </Reveal>
      {showAll ? (
        <ListDialog title="Watchlist" onClose={() => setShowAll(false)}>
          <div className="flex flex-col">
            {rows.map((w, i) => (
              <WatchRow key={w.id} entry={w} index={i} />
            ))}
          </div>
        </ListDialog>
      ) : null}
    </Panel>
  );
}
