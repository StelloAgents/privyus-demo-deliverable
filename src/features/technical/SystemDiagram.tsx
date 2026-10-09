"use client";

import { useState, type KeyboardEvent } from "react";
import { cx } from "@/components/ui/cx";
import { LAYERS, SOURCES, TIERS, type LayerId } from "./content";
import { MONO } from "./Code";
import { Surface } from "./Section";
import styles from "./technical.module.css";

/*
 * The four-layer system diagram, drawn in one SVG on a fixed 1040 x 488 grid.
 * Sources feed in on the left, the app is on the right, and the raw, build,
 * and serving tiers run under layers 1 to 3. Hovering or focusing a layer
 * highlights it and shows its detail under the diagram.
 */

const W = 1040;
const H = 488;

const FRAME_TOP = 40;
const FRAME_BOTTOM = 392;
const FRAME_MID = (FRAME_TOP + FRAME_BOTTOM) / 2;
const ITEM_TOP = 96;
const ITEM_H = 48;
const ITEM_GAP = 8;

const SRC_X = 0;
const SRC_W = 176;
const SRC_TOP = 48;
const SRC_H = 32;
const SRC_GAP = 7;

const COLS: Record<LayerId, { x: number; w: number }> = {
  collect: { x: 206, w: 172 },
  resolve: { x: 414, w: 188 },
  store: { x: 638, w: 182 },
  showcase: { x: 858, w: 182 },
};

interface Item {
  label: string;
  sub: string;
  dashed?: boolean;
}

const ITEMS: Record<LayerId, Item[]> = {
  collect: [
    { label: "API connectors", sub: "congress.gov, LDA, FEC" },
    { label: "Bulk file loaders", sub: "Votes, FARA, GovInfo" },
    { label: "Scrapers", sub: "HTML, PDF, and OCR" },
    { label: "Orchestrator", sub: "Schedules and retries" },
  ],
  resolve: [
    { label: "Normalize", sub: "Names, dates, amounts" },
    { label: "Entity resolution", sub: "Public IDs, fuzzy, LLM" },
    { label: "Relationship extraction", sub: "Typed edges with sources" },
    { label: "Review queue", sub: "Uncertain matches", dashed: true },
  ],
  store: [
    { label: "Raw document store", sub: "Every original filing" },
    { label: "Graph database", sub: "Nodes and edges" },
    { label: "Search and vector index", sub: "Full text, embeddings" },
    { label: "Analytics warehouse", sub: "Counts and trends" },
    { label: "App database", sub: "Users, watchlists" },
  ],
  showcase: [
    { label: "AI query agent", sub: "Tools: graph, search" },
    { label: "Response", sub: "Answer, delta, citations" },
    { label: "Web app", sub: "Dashboard and graph" },
    { label: "Workspace", sub: "Checkpoints and alerts" },
  ],
};

const itemY = (i: number) => ITEM_TOP + i * (ITEM_H + ITEM_GAP);
const itemMid = (i: number) => itemY(i) + ITEM_H / 2;
const srcY = (i: number) => SRC_TOP + i * (SRC_H + SRC_GAP);

/** A smooth horizontal S-curve between two points. */
function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = (x2 - x1) / 2;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

const right = (id: LayerId) => COLS[id].x + COLS[id].w;

