"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Factory, Handshake, RotateCcw, type LucideIcon } from "lucide-react";
import { SourceChip } from "@/components/ui/SourceChip";
import { cx } from "@/components/ui/cx";
import { useReducedMotion } from "@/lib/motion";
import { MONO } from "./Code";
import {
  SESSION_ANSWER,
  SESSION_CALLS,
  SESSION_QUESTION,
  SESSION_SOURCES,
  type SessionCall,
  type SessionNodeId,
} from "./content";
import styles from "./technical.module.css";

/*
 * A planned MCP session, played as a transcript. Each tool result adds its
 * nodes to a small graph beside it, so the viewer sees the agent build the same
 * graph the app draws. Playback starts when the panel scrolls into view.
 *
 * Beats: 0 = question only; 2k+1 = call k running; 2k+2 = call k returned;
 * ANSWER = the answer streams; DONE = complete. Hidden lines keep their space
 * (opacity 0), so nothing shifts and screen readers get the full transcript.
 */

const N = SESSION_CALLS.length;
const ANSWER = 2 * N + 1;
const DONE = ANSWER + 1;
const WORDS = SESSION_ANSWER.split(" ");

const START_MS = 600;
const RUN_MS = 700;
const GAP_MS = 350;
const WORD_MS = 28; // about 35 words per second (DESIGN.md section 6)

const callStatus = (k: number, beat: number) => (beat >= 2 * k + 2 ? "done" : beat === 2 * k + 1 ? "active" : "pending");

export function AgentSession() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const [beatState, setBeat] = useState(0);
  const [wordsState, setWords] = useState(0);

  const beat = reduced ? DONE : beatState;
  const words = reduced ? WORDS.length : wordsState;

  // Start the first run when the session scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el || run > 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRun(1);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [run]);

  // Play one run: every beat and word on its own timer.
  useEffect(() => {
    if (run === 0 || reduced) return;
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => ids.push(window.setTimeout(fn, ms));
    let t = START_MS;
    for (let k = 0; k < N; k++) {
      at(t, () => setBeat(2 * k + 1));
      t += RUN_MS;
      at(t, () => setBeat(2 * k + 2));
      t += GAP_MS;
    }
    at(t, () => setBeat(ANSWER));
    WORDS.forEach((_, i) => at(t + (i + 1) * WORD_MS, () => setWords(i + 1)));
    at(t + WORDS.length * WORD_MS + 240, () => setBeat(DONE));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [run, reduced]);

  const replay = () => {
    setBeat(0);
    setWords(0);
    setRun((r) => r + 1);
  };

  const running = run > 0 && beat < DONE;

  return (
    <div ref={ref} className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_464px]">
      <figure className="flex min-w-0 flex-col rounded-card border border-line bg-surface-2">
        <figcaption
          className={cx(
            "flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line pl-4",
            reduced ? "pr-4" : "pr-2",
          )}
        >
          <span className="text-[13px] leading-4 font-medium text-fg-1">Agent Session</span>
          <span className="flex items-center gap-3">
            <span className="t-meta" aria-live="polite">
              {running ? "Running" : `${N} tool calls · ${SESSION_SOURCES.length} sources`}
            </span>
            {reduced ? null : (
              <button
                type="button"
                onClick={replay}
                className="inline-flex h-7 items-center gap-1.5 rounded-button px-2 text-[13px] leading-4 font-medium text-fg-2 transition-colors duration-[120ms] hover:bg-surface-3 hover:text-fg-1"
              >
                <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
                Replay
              </button>
            )}
          </span>
        </figcaption>

        <div className="flex flex-col gap-4 px-4 py-4">
          <div>
            <p className="t-meta">Question to the agent</p>
            <p className="mt-1 text-[14px] leading-5 text-fg-1">{SESSION_QUESTION}</p>
          </div>

          <ol className="flex flex-col gap-3">
            {SESSION_CALLS.map((c, k) => (
              <CallBlock key={k} call={c} status={callStatus(k, beat)} animate={!reduced} />
            ))}
          </ol>

          <Reveal show={beat >= ANSWER} animate={!reduced} className="border-t border-line pt-4">
            <p className="t-meta">Answer</p>
            <p className="mt-1 text-[14px] leading-[22px] text-fg-1">
              {WORDS.map((w, i) => (
                <span key={i} className={cx("transition-opacity duration-[120ms]", i >= words && "opacity-0")}>
                  <Word text={w} />
                  {i < WORDS.length - 1 ? " " : null}
                </span>
              ))}
            </p>
            <div
              className={cx("mt-3 flex flex-wrap gap-2 transition-opacity duration-200", beat < DONE && "opacity-0")}
            >
              {SESSION_SOURCES.map((s) => (
                <SourceChip key={s.n} kind={s.kind} label={`[${s.n}] ${s.title}`} />
              ))}
            </div>
          </Reveal>
        </div>
      </figure>

      <SessionGraph beat={beat} />
    </div>
  );
}

