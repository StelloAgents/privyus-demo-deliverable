"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { stateByCode } from "@/data/geo";
import { fullDate } from "./format";
import { ROLL_INDEX, useHome, type Chamber } from "./homeStore";
import { exploreEntityHref } from "./links";
import {
  HOUSE_SEATS,
  SENATE_SEATS,
  VOTES,
  VOTE_NAME,
  billParts,
  chamberName,
  layoutChamber,
  memberLabel,
  shortVoteLabel,
  tally,
  type ChamberSeat,
  type Party,
  type SeatVote,
} from "./votes";

const VIEW_W = 360;
const EMPTY_PAINT = { fill: "none", stroke: "var(--text-3)", strokeOpacity: 0.35, dash: undefined };

const PARTY_COLOR: Record<Party, string> = { R: "var(--party-r)", D: "var(--party-d)", I: "var(--party-i)" };

/**
 * The vote encoding, shared with the map: solid = yes, ring = no, faint dashed ring = not voting.
 * Party colors encode party only.
 */
export function seatPaint(party: Party, vote: SeatVote) {
  const c = PARTY_COLOR[party];
  if (vote === "yes") return { fill: c, stroke: "none", strokeOpacity: 1, dash: undefined };
  if (vote === "no") return { fill: "none", stroke: c, strokeOpacity: 1, dash: undefined };
  return { fill: "none", stroke: c, strokeOpacity: 0.55, dash: "1.6 1.6" };
}

const CHAMBERS: { id: Chamber; seats: ChamberSeat[] }[] = [
  { id: "senate", seats: SENATE_SEATS },
  { id: "house", seats: HOUSE_SEATS },
];

function seatTitle(s: ChamberSeat): string {
  const where = stateByCode[s.state]?.name ?? s.state;
  const title = s.id.includes("-yes-") || s.id.includes("-no-") || s.id.includes("-nv-") ? "Rep." : "Sen.";
  const who = s.memberId ? memberLabel(s.memberId) : `${title} (${s.party}-${s.state}) · ${where}`;
  return `${who} · ${VOTE_NAME[s.vote]}${s.sponsor ? " · Sponsor" : ""}`;
}

/**
 * Seat chart: how each chamber voted on the tracked bills, by party (Democrats left,
 * Republicans right). Hover a seat to light up its state on the map; click to explore.
 */
