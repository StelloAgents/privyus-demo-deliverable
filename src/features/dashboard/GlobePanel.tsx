"use client";

import { ArrowUpRight, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LiveChip, cx } from "@/components/ui";
import { stateByCode } from "@/data/geo";
import { houseStateVotes } from "@/data/votes";
import { prefersReducedMotion, useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { fullDate } from "./format";
import type { GlobeHover, GlobeMarker } from "./GlobeScene";
import { FARA_ARCS, placesFor, type GlobeArc } from "./globe-data";
import { ROLL_INDEX, TOPIC_KIND, useHome, type MapDetail, type MapView } from "./homeStore";
import { dashboard } from "@/data/dashboard";
import { MONEY_US_ARCS, RECENT_US_ARCS, sourceById, usArcFor, type UsArc } from "./usLinks";
import { NETWORK_MAP_HREF, exploreEntityHref } from "./links";
import { useLive } from "./live";
import gateStyles from "./gate.module.css";
import { MapSkeleton } from "./HomeGate";
import liveStyles from "./live.module.css";
import { emit } from "@/lib/events";
import { usePageReady } from "@/lib/page-ready";
import { seatPaint } from "./SeatChart";
import { HOUSE_SEATS, PARTY_NAME, SENATE_SEATS, VOTES, VOTE_NAME, memberLabel, shortVoteLabel, tally, type ChamberSeat, type Party } from "./votes";

/** WebGL runs in the browser only, and loads after first paint. The placeholder is the bare panel surface. */
/** The globe chunk starts loading with this module, in parallel with the page. */
const loadGlobe = () => import("./GlobeScene");
if (typeof window !== "undefined") void loadGlobe();
const GlobeScene = dynamic(loadGlobe, {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-surface-1" aria-hidden="true" />,
});

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/** The cropped edges fade into the panel, so the crop reads as intended. */
const EDGE_FADE: React.CSSProperties = {
  maskImage: "linear-gradient(to bottom, #000 72%, transparent 100%), linear-gradient(to right, #000 88%, transparent 100%)",
  maskComposite: "intersect",
  WebkitMaskImage: "linear-gradient(to bottom, #000 72%, transparent 100%), linear-gradient(to right, #000 88%, transparent 100%)",
  WebkitMaskComposite: "source-in",
};

const PARTY_COLOR: Record<Party, string> = { R: "var(--party-r)", D: "var(--party-d)", I: "var(--party-i)" };
const NO_ARCS: GlobeArc[] = [];
const amountOf = (l: string) => Number(l.match(/\$([\d,]+)/)?.[1]?.replace(/,/g, "") ?? 0);
/** The five largest money flows: shown by default; the rest show on hover. */
const TOP_MONEY = new Set(
  [...MONEY_US_ARCS].sort((a, b) => amountOf(b.label) - amountOf(a.label)).slice(0, 5).map((a) => a.id),
);
const NO_US_ARCS: UsArc[] = [];
const RADAR_TITLES = dashboard.radar.map((r) => r.title);
const VIEWS: { id: MapView; label: string }[] = [
  { id: "world", label: "World" },
  { id: "us", label: "United States" },
];

function PartyChip({ party }: { party: Party }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[11px] leading-none font-bold text-white"
      style={{ background: PARTY_COLOR[party] }}
      title={PARTY_NAME[party]}
    >
      {party}
    </span>
  );
}

/** One Senate seat on the map: solid = yes, ring = no, faint dashed ring = not voting. */
function useRollAndPulse(rollKey: string, code: string) {
  const filled = useHome((s) => s.rollFilled >= s.rollTotal || (ROLL_INDEX[rollKey] ?? 0) < s.rollFilled);
  const pulse = useHome((s) => (s.pulse?.code === code ? s.pulse.key : 0));
  return { filled, pulse };
}

function Pulse({ k }: { k: number }) {
  return k ? <span key={k} className={liveStyles.statePulse} aria-hidden="true" /> : null;
}