/** Connector paths, grouped by the layer they touch (used to brighten them). */
const CONNECTORS: { d: string; layers: LayerId[]; slow?: boolean }[] = [
  // Sources into Collect
  ...SOURCES.map((_, i) => ({
    d: curve(SRC_X + SRC_W, srcY(i) + SRC_H / 2, COLS.collect.x, FRAME_MID),
    layers: ["collect"] as LayerId[],
    slow: true,
  })),
  // Collect into Resolve
  { d: `M${right("collect")},${FRAME_MID} L${COLS.resolve.x},${FRAME_MID}`, layers: ["collect", "resolve"] },
  // Collect keeps the originals in the raw document store (over the top)
  {
    d: `M${COLS.collect.x + COLS.collect.w / 2},${FRAME_TOP} L${COLS.collect.x + COLS.collect.w / 2},${FRAME_TOP - 16} Q${COLS.collect.x + COLS.collect.w / 2},${FRAME_TOP - 24} ${COLS.collect.x + COLS.collect.w / 2 + 8},${FRAME_TOP - 24} L${COLS.store.x + COLS.store.w / 2 - 8},${FRAME_TOP - 24} Q${COLS.store.x + COLS.store.w / 2},${FRAME_TOP - 24} ${COLS.store.x + COLS.store.w / 2},${FRAME_TOP - 16} L${COLS.store.x + COLS.store.w / 2},${FRAME_TOP}`,
    layers: ["collect", "store"],
    slow: true,
  },
  // Resolve into the serving stores
  ...[1, 2, 3].map((i) => ({
    d: curve(right("resolve"), FRAME_MID, COLS.store.x, itemMid(i)),
    layers: ["resolve", "store"] as LayerId[],
  })),
  // Stores into the agent
  ...[1, 2, 3].map((i) => ({
    d: curve(right("store"), itemMid(i), COLS.showcase.x, itemMid(0)),
    layers: ["store", "showcase"] as LayerId[],
  })),
];

const TIER_TOP = 416;
const TIER_H = 56;
const TIER_COLS: { id: (typeof TIERS)[number]["id"]; layer: LayerId }[] = [
  { id: "raw", layer: "collect" },
  { id: "build", layer: "resolve" },
  { id: "serving", layer: "store" },
];
const TIER_SHORT: Record<string, string> = {
  raw: "As delivered, never edited",
  build: "Rebuilt by the pipeline",
  serving: "Read-only, after checks",
};