/** One tool call: status, the call as code, then the returned records. */
function CallBlock({ call, status, animate }: { call: SessionCall; status: "pending" | "active" | "done"; animate: boolean }) {
  const shown = status !== "pending";
  const done = status === "done";
  return (
    <li className={cx(!shown && "opacity-0", shown && animate && styles.lineIn)}>
      <div className="flex items-start gap-2.5">
        <StatusMark status={status} />
        <code className={cx(MONO, "min-w-0 flex-1 whitespace-pre-wrap text-fg-2")}>
          <span className="font-semibold text-teal-bright">{call.tool}</span>(
          {call.args.map((a, i) => (
            <span key={i}>
              {i > 0 ? "\n" : null}
              {a}
            </span>
          ))}
          )
        </code>
      </div>
      <div
        className={cx(
          "mt-1.5 ml-[7px] border-l border-line pl-[17px] transition-opacity duration-200",
          !done && "opacity-0",
        )}
      >
        <div className="flex items-start gap-4">
          <div className={cx(MONO, "grid min-w-0 flex-1 grid-cols-[auto_auto_minmax(0,1fr)] gap-x-4")}>
            {call.lines.map((l, i) => (
              <div key={i} className="contents">
                <span className="whitespace-pre text-fg-3">{l.id}</span>
                <span className="whitespace-nowrap text-fg-1">{l.name}</span>
                <span className="text-fg-2">{l.detail ?? ""}</span>
              </div>
            ))}
          </div>
          <span className="t-meta shrink-0 pt-0.5">{call.summary}</span>
        </div>
      </div>
    </li>
  );
}

/** Pending dot, spinning ring, or teal check (the reasoning steps marks). */
function StatusMark({ status }: { status: "pending" | "active" | "done" }) {
  return (
    <span className="flex h-5 w-4 shrink-0 items-center justify-center" aria-hidden="true">
      {status === "done" ? (
        <Check size={14} strokeWidth={2} className="text-teal" />
      ) : status === "active" ? (
        <span
          className="block size-3.5 rounded-full border-[1.5px] border-teal-bright border-t-transparent"
          style={{ animation: "privy-spin 800ms linear infinite" }}
        />
      ) : (
        <span className="block size-1.5 rounded-full bg-fg-3" />
      )}
    </span>
  );
}

/** A word of the answer. A citation such as "[1]." renders as a small chip. */
function Word({ text }: { text: string }) {
  const m = /^\[(\d+)\](.*)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      <span className="mx-px inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-chip border border-teal px-1 align-[1px] text-[11px] leading-none font-medium text-teal-bright tabular-nums">
        {m[1]}
      </span>
      {m[2]}
    </>
  );
}