function SeatDot({ seat, dim, hot }: { seat: ChamberSeat; dim: boolean; hot: boolean }) {
  const { filled, pulse } = useRollAndPulse(`s:${seat.id}`, seat.state);
  // Roll call: an empty outline until the state is called.
  const p = filled ? seatPaint(seat.party, seat.vote) : { fill: "none", stroke: "var(--text-3)", strokeOpacity: 0.45, dash: undefined };
  const d = seat.memberId ? 13 : 10;
  const light = useTheme() === "light";
  return (
    <span className="relative block">
    <Pulse k={pulse} />
    <svg width={d + 6} height={d + 6} aria-hidden="true" className="block" style={{ opacity: dim ? 0.2 : 1, transition: "opacity 120ms" }}>
      <circle
        cx={(d + 6) / 2}
        cy={(d + 6) / 2}
        r={p.fill === "none" ? d / 2 - 1 : d / 2}
        fill={p.fill === "none" ? "var(--surface-1)" : p.fill}
        fillOpacity={p.fill === "none" ? 0.6 : 1}
        stroke={p.fill === "none" ? p.stroke : "var(--surface-1)"}
        strokeWidth={p.fill === "none" ? (light ? 1.4 : 1.8) : 1}
        strokeOpacity={p.strokeOpacity}
        strokeDasharray={p.dash ? "2 2" : undefined}
      />
      {seat.sponsor ? <circle cx={(d + 6) / 2} cy={(d + 6) / 2} r={d / 2 + 2.2} fill="none" stroke="var(--text-1)" strokeWidth={1.3} /> : null}
      {hot ? <circle cx={(d + 6) / 2} cy={(d + 6) / 2} r={d / 2 + 2.2} fill="none" stroke="var(--text-1)" strokeOpacity={0.5} strokeWidth={1} /> : null}
    </svg>
    </span>
  );
}

