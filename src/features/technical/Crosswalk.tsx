"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { CROSSWALK, DECIDED_BY_LABEL, type DecidedBy } from "./content";
import { CodeBlock, MONO } from "./Code";
import { Surface } from "./Section";

/*
 * Entity resolution: one person, named five ways across five sources,
 * resolves to one node with one stable ID. Rows have a fixed height, so the
 * connector SVG lines up with them without measuring the DOM.
 */

const ROW_H = 64;
const ROW_GAP = 12;
const LINK_W = 168;
const TOTAL_H = CROSSWALK.length * ROW_H + (CROSSWALK.length - 1) * ROW_GAP;
const NODE_Y = TOTAL_H / 2;

const DASH: Record<DecidedBy, string | undefined> = {
  public_id: undefined,
  model: "5 4",
  reviewer: "1.5 3.5",
};

export function Crosswalk() {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Surface className="overflow-x-auto">
        <div className="flex min-w-[880px] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <p className="t-meta">Sen. Ellen Hartley in five sources</p>
            <div className="flex items-center gap-5">
              {(Object.keys(DASH) as DecidedBy[]).map((k) => (
                <span key={k} className="t-meta flex items-center gap-2 text-fg-2">
                  <svg width="24" height="6" aria-hidden="true">
                    <line x1="0" y1="3" x2="24" y2="3" stroke="var(--teal)" strokeWidth="1.5" strokeDasharray={DASH[k]} strokeLinecap="round" />
                  </svg>
                  Decided by {k === "public_id" ? "public ID" : DECIDED_BY_LABEL[k].toLowerCase()}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_168px_240px] items-start px-6 py-6">
            {/* Source records */}
            <ul className="flex flex-col" style={{ gap: ROW_GAP }}>
              {CROSSWALK.map((r, i) => (
                <li
                  key={r.keyType}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  className={cx(
                    "flex items-center justify-between gap-4 rounded-card border bg-surface-2 px-4 transition-[border-color,opacity] duration-[120ms]",
                    hover === i ? "border-teal" : "border-line",
                    hover !== null && hover !== i && "opacity-55",
                  )}
                  style={{ height: ROW_H }}
                >
                  <div className="min-w-0">
                    <p className="t-meta">{r.source}</p>
                    <p className={cx(MONO, "mt-1 truncate text-[13px] text-fg-1")}>{r.raw}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className={cx(MONO, "hidden text-fg-3 xl:inline")}>
                      {r.keyType}
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="font-display text-[16px] leading-5 font-semibold text-fg-1 tabular-nums">{r.confidence}</span>
                      <span className="t-meta">{DECIDED_BY_LABEL[r.decidedBy]}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Connectors */}
            <svg width={LINK_W} height={TOTAL_H} viewBox={`0 0 ${LINK_W} ${TOTAL_H}`} aria-hidden="true" className="block">
              {CROSSWALK.map((r, i) => {
                const y = i * (ROW_H + ROW_GAP) + ROW_H / 2;
                const lit = hover === i;
                return (
                  <path
                    key={r.keyType}
                    d={`M0,${y} C${LINK_W * 0.55},${y} ${LINK_W * 0.45},${NODE_Y} ${LINK_W},${NODE_Y}`}
                    fill="none"
                    stroke={lit ? "var(--teal-bright)" : "var(--teal)"}
                    strokeWidth={lit ? 2 : 1.25}
                    strokeDasharray={DASH[r.decidedBy]}
                    strokeLinecap="round"
                    opacity={hover === null || lit ? 1 : 0.3}
                    style={{ transition: "opacity 120ms ease-out, stroke 120ms ease-out" }}
                  />
                );
              })}
            </svg>

            {/* The resolved node */}
            <div className="flex flex-col items-start pl-6" style={{ height: TOTAL_H, justifyContent: "center" }}>
              <div className="flex items-center gap-4">
                <span
                  className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-surface-1 font-display text-[22px] font-bold text-fg-1"
                  style={{ border: "2px solid var(--orange)", boxShadow: "var(--focus-glow)" }}
                >
                  EH
                </span>
                <div className="min-w-0">
                  <p className="t-card-title">Sen. Ellen Hartley</p>
                  <p className="t-meta mt-0.5">R-OH · person</p>
                </div>
              </div>
              <p className={cx(MONO, "mt-4 text-fg-2")}>
                <span className="text-fg-3">privyus_id </span>per_01H…
              </p>
              <p className="t-meta mt-1">One node with one stable ID</p>
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <CodeBlock title="ID Crosswalk" meta="One row for each known identifier">
          <CrosswalkText />
        </CodeBlock>
        <div className="flex flex-col gap-3">
          <Fact title="Stable IDs">
            A rebuild reuses an existing ID. It creates a new ID only for a new entity, so links, watchlists, and saved
            checkpoints never break.
          </Fact>
          <Fact title="Human Review Queue">
            Uncertain matches go to a human reviewer. Reviewer decisions (&ldquo;same person&rdquo;, &ldquo;not the same
            person&rdquo;) live in Postgres, and every rebuild applies them first.
          </Fact>
          <Fact title="Release Checks">
            The release compares the new IDs with the last release. A sudden jump in merges or new IDs stops the
            release.
          </Fact>
        </div>
      </div>
    </div>
  );
}

function CrosswalkText() {
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(1, n - s.length));
  return (
    <>
      <span className="block whitespace-pre">
        <span className="font-semibold text-fg-1">crosswalk</span>
        <span className="text-fg-3"> (</span>
        <span className="text-teal-bright">key_type, key_value, privyus_id, confidence, decided_by</span>
        <span className="text-fg-3">)</span>
      </span>
      {CROSSWALK.map((r) => (
        <span key={r.keyType} className="block whitespace-pre text-fg-2">
          {"  "}
          {pad(r.keyType, 16)}
          <span className="text-fg-1">{pad(r.keyValue, 19)}</span>
          {pad("per_01H…", 11)}
          <span className="text-fg-1">{pad(r.confidence, 6)}</span>
          <span className="text-fg-3">{r.decidedBy}</span>
        </span>
      ))}
    </>
  );
}

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface-1 p-4">
      <h3 className="t-card-title text-[14px]">{title}</h3>
      <p className="t-body mt-1 text-fg-2">{children}</p>
    </div>
  );
}