export function SeatChart({ className }: { className?: string }) {
  const router = useRouter();
  const chamber = useHome((s) => s.chamber);
  const setChamber = useHome((s) => s.setChamber);
  const hoverState = useHome((s) => s.hoverState);
  const setHoverState = useHome((s) => s.setHoverState);
  const setDetail = useHome((s) => s.setDetail);
  const setMapView = useHome((s) => s.setMapView);
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const tabIndex = CHAMBERS.findIndex((c) => c.id === chamber);
  const vote = VOTES.find((v) => v.chamber === chamber) ?? VOTES[0];
  const seats = CHAMBERS[tabIndex].seats;
  const layout = useMemo(() => layoutChamber(seats, VIEW_W), [seats]);
  const t = useMemo(() => tally(seats), [seats]);
  const rollFilled = useHome((s) => s.rollFilled);
  const rollTotal = useHome((s) => s.rollTotal);
  const isFilled = (s: ChamberSeat) =>
    rollFilled >= rollTotal || (ROLL_INDEX[chamber === "senate" ? `s:${s.id}` : `h:${s.state}`] ?? 0) < rollFilled;
  const running = useMemo(() => tally(seats.filter(isFilled)), [seats, rollFilled, rollTotal, chamber]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSeat = (s: ChamberSeat) => {
    if (s.memberId) {
      router.push(exploreEntityHref(s.memberId));
      return;
    }
    setMapView("us");
    setDetail({ kind: "state", code: s.state, x: 0, y: 0 });
  };

  return (
    <div data-tour="seat-chart" className={cx("grid min-h-0 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-5", className)}>
      <div ref={boxRef} className="relative h-full min-h-0" onPointerLeave={() => setHoverState(null)}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${layout.height}`}
          className="block h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${billParts(vote.billId).number} ${vote.voteLabel}: ${vote.yes} yes, ${vote.no} no, ${vote.notVoting} not voting`}
        >
          {layout.seats.map((s) => {
            // Roll call: a seat is an empty outline until its state is called.
            const filled = isFilled(s);
            const paint = filled ? seatPaint(s.party, s.vote) : EMPTY_PAINT;
            const dim = !!hoverState && s.state !== hoverState;
            const r = chamber === "house" ? s.r * 0.92 : s.r;
            return (
              <circle
                key={s.id}
                cx={s.x}
                cy={s.y}
                r={paint.fill === "none" ? r - 0.7 : r}
                fill={paint.fill}
                stroke={paint.stroke}
                strokeWidth={paint.fill === "none" ? 1.4 : 0}
                strokeOpacity={paint.strokeOpacity}
                strokeDasharray={paint.dash}
                opacity={dim ? 0.18 : 1}
                pointerEvents="all"
                className="cursor-pointer transition-opacity duration-[120ms]"
                onPointerEnter={(e) => {
                  setHoverState(s.state);
                  const box = boxRef.current?.getBoundingClientRect();
                  if (box) setTip({ text: seatTitle(s), x: e.clientX - box.left, y: e.clientY - box.top });
                }}
                onPointerLeave={() => setTip(null)}
                onClick={() => onSeat(s)}
              />
            );
          })}
          {layout.seats
            .filter((s) => s.sponsor)
            .map((s) => (
              <circle key="sponsor-ring" cx={s.x} cy={s.y} r={s.r + 2.6} fill="none" stroke="var(--text-1)" strokeWidth={1.3} pointerEvents="none" />
            ))}
          <text x={VIEW_W / 2} y={layout.height - 30} textAnchor="middle" className="fill-fg-1 font-display text-[26px] font-extrabold tabular-nums">
            {running.yes}–{running.no}
          </text>
          <text x={VIEW_W / 2} y={layout.height - 10} textAnchor="middle" className="fill-fg-3 text-[12px] font-medium">
            Yes – No
          </text>
        </svg>
        {tip ? (
          <div
            className="pointer-events-none absolute z-10 rounded-chip border border-line-strong bg-surface-3 px-2 py-1 text-[12px] leading-4 font-medium whitespace-nowrap text-fg-1"
            style={{ left: tip.x, top: tip.y - 10, transform: "translate(-50%, -100%)" }}
          >
            {tip.text}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex gap-1 rounded-button border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Chamber">
          {CHAMBERS.map((c) => {
            const v = VOTES.find((x) => x.chamber === c.id) ?? VOTES[0];
            const on = c.id === chamber;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setChamber(c.id);
                  setTip(null);
                }}
                className={cx(
                  "h-7 flex-1 rounded-[4px] px-2 text-[12px] leading-4 font-semibold whitespace-nowrap transition-colors duration-[120ms]",
                  on ? "bg-surface-3 text-fg-1" : "text-fg-3 hover:text-fg-2",
                )}
              >
                {billParts(v.billId).number} · {chamberName(v.chamber)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="t-meta flex flex-wrap items-center gap-x-3 gap-y-1">
            {(["R", "D", "I"] as const)
              .filter((p) => t[p] > 0)
              .map((p) => (
                <span key={p} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PARTY_COLOR[p] }} aria-hidden="true" />
                  <span className="text-fg-2">{p}</span> <span className="tabular-nums">{t[p]}</span>
                </span>
              ))}
          </span>
          <span className="t-meta flex flex-wrap items-center gap-x-2 gap-y-1">
            <VoteSwatch vote="yes" /> Yes {t.yes}
            <span aria-hidden="true">·</span>
            <VoteSwatch vote="no" /> No {t.no}
            <span aria-hidden="true">·</span>
            <VoteSwatch vote="nv" /> Not voting {t.nv}
          </span>
          <span className="t-meta flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true" className="shrink-0">
              <circle cx="7" cy="7" r="3.5" fill="var(--text-3)" />
              <circle cx="7" cy="7" r="6" fill="none" stroke="var(--text-1)" strokeWidth="1.2" />
            </svg>
            Sponsor: {memberLabel(vote.sponsorId)}
          </span>
        </div>
        <p className="t-meta">
          {shortVoteLabel(vote.voteLabel)} · {fullDate(vote.date)}
        </p>
      </div>
    </div>
  );
}

function VoteSwatch({ vote }: { vote: SeatVote }) {
  const p = seatPaint("I", vote);
  return (
    <svg width="10" height="10" aria-hidden="true" className="shrink-0">
      <circle
        cx="5"
        cy="5"
        r={p.fill === "none" ? 3.6 : 4}
        fill={p.fill === "none" ? "none" : "var(--text-2)"}
        stroke={p.fill === "none" ? "var(--text-2)" : "none"}
        strokeWidth={1.3}
        strokeOpacity={p.strokeOpacity}
        strokeDasharray={p.dash}
      />
    </svg>
  );
}