/** One state in the House view: sized by seats, with a ring split by party and vote. */
function HouseDot({ code, dim, hot }: { code: string; dim: boolean; hot: boolean }) {
  const st = houseStateVotes.find((h) => h.state === code)!;
  const { filled, pulse } = useRollAndPulse(`h:${code}`, code);
  const d = Math.round(9 + Math.sqrt(st.seats) * 2.6);
  const r = d / 2 - 2;
  const C = 2 * Math.PI * r;
  const parts: { n: number; color: string; op: number }[] = [
    { n: st.byParty.D.yes, color: PARTY_COLOR.D, op: 1 },
    { n: st.byParty.D.no, color: PARTY_COLOR.D, op: 0.35 },
    { n: st.byParty.D.nv + st.byParty.R.nv, color: "var(--text-3)", op: 0.6 },
    { n: st.byParty.R.no, color: PARTY_COLOR.R, op: 0.35 },
    { n: st.byParty.R.yes, color: PARTY_COLOR.R, op: 1 },
  ];
  let offset = 0;
  if (!filled) {
    return (
      <svg width={d} height={d} aria-hidden="true" className="block">
        <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke="var(--text-3)" strokeOpacity={0.45} strokeWidth={1.2} />
      </svg>
    );
  }
  return (
    <span className="relative block">
    <Pulse k={pulse} />
    <svg width={d} height={d} aria-hidden="true" className="block" style={{ opacity: dim ? 0.2 : 1, transition: "opacity 120ms" }}>
      <circle cx={d / 2} cy={d / 2} r={r} fill="var(--surface-1)" fillOpacity={0.7} />
      <g transform={`rotate(-90 ${d / 2} ${d / 2})`}>
        {parts.map((p, i) => {
          const len = (p.n / st.seats) * C;
          const el = (
            <circle
              key={i}
              cx={d / 2}
              cy={d / 2}
              r={r}
              fill="none"
              stroke={p.color}
              strokeOpacity={p.op}
              strokeWidth={3}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </g>
      {hot ? <circle cx={d / 2} cy={d / 2} r={d / 2 - 0.5} fill="none" stroke="var(--text-1)" strokeWidth={1} /> : null}
    </svg>
    </span>
  );
}

/** Hover text for a state on the US map: money flows into it, or its vote. */
function stateHoverText(code: string, chamber: "senate" | "house", kind: string): string {
  if (kind === "money") {
    const flows = MONEY_US_ARCS.filter((a) => a.to === code).map((a) => a.label);
    const name = stateByCode[code]?.name ?? code;
    return flows.length ? `${name}\n${flows.join("\n")}` : `${name} · No contractor flows on record`;
  }
  return stateSummary(code, chamber);
}

function stateSummary(code: string, chamber: "senate" | "house"): string {
  const name = stateByCode[code]?.name ?? code;
  if (chamber === "house") {
    const st = houseStateVotes.find((h) => h.state === code);
    if (!st) return name;
    const yes = st.byParty.R.yes + st.byParty.D.yes;
    const no = st.byParty.R.no + st.byParty.D.no;
    return `${name} · ${st.seats} seats · ${yes} yes, ${no} no`;
  }
  const seats = SENATE_SEATS.filter((s) => s.state === code);
  return `${name} · ${seats.map((s) => `${s.party} ${VOTE_NAME[s.vote].toLowerCase()}`).join(", ")}`;
}

/** The detail card for a clicked state or arc. It sits away from the clicked point. */
function DetailCard({ detail, arcs, width, onClose }: { detail: MapDetail; arcs: GlobeArc[]; width: number; onClose: () => void }) {
  const chamber = useHome((s) => s.chamber);
  const vote = VOTES.find((v) => v.chamber === chamber) ?? VOTES[0];
  // Docked top-right, below the header: it never covers the legend.
  void width;
  return (
    <div
      role="dialog"
      aria-label="Details"
      className={cx(
        "absolute z-30 w-[340px] rounded-panel border border-line-strong bg-surface-2 p-4",
        "top-[68px] right-5 max-h-[calc(100%-140px)] overflow-y-auto",
      )}
      style={{ animation: "privy-fade-rise 180ms cubic-bezier(0.22,1,0.36,1) both" }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-3 right-3 rounded-[4px] p-1 text-fg-3 transition-colors duration-[120ms] hover:bg-surface-3 hover:text-fg-1"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
      {detail.kind === "state" ? (
        <StateDetail code={detail.code} chamber={chamber} voteLabel={`${shortVoteLabel(vote.voteLabel)} · ${fullDate(vote.date)}`} />
      ) : (
        <ArcDetail arcs={arcs.filter((a) => detail.arcIds.includes(a.id))} />
      )}
    </div>
  );
}

function StateDetail({ code, chamber, voteLabel }: { code: string; chamber: "senate" | "house"; voteLabel: string }) {
  const name = stateByCode[code]?.name ?? code;
  return (
    <div className="flex flex-col gap-3 pr-6">
      <div>
        <h3 className="t-card-title">{name}</h3>
        <p className="t-meta">{voteLabel}</p>
      </div>
      {chamber === "senate" ? (
        <ul className="flex flex-col gap-2">
          {SENATE_SEATS.filter((s) => s.state === code).map((s) => (
            <li key={s.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <PartyChip party={s.party} />
              <span className="min-w-0 flex-1 text-[13px] leading-4 text-fg-1">
                {s.memberId ? memberLabel(s.memberId) : `Sen. (${s.party}-${s.state})`}
                {s.sponsor ? <span className="text-fg-3"> · Sponsor</span> : null}
              </span>
              <span className="t-meta shrink-0 text-fg-2">{VOTE_NAME[s.vote]}</span>
              {s.memberId ? (
                <Link href={exploreEntityHref(s.memberId)} className="t-meta shrink-0 text-teal-bright hover:text-fg-1">
                  Open in Explore
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <HouseStateRows code={code} />
      )}
    </div>
  );
}

function HouseStateRows({ code }: { code: string }) {
  const st = houseStateVotes.find((h) => h.state === code);
  if (!st) return null;
  return (
    <ul className="flex flex-col gap-2">
      <li className="t-meta">{st.seats} seats</li>
      {(["D", "R"] as const)
        .filter((p) => st.byParty[p].yes + st.byParty[p].no + st.byParty[p].nv > 0)
        .map((p) => (
          <li key={p} className="flex items-center gap-2">
            <PartyChip party={p} />
            <span className="text-[13px] leading-4 text-fg-1">{PARTY_NAME[p]}s</span>
            <span className="t-meta ml-auto text-fg-2 tabular-nums">
              {st.byParty[p].yes} yes · {st.byParty[p].no} no
              {st.byParty[p].nv ? ` · ${st.byParty[p].nv} not voting` : ""}
            </span>
          </li>
        ))}
    </ul>
  );
}

function ArcDetail({ arcs }: { arcs: GlobeArc[] }) {
  const rows = [...arcs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ul className="flex flex-col gap-3 pr-6">
      {rows.map((a) => (
        <li key={a.id} className="flex flex-col gap-0.5">
          <span className="t-card-title">{a.row.personLabel}</span>
          <span className="text-[13px] leading-4 text-fg-2">
            {a.from === "Washington" ? `To ${a.to}` : `${a.from} to Washington`} · {fullDate(a.date)}
          </span>
          <span className="t-meta">{a.row.sourceTitle}</span>
          <Link href={a.row.personId ? exploreEntityHref(a.row.personId) : a.href} className="t-meta mt-1 text-teal-bright hover:text-fg-1">
            Open in Explore
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Row 2, right: the network map (1.6). "World" shows arcs from Washington to every travel and
 * foreign-delegation record (the newest is orange). "United States" flies to the US and shows
 * how each state voted on the tracked bill, by party. Click a state or an arc for details.
 */
export function GlobePanel({ className }: { className?: string }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const arcs = useLive((s) => s.arcs);
  const arrived = useLive((s) => s.cursor);
  const view = useHome((s) => s.mapView);
  const setView = useHome((s) => s.setMapView);
  const chamber = useHome((s) => s.chamber);
  const hoverState = useHome((s) => s.hoverState);
  const setHoverState = useHome((s) => s.setHoverState);
  const detail = useHome((s) => s.detail);
  const setDetail = useHome((s) => s.setDetail);
  const [hover, setHover] = useState<GlobeHover | null>(null);
  const mapHover = useHome((s) => s.mapHover);
  const setMapHover = useHome((s) => s.setMapHover);
  const startRollCall = useHome((s) => s.startRollCall);
  const ready = useHome((s) => s.ready);
  const setGlobeReady = useHome((s) => s.setGlobeReady);
  // The globe drew its first frame in this mount (the scene is rebuilt each time Home opens).
  const [drawn, setDrawn] = useState(false);
  const pulseState = useHome((s) => s.pulseState);
  const rollFilled = useHome((s) => s.rollFilled);
  const rollTotal = useHome((s) => s.rollTotal);
  const arrivals = useLive((s) => s.arrivals);
  // Home has fully drawn (skeleton gone, globe drawn in this mount): the route curtain may lift.
  const revealed = useHome((s) => s.revealed);
  usePageReady("/", revealed && drawn);

  // The roll call plays when Home opens on the United States view.

  // Live connections: a new record with an origin and a destination draws an arc for about 6s;
  // a record that names only a state pulses that state's points once.
  const [liveArcs, setLiveArcs] = useState<UsArc[]>([]);
  // A record that arrived before this mount (Home opened again) does not draw its arc again.
  const lastArrival = useRef<string | null>(useLive.getState().arrivals[0]?.id ?? null);
  // A live arc belongs to its record and its topic: it goes when the record is
  // removed (presenter mode) or the topic changes, so a later step never shows it.
  const topicNow = useHome((s) => s.topic);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveArcs([]);
  }, [topicNow]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveArcs((list) => {
      const kept = list.filter((a) => arrivals.some((r) => a.id.endsWith(`-${r.id}`)));
      return kept.length === list.length ? list : kept;
    });
  }, [arrivals]);
  useEffect(() => {
    const row = arrivals[0];
    if (!row || row.id === lastArrival.current) return;
    lastArrival.current = row.id;
    if (row.silent) return;
    const src = sourceById(row.sourceId);
    if (!src?.geo) return;
    // In the Ukraine vote view, a record only pulses the member's state (arcs would read as votes).
    const voteView = TOPIC_KIND[useHome.getState().topic] === "vote" && useHome.getState().mapView === "us";
    if (voteView && !row.forceArc) {
      if (src.geo.to) pulseState(src.geo.to);
      return;
    }
    const base = src.geo.from && src.geo.to && src.geo.from !== src.geo.to ? usArcFor(src, false, row.id) : null;
    const arc = base && row.forceArc ? { ...base, forced: true } : base;
    if (arc) {
      // The arc has drawn once its transition ends (presenter mode waits for this).
      window.setTimeout(() => emit("arc-drawn", row.id), prefersReducedMotion() ? 50 : 1300);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveArcs((list) => [...list, arc]);
      window.setTimeout(() => setLiveArcs((list) => list.filter((a) => a.id !== arc.id)), 6000);
    } else if (src.geo.to) {
      pulseState(src.geo.to);
      window.setTimeout(() => emit("arc-drawn", row.id), prefersReducedMotion() ? 50 : 1100);
    }
  }, [arrivals, pulseState]);
  // The Radar topic picks what the map shows.
  const topic = useHome((s) => s.topic);
  const kind = TOPIC_KIND[topic] ?? "vote";
  // Money: the five largest flows, plus every flow into the hovered state. Vote: no arcs.
  const usArcs = useMemo(() => {
    if (kind === "money") return MONEY_US_ARCS.filter((a) => TOP_MONEY.has(a.id) || a.to === hoverState);
    // Vote view: no arcs, except one that presenter mode draws on purpose.
    if (kind === "vote") return liveArcs.filter((a) => a.forced);
    return [...RECENT_US_ARCS, ...liveArcs];
  }, [kind, liveArcs, hoverState]);
  const worldArcs = useMemo(() => {
    if (kind !== "allies") return arcs;
    // Travel, delegation, and FARA records; the newest of them is the one orange arc.
    const all = [...arcs, ...FARA_ARCS];
    const newest = all.reduce((m, a) => (a.date > m ? a.date : m), "");
    return all.map((a) => ({ ...a, latest: a.date === newest }));
  }, [kind, arcs]);
  const boxRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(0);
  const cities = placesFor(arcs).filter((p) => p.name !== "Washington").length;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setDetail(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, setDetail]);

  const pointAt = (e: { clientX: number; clientY: number }) => {
    const box = boxRef.current?.getBoundingClientRect();
    return box ? { x: e.clientX - box.left, y: e.clientY - box.top } : { x: 0, y: 0 };
  };

  // The tooltip follows the pointer without a re-render per move.
  const onPointerMove = (e: React.PointerEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    const tip = tipRef.current;
    if (!box || !tip) return;
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const flip = x > box.width - 260;
    tip.style.transform = `translate(${flip ? x - 12 : x + 14}px, ${y + 14}px) translateX(${flip ? "-100%" : "0"})`;
  };

  /** One marker per Senate seat (two per state, side by side), or one per state for the House. */
  const markers: GlobeMarker[] = useMemo(() => {
    if (view !== "us") return [];
    const markerFor = (code: string, id: string, lat: number, lng: number, node: React.ReactNode, title: string): GlobeMarker => ({
      id,
      lat,
      lng,
      node: (
        <button
          type="button"
          aria-label={title}
          data-state={code}
          className="block cursor-pointer rounded-full transition-opacity duration-[120ms]"
          onPointerEnter={() => {
            setHoverState(code);
            setHover({ text: kind === "money" ? stateHoverText(code, chamber, kind) : title });
          }}
          onPointerLeave={() => {
            setHoverState(null);
            setHover(null);
          }}
          // The marker handles its own click; the map's empty-click handler must not see it.
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const p = pointAt(e);
            const cur = useHome.getState().detail;
            setDetail(cur?.kind === "state" && cur.code === code ? null : { kind: "state", code, x: p.x, y: p.y });
          }}
        >
          {node}
        </button>
      ),
    });
    if (chamber === "house") {
      return houseStateVotes.map((h) => {
        const g = stateByCode[h.state];
        return markerFor(h.state, `h-${h.state}`, g.lat, g.lng, <HouseDot code={h.state} dim={false} hot={false} />, stateSummary(h.state, "house"));
      });
    }
    return SENATE_SEATS.map((s, i) => {
      const g = stateByCode[s.state];
      const side = i % 2 === 0 ? -1 : 1;
      const title = `${s.memberId ? memberLabel(s.memberId) : `Sen. (${s.party}-${s.state})`} · ${g.name} · ${VOTE_NAME[s.vote]}`;
      return markerFor(s.state, `s-${s.id}`, g.lat, g.lng + side * 0.75, <SeatDot seat={s} dim={false} hot={false} />, title);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, chamber, kind]);

  /** Labels at the end of the live connections; they fade with their arc. */
  const allMarkers: GlobeMarker[] = useMemo(() => {
    if (view !== "us") return markers;
    // Money flows: labels for the three largest contributions only, so they never pile up.
    if (kind === "money") {
      const amountOf = (l: string) => Number(l.match(/\$([\d,]+)/)?.[1]?.replace(/,/g, "") ?? 0);
      const best = new Map<string, UsArc>();
      for (const a of MONEY_US_ARCS) if (!best.has(a.to) || amountOf(a.label) > amountOf(best.get(a.to)!.label)) best.set(a.to, a);
      const top = [...best.values()].filter((a) => amountOf(a.label) > 0).sort((x, y) => amountOf(y.label) - amountOf(x.label)).slice(0, 3);
      const moneyLabels = top.map((a) => ({
        id: `lbl-${a.id}`,
        // Kept inside the panel; the other flows show on hover.
        clamp: true,
        lat: a.endLat,
        lng: a.endLng,
        node: (
          <span
            className="pointer-events-none block translate-y-[-18px] rounded-[4px] border border-line bg-surface-1 px-2 py-0.5 text-[12px] leading-4 font-medium whitespace-nowrap text-fg-1"
          >
            {a.label}
          </span>
        ),
      }));
      // Endpoint dots, so each flow reads as a full connection from origin to member.
      const dots = usArcs.flatMap((a) =>
        (["start", "end"] as const).map((end) => ({
          id: `dot-${a.id}-${end}`,
          lat: end === "start" ? a.startLat : a.endLat,
          lng: end === "start" ? a.startLng : a.endLng,
          node: (
            <span
              className="pointer-events-none block h-2 w-2 rounded-full border border-surface-1"
              style={{ background: a.tone === "money" ? "var(--teal-bright)" : "var(--text-2)" }}
            />
          ),
        })),
      );
      return [...markers, ...dots, ...moneyLabels];
    }
    const labels = liveArcs.map((a) => ({
      id: `lbl-${a.id}`,
      clamp: true,
      lat: a.endLat,
      lng: a.endLng,
      node: (
        <span
          className={cx(
            liveStyles.linkLabel,
            "pointer-events-none block translate-y-[-18px] rounded-[4px] border border-line bg-surface-1 px-2 py-0.5 text-[12px] leading-4 font-medium whitespace-nowrap text-fg-1",
          )}
        >
          {a.label}
        </span>
      ),
    }));
    return [...markers, ...labels];
  }, [markers, liveArcs, view, kind, usArcs]);

  const seatsNow = chamber === "senate" ? SENATE_SEATS : HOUSE_SEATS;
  const rollDone = rollFilled >= rollTotal;
  const running = useMemo(
    () =>
      tally(
        seatsNow.filter((s) => rollDone || (ROLL_INDEX[chamber === "senate" ? `s:${s.id}` : `h:${s.state}`] ?? 0) < rollFilled),
      ),
    [seatsNow, rollDone, rollFilled, chamber],
  );

  // Linked highlight: dim the markers of other states while one state is hovered (DOM only, no rebuild).
  useEffect(() => {
    const root = boxRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-state]").forEach((el) => {
      const on = !hoverState || el.dataset.state === hoverState;
      // In the money view the seats step back behind the flows.
      el.style.opacity = on ? (kind === "money" && !hoverState ? "0.3" : "1") : "0.18";
    });
  }, [hoverState, markers, kind]);

  const onKeyView = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (i + 1) % VIEWS.length;
    setView(VIEWS[next].id);
    tabRefs.current[next]?.focus();
  };

  const vote = VOTES.find((v) => v.chamber === chamber) ?? VOTES[0];

  return (
    <section
      aria-label="Network map"
      data-tour="network-map"
      className={cx("relative min-h-0 min-w-0 overflow-hidden rounded-panel border border-line bg-surface-1", className)}
    >
      <div
        ref={boxRef}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          setHover(null);
          setMapHover(false);
        }}
        onPointerDown={(e) => {
          downAt.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          // A click (not a drag) on an arc or a city opens its detail card.
          const d = downAt.current;
          downAt.current = null;
          if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 5) return;
          const p = pointAt(e);
          if (view === "world" && hover?.arcIds?.length) {
            setDetail({ kind: "arcs", arcIds: hover.arcIds, x: p.x, y: p.y });
          } else if (view === "us" && hover?.state) {
            const cur = useHome.getState().detail;
            // A second click on the same state closes its card.
            setDetail(cur?.kind === "state" && cur.code === hover.state ? null : { kind: "state", code: hover.state, x: p.x, y: p.y });
          } else {
            // A click on empty map closes the card.
            setDetail(null);
          }
        }}
        onPointerEnter={() => setMapHover(true)}
        className={cx("absolute inset-0", ready ? gateStyles.revealed : gateStyles.content)}
        style={{ ...EDGE_FADE, cursor: hover ? "pointer" : view === "world" ? "grab" : "default" }}
        role="img"
        aria-label={
          view === "world"
            ? `Globe with ${arcs.length} travel and delegation records between Washington and ${cities} cities`
            : `United States map of the ${vote.voteLabel} vote by state and party`
        }
      >
        <GlobeScene
          theme={theme}
          reduced={reduced}
          paused={!visible}
          // Arcs draw in after the reveal, so they never pop in behind the gate.
          arcs={ready ? worldArcs : NO_ARCS}
          onFirstFrame={() => {
            setDrawn(true);
            setGlobeReady();
          }}
          framing="crop"
          view={view}
          markers={allMarkers}
          usArcs={ready ? usArcs : NO_US_ARCS}
          holdDrift={mapHover || !!detail}
          onHover={(h) => {
            if (view === "world") {
              setHover(h);
              return;
            }
            // US view: the state under the pointer, with its vote or its money flows.
            setHover(h?.state ? { text: stateHoverText(h.state, chamber, kind), state: h.state } : null);
            setHoverState(h?.state ?? null);
          }}
        />
      </div>
      <MapSkeleton />
      <div
        ref={tipRef}
        className="pointer-events-none absolute top-0 left-0 z-20 max-w-[280px] rounded-overlay border border-line-strong bg-surface-3 px-2.5 py-1.5 text-[12px] leading-4 font-medium whitespace-pre-line text-fg-1 transition-opacity duration-[120ms]"
        style={{ opacity: hover && !detail ? 1 : 0 }}
      >
        {hover?.text}
      </div>

      {/* A scrim under the header keeps the title readable over the map. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-24"
        style={{ background: "linear-gradient(to bottom, var(--surface-1) 30%, transparent)" }}
        aria-hidden="true"
      />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <h2 className="t-panel-title">Network Map</h2>
          {/* The Live chip pulses once each time a record arrives. */}
          <span key={arrived} className={cx("inline-flex", arrived > 0 && liveStyles.chipPulse)}>
            <LiveChip />
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          <span className="t-meta hidden max-w-[220px] truncate xl:inline" aria-live="polite">
            Showing: <span className="text-fg-2">{RADAR_TITLES[topic]}</span>
          </span>
          <div role="radiogroup" aria-label="Map view" className="flex gap-0.5 rounded-button border border-line bg-surface-2 p-0.5">
            {VIEWS.map((v, i) => {
              const on = v.id === view;
              return (
                <button
                  key={v.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setView(v.id)}
                  onKeyDown={(e) => onKeyView(e, i)}
                  className={cx(
                    "h-7 rounded-[4px] px-2.5 text-[12px] leading-none font-semibold transition-colors duration-[120ms]",
                    on ? "bg-surface-3 text-fg-1" : "text-fg-3 hover:text-fg-2",
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          <Link
            href={NETWORK_MAP_HREF}
            aria-label="View full network map"
            className="t-meta flex items-center gap-1 rounded-chip px-1.5 py-1 text-fg-2 transition-colors duration-[120ms] hover:text-fg-1"
          >
            Full map
            <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {view === "world" ? (
        <p className={cx("t-meta pointer-events-none absolute bottom-5 left-6 z-10 flex items-center gap-1.5", ready ? gateStyles.revealed : gateStyles.content)}>
          {kind === "allies"
            ? `${worldArcs.length} trips, delegations, and FARA filings ·`
            : `${arcs.length} trips and delegations · ${cities} cities ·`}
          <span className="inline-block h-0.5 w-3 rounded-full bg-orange" aria-hidden="true" />
          Newest
        </p>
      ) : (
        <div className={cx("t-meta absolute bottom-5 left-6 z-10 flex flex-wrap items-center gap-x-2 gap-y-1", ready ? gateStyles.revealed : gateStyles.content)}>
          <button
            type="button"
            onClick={startRollCall}
            aria-label="Replay the roll call"
            title="Replay the roll call"
            className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-line bg-surface-2 text-fg-2 transition-colors duration-[120ms] hover:border-line-strong hover:text-fg-1"
          >
            <RotateCcw size={13} strokeWidth={1.5} />
          </button>
          <span className="text-fg-2 tabular-nums" aria-live="polite">
            {kind === "money"
              ? `Contractor money and lobbying · ${TOP_MONEY.size} largest of ${MONEY_US_ARCS.length} flows · Hover a state for the rest`
              : `${rollDone ? shortVoteLabel(vote.voteLabel) : "Roll call"} · Yes ${running.yes} · No ${running.no} · Not voting ${running.nv}`}
          </span>
          {kind === "money" ? (
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 rounded-full bg-teal-bright" aria-hidden="true" />
                FEC contributions
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 rounded-full bg-fg-2" aria-hidden="true" />
                Lobbying contacts
              </span>
            </span>
          ) : null}
          {(["R", "D", "I"] as const).map((p) =>
            kind === "money" || (chamber === "house" && p === "I") ? null : (
              <span key={p} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: PARTY_COLOR[p] }} aria-hidden="true" />
                {p}
              </span>
            ),
          )}
          <span className={kind === "money" ? "hidden" : undefined}>· {chamber === "house" ? "Ring: party and vote split · Size: seats" : "Solid: yes · Ring: no · Dashed: not voting"}</span>
        </div>
      )}

      {detail ? <DetailCard detail={detail} arcs={worldArcs} width={width} onClose={() => setDetail(null)} /> : null}
    </section>
  );
}