function Reveal({
  show,
  animate,
  className,
  children,
}: {
  show: boolean;
  animate: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx(className, !show && "opacity-0", show && animate && styles.lineIn)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* The graph beside the transcript                                     */
/* ------------------------------------------------------------------ */

const GW = 464;
const GH = 396;
const FONT = "var(--font-sans)";

type Kind = "person" | "event" | "org";

interface GNode {
  x: number;
  y: number;
  r: number;
  kind: Kind;
  label: string;
  sub?: string;
  initials?: string;
  /** Where the label sits. */
  place: "above" | "below" | "right";
}

const NODES: Record<SessionNodeId, GNode> = {
  aegis: { x: 64, y: 76, r: 14, kind: "org", label: "Aegis Systems", place: "above" },
  hartley: { x: 232, y: 76, r: 18, kind: "person", label: "Sen. Ellen Hartley", initials: "EH", place: "above" },
  redwood: { x: 400, y: 76, r: 14, kind: "org", label: "Redwood Defense", place: "above" },
  "meeting-meridian": { x: 88, y: 206, r: 12, kind: "event", label: "Meridian briefing", sub: "Feb 24, 2026", place: "below" },
  "meeting-private": { x: 232, y: 206, r: 12, kind: "event", label: "Private meeting", sub: "Jun 17, 2026", place: "right" },
  "meeting-ukraine": { x: 376, y: 206, r: 12, kind: "event", label: "Ukraine delegation", sub: "Apr 29, 2026", place: "below" },
  voss: { x: 80, y: 332, r: 15, kind: "person", label: "Clara Voss", sub: "Meridian Public Affairs", initials: "CV", place: "below" },
  pierce: { x: 232, y: 332, r: 15, kind: "person", label: "Nathaniel Pierce", sub: "Aegis Systems", initials: "NP", place: "below" },
  sen: { x: 384, y: 332, r: 15, kind: "person", label: "Dr. Priya Sen", sub: "Atlantic Security Institute", initials: "PS", place: "below" },
};

interface GEdge {
  from: SessionNodeId;
  to: SessionNodeId;
  /** On the focus path from Hartley to the cited attendee. */
  focus?: boolean;
  label?: string;
  cite?: number;
}

const EDGES: GEdge[] = [
  { from: "hartley", to: "meeting-meridian" },
  { from: "hartley", to: "meeting-private", focus: true },
  { from: "hartley", to: "meeting-ukraine" },
  { from: "meeting-private", to: "voss" },
  { from: "meeting-private", to: "pierce", focus: true, cite: 1 },
  { from: "meeting-private", to: "sen" },
  { from: "aegis", to: "hartley", label: "$18,750", cite: 2 },
  { from: "redwood", to: "hartley", label: "$7,625", cite: 2 },
];

/** Nodes outside the answer, dimmed once the answer arrives. */
const DIMMED = new Set<SessionNodeId>(["meeting-meridian", "meeting-ukraine", "voss", "sen"]);

/** The beat at which each node appears (the beat its tool call returns). */
const ADDED_AT = (() => {
  const m = new Map<SessionNodeId, number>();
  SESSION_CALLS.forEach((c, k) => c.adds.forEach((id) => m.set(id, 2 * k + 2)));
  return m;
})();

const ICONS: Record<"event" | "org", LucideIcon> = {
  event: Handshake,
  org: Factory,
};

function edgePath(e: GEdge) {
  const a = NODES[e.from];
  const b = NODES[e.to];
  if (a.y === b.y) {
    // Horizontal: from rim to rim.
    const dir = Math.sign(b.x - a.x);
    return `M${a.x + dir * a.r},${a.y} L${b.x - dir * b.r},${b.y}`;
  }
  // Vertical S-curve from the bottom of the parent to the top of the child.
  const y1 = a.y + a.r;
  const y2 = b.y - b.r;
  const my = (y1 + y2) / 2;
  return `M${a.x},${y1} C${a.x},${my} ${b.x},${my} ${b.x},${y2}`;
}

function SessionGraph({ beat }: { beat: number }) {
  const final = beat >= ANSWER;
  const visible = (id: SessionNodeId) => beat >= (ADDED_AT.get(id) ?? Infinity);
  const dim = (id: SessionNodeId) => final && DIMMED.has(id);

  return (
    <figure className="flex min-w-0 flex-col rounded-card border border-line bg-surface-2 xl:sticky xl:top-6">
      <figcaption className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <span className="text-[13px] leading-4 font-medium text-fg-1">Graph Built by the Agent</span>
        <Link
          href="/explore?turn=private-meeting-attendees"
          target="_blank"
          rel="noopener"
          className="t-meta inline-flex items-center gap-1 text-teal-bright transition-colors duration-[120ms] hover:text-fg-1"
        >
          Same records in the demo
          <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </figcaption>
      <div
        className="px-2 py-3"
        style={{ backgroundImage: "radial-gradient(var(--grid-dot) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        <svg
          viewBox={`0 0 ${GW} ${GH}`}
          className="block h-auto w-full"
          role="img"
          aria-label="The graph from the session: Sen. Ellen Hartley, three 2026 meetings, the three attendees of the private meeting on Jun 17, 2026, and contributions from Aegis Systems and Redwood Defense. The path from Hartley to Nathaniel Pierce of Aegis Systems is highlighted."
        >
          {beat < 2 ? (
            <text x={12} y={20} fill="var(--text-3)" fontSize={12} fontWeight={500} fontFamily={FONT}>
              Waiting for the first tool result
            </text>
          ) : null}

          {/* Edges */}
          <g fill="none">
            {EDGES.map((e) => {
              if (!visible(e.from) || !visible(e.to)) return null;
              const onPath = final && e.focus;
              const cited = final && e.cite !== undefined && !e.focus;
              const faded = dim(e.from) || dim(e.to);
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={edgePath(e)}
                  pathLength={1}
                  className={cx(styles.edgeIn, styles.fade)}
                  stroke={onPath ? "var(--orange)" : cited ? "var(--teal-bright)" : "var(--teal)"}
                  strokeOpacity={onPath || cited ? 1 : 0.55}
                  strokeWidth={onPath || cited ? 2 : 1.25}
                  style={{
                    opacity: faded ? "var(--graph-dim-opacity)" : 1,
                    transition: "stroke 200ms ease-out, opacity 200ms ease-out",
                  }}
                />
              );
            })}
          </g>

          {/* Edge labels and citation marks */}
          {EDGES.map((e) => {
            if (!visible(e.from) || !visible(e.to)) return null;
            const a = NODES[e.from];
            const b = NODES[e.to];
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const showCite = final && e.cite !== undefined;
            if (e.label) {
              const w = e.label.length * 6.6 + 14;
              return (
                <g key={`l-${e.from}`} className={styles.nodeIn}>
                  <rect x={mx - w / 2} y={my - 10} width={w} height={20} rx={4} fill="var(--surface-1)" stroke="var(--border)" />
                  <text x={mx} y={my + 4} textAnchor="middle" fill="var(--text-2)" fontSize={11} fontWeight={500} fontFamily={FONT}>
                    {e.label}
                  </text>
                  {showCite ? <Cite x={mx - 8} y={my + 14} n={e.cite!} /> : null}
                </g>
              );
            }
            return showCite ? <Cite key={`c-${e.to}`} x={mx - 26} y={my - 8} n={e.cite!} /> : null;
          })}

          {/* Nodes */}
          {(Object.keys(NODES) as SessionNodeId[]).map((id) => {
            if (!visible(id)) return null;
            const n = NODES[id];
            const focused = final && id === "pierce";
            const Icon = n.kind === "person" ? null : ICONS[n.kind];
            return (
              <g key={id} className={styles.fade} style={{ opacity: dim(id) ? "var(--graph-dim-opacity)" : 1 }}>
                <g className={styles.nodeIn}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r}
                    fill="var(--surface-1)"
                    stroke={focused ? "var(--orange)" : "var(--teal)"}
                    strokeWidth={1.5}
                    style={{
                      transition: "stroke 200ms ease-out",
                      filter: focused ? "drop-shadow(0 0 8px var(--orange-glow))" : undefined,
                    }}
                  />
                  {Icon ? (
                    <Icon
                      x={n.x - n.r / 2}
                      y={n.y - n.r / 2}
                      width={n.r}
                      height={n.r}
                      strokeWidth={1.5}
                      color="var(--teal)"
                      aria-hidden="true"
                    />
                  ) : (
                    <text
                      x={n.x}
                      y={n.y + (n.r > 16 ? 4.5 : 4)}
                      textAnchor="middle"
                      fill="var(--text-1)"
                      fontSize={n.r > 16 ? 12.5 : 11}
                      fontWeight={700}
                      fontFamily="var(--font-display)"
                    >
                      {n.initials}
                    </text>
                  )}
                  <NodeLabel n={n} focused={focused} />
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="t-meta border-t border-line px-4 py-3">
        Each tool result adds its nodes. The orange path leads to the record behind citation 1.
      </p>
    </figure>
  );
}

function NodeLabel({ n, focused }: { n: GNode; focused: boolean }) {
  const nameFill = focused ? "var(--orange-ink)" : "var(--text-1)";
  if (n.place === "right") {
    return (
      <>
        <text x={n.x + n.r + 8} y={n.y - 1} fill={nameFill} fontSize={11.5} fontWeight={500} fontFamily={FONT}>
          {n.label}
        </text>
        <text x={n.x + n.r + 8} y={n.y + 13} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
          {n.sub}
        </text>
      </>
    );
  }
  if (n.place === "above") {
    return (
      <text x={n.x} y={n.y - n.r - 9} textAnchor="middle" fill={nameFill} fontSize={11.5} fontWeight={500} fontFamily={FONT}>
        {n.label}
      </text>
    );
  }
  const y = n.y + n.r + 15;
  return (
    <>
      <text x={n.x} y={y} textAnchor="middle" fill={nameFill} fontSize={11.5} fontWeight={500} fontFamily={FONT}>
        {n.label}
      </text>
      {n.sub ? (
        <text x={n.x} y={y + 14} textAnchor="middle" fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
          {n.sub}
        </text>
      ) : null}
    </>
  );
}

/** A small citation mark, matching the chips in the answer. */
function Cite({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g className={styles.nodeIn}>
      <rect x={x} y={y} width={16} height={16} rx={4} fill="var(--surface-1)" stroke="var(--teal)" />
      <text x={x + 8} y={y + 11.5} textAnchor="middle" fill="var(--teal-bright)" fontSize={10.5} fontWeight={600} fontFamily={FONT}>
        {n}
      </text>
    </g>
  );
}
