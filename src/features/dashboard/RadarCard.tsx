"use client";

import { ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";
import { dashboard } from "@/data/dashboard";
import { useReducedMotion } from "@/lib/motion";
import { splitChange } from "./format";
import { exploreEntityHref } from "./links";
import { useLive } from "./live";
import { useHome } from "./homeStore";
import { Reveal } from "./HomeGate";
import { SeatChart } from "./SeatChart";
import { TrendChart } from "./TrendChart";
import { TRENDS } from "./trend";
import type { LiveRow } from "./live";

const TOPICS = dashboard.radar;

/** "12 new · 47 legislators active" from the topic description, or the description itself. */
function subline(description: string): { fresh?: string; text: string } {
  const m = description.match(/(\d+ legislators active)\.?\s*(\d+ new)/);
  return m ? { fresh: m[2], text: m[1] } : { text: description.replace(/\.$/, "") };
}

/** A figure that counts up and flashes teal when a record arrives (no animation under reduced motion). */
function CountUp({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (from.current === value) return;
    if (reduced) {
      from.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(value);
      return;
    }
    el.current?.animate([{ color: "var(--teal-bright)" }, { color: "var(--text-1)" }], { duration: 900, easing: "ease-out" });
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return (
    <span ref={el} className={className}>
      {shown.toLocaleString("en-US")}
    </span>
  );
}

function SmallButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-chip text-fg-3 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1"
    >
      {children}
    </button>
  );
}

interface Kpi {
  id: string;
  label: string;
  value: number;
  delta?: string;
  caption: string;
}

/**
 * The three KPIs for each Radar topic. Ukraine uses the dashboard KPIs (with their deltas);
 * the other topics use their Radar counters. One figure per topic counts up with the live replay.
 */
function topicKpis(index: number, bumps: number, arrivals: LiveRow[]): Kpi[] {
  if (index === 0) {
    return dashboard.kpis.map((k) => {
      const { delta, caption } = splitChange(k.change);
      const extra = k.id === "new-activity" ? bumps : 0;
      const d = Number(delta.replace(/[^\d-]/g, ""));
      return {
        id: k.id,
        label: k.label,
        value: k.value + extra,
        delta: extra && Number.isFinite(d) ? `+${d + extra}` : delta,
        caption: caption ?? "",
      };
    });
  }
  const c = TOPICS[index].counters;
  const fec = arrivals.filter((r) => r.sourceId?.startsWith("fec")).length;
  const travel = arrivals.filter((r) => r.kind === "travel").length;
  if (index === 1) {
    return [
      { id: "orgs", label: "Organizations", value: c.organizations, caption: "On record" },
      { id: "donations", label: "Donations", value: c.donations + fec, caption: fec ? `+${fec} since you opened Home` : "On record" },
      { id: "members", label: "Members", value: c.members, caption: "Active on the topic" },
    ];
  }
  return [
    { id: "travels", label: "Travels", value: c.travels + travel, caption: travel ? `+${travel} since you opened Home` : "On record" },
    { id: "members", label: "Members", value: c.members, caption: "Active on the topic" },
    { id: "orgs", label: "Organizations", value: c.organizations, caption: "On record" },
  ];
}

type Chart = "trend" | "vote";
const CHARTS: { id: Chart; label: string }[] = [
  { id: "vote", label: "Senate vote" },
  { id: "trend", label: "Trend" },
];

/**
 * Row 2, left: the Radar card (1.4) with the KPIs (1.2), the 30-day record trend,
 * and the seat chart of the tracked bills (on the "Senate vote" tab).
 */
export function RadarCard({ className }: { className?: string }) {
  const index = useHome((s) => s.topic);
  const setTopic = useHome((s) => s.setTopic);
  // The map follows the chart: "Senate vote" shows the United States, "Trend" the world.
  const chart = useHome((s) => s.radarTab);
  const setRadarTab = useHome((s) => s.setRadarTab);
  // The vote tab applies to the topics tied to S. 456 and H.R. 123; Allied Security shows the trend only.
  const hasVote = index === 0;
  const shown: Chart = hasVote ? chart : "trend";
  const trend = TRENDS[index] ?? TRENDS[0];
  const arrivals = useLive((s) => s.arrivals);
  const bumps = useLive((s) => s.bumps);
  const kpis = topicKpis(index, bumps, arrivals);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const topic = TOPICS[index];
  const { fresh, text } = subline(topic.description);
  const step = (d: number) => setTopic((index + d + TOPICS.length) % TOPICS.length);

  const choose = (c: Chart) => {
    if (c === shown) return;
    setRadarTab(c);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (i + 1) % CHARTS.length;
    choose(CHARTS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section data-tour="radar" aria-label="Radar" className={cx("flex min-h-0 min-w-0 flex-col rounded-panel border border-line bg-surface-1 p-6", className)}>
      <Reveal shape="radar" className="min-h-0 flex-1">
      <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <span className="t-meta mr-1 tabular-nums">
            Radar · {index + 1} / {TOPICS.length}
          </span>
          <SmallButton label="Previous topic" onClick={() => step(-1)}>
            <ChevronLeft size={16} strokeWidth={1.5} />
          </SmallButton>
          <SmallButton label="Next topic" onClick={() => step(1)}>
            <ChevronRight size={16} strokeWidth={1.5} />
          </SmallButton>
        </div>
        <div role="tablist" aria-label="Chart" className="flex gap-0.5">
          {CHARTS.filter((c) => hasVote || c.id === "trend").map((c, i) => {
            const on = c.id === shown;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => choose(c.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={cx(
                  "h-7 rounded-chip px-2.5 text-[13px] leading-none font-semibold transition-colors duration-[120ms]",
                  on ? "bg-surface-2 text-fg-1" : "text-fg-3 hover:text-fg-2",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </header>

      <Link href={exploreEntityHref(topic.entityId)} className="mt-3 block min-w-0 shrink-0">
        <h2 className="truncate font-display text-[40px] leading-[46px] font-bold text-fg-1 transition-colors duration-[120ms] hover:text-teal-bright">
          {topic.title}
        </h2>
      </Link>
      <p className="mt-1 shrink-0 truncate text-[17px] leading-6 text-fg-2">
        {fresh ? <span className="text-teal-bright">{fresh}</span> : null}
        {fresh ? " · " : null}
        {text}
      </p>

      <div className="mt-5 grid shrink-0 grid-cols-3">
        {kpis.map((k, i) => (
          <div key={k.id} className={cx("flex min-w-0 flex-col", i > 0 && "border-l border-line pl-5")}>
            <CountUp value={k.value} className="font-display text-[36px] leading-[42px] font-bold tabular-nums text-fg-1" />
            <span className="t-body truncate text-fg-2">{k.label}</span>
            <span className="t-meta mt-0.5 flex items-center gap-1 truncate">
              {k.delta ? (
                <>
                  <ArrowUp size={13} strokeWidth={2} className="shrink-0 text-up" aria-hidden="true" />
                  <span className="font-semibold text-up">{k.delta}</span> {k.caption}
                </>
              ) : (
                k.caption
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-hidden border-t border-line pt-4">
        {shown === "trend" ? (
          <div className="flex h-full min-h-0 flex-col gap-2" role="tabpanel" aria-label="Trend">
            <div className="flex items-baseline justify-between gap-3">
              <span className="t-body text-fg-2">{trend.label}</span>
              <span className="t-meta">+{trend.added} records</span>
            </div>
            <TrendChart key={index} trend={trend} className="flex-1" />
          </div>
        ) : (
          <SeatChart className="h-full" />
        )}
      </div>
      </div>
      </Reveal>
    </section>
  );
}