export function SystemDiagram() {
  const [selected, setSelected] = useState<LayerId>("resolve");
  const [hovered, setHovered] = useState<LayerId | null>(null);
  const shown = hovered ?? selected;
  const layer = LAYERS.find((l) => l.id === shown)!;

  const onKey = (id: LayerId) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(id);
    }
  };

  return (
    <Surface className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div className="flex items-center gap-5">
          <Legend swatch="line">Data flow</Legend>
          <Legend swatch="dash">Human step</Legend>
        </div>
        <p className="t-meta">Hover or select a layer to see its detail</p>
      </div>

      <div className="overflow-x-auto px-6 pt-6 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[880px]"
          role="group"
          aria-label="System diagram: public sources flow through four layers, collect, resolve and connect, store, and showcase, into the app."
        >
          {/* Column header for the sources */}
          <text x={SRC_X} y={28} fill="var(--text-3)" fontSize={12} fontWeight={500} fontFamily="var(--font-sans)">
            Public sources
          </text>

          {/* Connectors: a quiet base line, plus records moving along it */}
          <g fill="none">
            {CONNECTORS.map((c, i) => {
              const lit = c.layers.includes(shown);
              return (
                <g key={i}>
                  <path
                    d={c.d}
                    stroke={lit ? "var(--teal)" : "var(--border-strong)"}
                    strokeWidth={lit ? 1.5 : 1.25}
                    style={{ transition: "stroke 120ms ease-out" }}
                  />
                  <path
                    d={c.d}
                    stroke="var(--teal-bright)"
                    strokeWidth={2.5}
                    className={cx(styles.flow, c.slow && styles.flowSlow)}
                    strokeOpacity={lit ? 1 : 0.45}
                    style={{ animationDelay: `${-((i * 0.37) % 3)}s` }}
                  />
                </g>
              );
            })}
          </g>
          <text
            x={(COLS.collect.x + COLS.store.x + COLS.store.w) / 2}
            y={FRAME_TOP - 30}
            textAnchor="middle"
            fill="var(--text-3)"
            fontSize={11}
            fontFamily="var(--font-sans)"
          >
            Originals, with fetch time, URL, and content hash
          </text>

          {/* Sources */}
          {SOURCES.map((s, i) => (
            <g key={s.name}>
              <rect
                x={SRC_X + 0.5}
                y={srcY(i) + 0.5}
                width={SRC_W - 1}
                height={SRC_H - 1}
                rx={4}
                fill="var(--surface-2)"
                stroke={s.fara ? "var(--lavender)" : "var(--border)"}
              />
              <text x={SRC_X + 10} y={srcY(i) + 20} fill="var(--text-1)" fontSize={11.5} fontWeight={500} fontFamily="var(--font-sans)">
                {s.name}
              </text>
              <text
                x={SRC_X + SRC_W - 10}
                y={srcY(i) + 20}
                textAnchor="end"
                fill={s.fara ? "var(--lavender)" : "var(--text-3)"}
                fontSize={11}
                fontFamily="var(--font-sans)"
              >
                {s.form}
              </text>
            </g>
          ))}

          {/* Layers */}
          {LAYERS.map((l) => {
            const { x, w } = COLS[l.id];
            const on = l.id === shown;
            return (
              <g
                key={l.id}
                className={styles.layer}
                tabIndex={0}
                role="button"
                aria-pressed={l.id === selected}
                aria-label={`Layer ${l.index}: ${l.title}`}
                onMouseEnter={() => setHovered(l.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setSelected(l.id)}
                onClick={() => setSelected(l.id)}
                onKeyDown={onKey(l.id)}
              >
                <rect
                  className={styles.layerFrame}
                  x={x + 0.75}
                  y={FRAME_TOP + 0.75}
                  width={w - 1.5}
                  height={FRAME_BOTTOM - FRAME_TOP - 1.5}
                  rx={6}
                  fill="var(--surface-2)"
                  stroke={on ? "var(--orange)" : "var(--border)"}
                  strokeWidth={on ? 1.5 : 1}
                />
                <text
                  x={x + 14}
                  y={FRAME_TOP + 24}
                  fill={on ? "var(--orange-ink)" : "var(--text-3)"}
                  fontSize={12}
                  fontWeight={500}
                  fontFamily="var(--font-sans)"
                  style={{ transition: "fill 120ms ease-out" }}
                >
                  Layer {l.index}
                </text>
                {l.tag ? (
                  <g>
                    <rect
                      x={x + w - 14 - 64}
                      y={FRAME_TOP + 11}
                      width={64}
                      height={18}
                      rx={4}
                      fill="none"
                      stroke="var(--teal)"
                    />
                    <text
                      x={x + w - 14 - 32}
                      y={FRAME_TOP + 24}
                      textAnchor="middle"
                      fill="var(--teal-bright)"
                      fontSize={11}
                      fontWeight={500}
                      fontFamily="var(--font-sans)"
                    >
                      {l.tag}
                    </text>
                  </g>
                ) : null}
                <text
                  x={x + 14}
                  y={FRAME_TOP + 46}
                  fill="var(--text-1)"
                  fontSize={15}
                  fontWeight={600}
                  fontFamily="var(--font-display)"
                  letterSpacing="-0.005em"
                >
                  {l.title}
                </text>
                {ITEMS[l.id].map((it, i) => (
                  <g key={it.label}>
                    <rect
                      x={x + 10.5}
                      y={itemY(i) + 0.5}
                      width={w - 21}
                      height={ITEM_H - 1}
                      rx={4}
                      fill="var(--surface-1)"
                      stroke={it.dashed ? "var(--teal)" : "var(--border)"}
                      strokeDasharray={it.dashed ? "3 3" : undefined}
                    />
                    <text x={x + 22} y={itemY(i) + 20} fill="var(--text-1)" fontSize={12} fontWeight={500} fontFamily="var(--font-sans)">
                      {it.label}
                    </text>
                    <text x={x + 22} y={itemY(i) + 36} fill="var(--text-3)" fontSize={11} fontFamily="var(--font-sans)">
                      {it.sub}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {/* The raw, build, and serving tiers under layers 1 to 3 */}
          {TIER_COLS.map((t, i) => {
            const { x, w } = COLS[t.layer];
            const cx0 = x + w / 2;
            return (
              <g key={t.id}>
                <line x1={cx0} y1={FRAME_BOTTOM} x2={cx0} y2={TIER_TOP} stroke="var(--border-strong)" strokeDasharray="2 3" />
                <rect
                  x={x + 0.5}
                  y={TIER_TOP + 0.5}
                  width={w - 1}
                  height={TIER_H - 1}
                  rx={4}
                  fill="none"
                  stroke={t.id === "serving" ? "var(--teal)" : "var(--border)"}
                />
                <text x={x + 12} y={TIER_TOP + 22} fill="var(--text-1)" fontSize={12} fontWeight={600} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                  {t.id}
                </text>
                <text x={x + 12} y={TIER_TOP + 40} fill="var(--text-3)" fontSize={11} fontFamily="var(--font-sans)">
                  {TIER_SHORT[t.id]}
                </text>
                {i < TIER_COLS.length - 1 ? (
                  <path
                    d={`M${x + w + 6},${TIER_TOP + TIER_H / 2} L${COLS[TIER_COLS[i + 1].layer].x - 6},${TIER_TOP + TIER_H / 2}`}
                    stroke="var(--border-strong)"
                    markerEnd="url(#tech-arrow)"
                  />
                ) : null}
              </g>
            );
          })}
          <path
            d={`M${right("store") + 6},${TIER_TOP + TIER_H / 2} L${COLS.showcase.x - 6},${TIER_TOP + TIER_H / 2}`}
            stroke="var(--teal)"
            markerEnd="url(#tech-arrow-teal)"
          />
          <text x={COLS.showcase.x + 4} y={TIER_TOP + 22} fill="var(--text-2)" fontSize={12} fontWeight={500} fontFamily="var(--font-sans)">
            The app reads
          </text>
          <text x={COLS.showcase.x + 4} y={TIER_TOP + 40} fill="var(--text-3)" fontSize={11} fontFamily="var(--font-sans)">
            the serving tier only
          </text>

          <defs>
            <marker id="tech-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M1,1 L7,4 L1,7" fill="none" stroke="var(--border-strong)" strokeWidth={1.25} />
            </marker>
            <marker id="tech-arrow-teal" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M1,1 L7,4 L1,7" fill="none" stroke="var(--teal)" strokeWidth={1.25} />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Detail for the shown layer */}
      <div className="border-t border-line px-6 py-6" aria-live="polite">
        <div
          key={layer.id}
          className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]"
          style={{ animation: "privy-fade-rise 180ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
        >
          <div>
            <p className="t-meta text-orange-ink">Layer {layer.index}</p>
            <h3 className="mt-1 font-display text-[20px] leading-[26px] font-semibold text-fg-1">{layer.title}</h3>
            <p className="t-body mt-2 text-fg-2">{layer.summary}</p>
            {layer.id === "store" ? (
              <ul className="mt-4 flex flex-col gap-2">
                {TIERS.map((t) => (
                  <li key={t.id} className="t-body flex gap-3 text-fg-2">
                    <code className={cx(MONO, "w-14 shrink-0 text-fg-1")}>{t.id}</code>
                    <span>{t.rule}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {layer.detail.map((d) => (
              <div key={d.title} className="rounded-card border border-line bg-surface-2 p-4">
                <dt className="t-card-title text-[14px]">{d.title}</dt>
                <dd className="t-body mt-1 text-fg-2">{d.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Surface>
  );
}

function Legend({ swatch, children }: { swatch: "line" | "dash"; children: string }) {
  return (
    <span className="t-meta flex items-center gap-2 text-fg-2">
      <svg width="20" height="8" aria-hidden="true">
        {swatch === "line" ? (
          <line x1="0" y1="4" x2="20" y2="4" stroke="var(--teal)" strokeWidth="1.5" />
        ) : (
          <rect x="0.5" y="0.5" width="19" height="7" rx="2" fill="none" stroke="var(--teal)" strokeDasharray="3 2" />
        )}
      </svg>
      {children}
    </span>
  );
}
