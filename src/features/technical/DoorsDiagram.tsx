"use client";

import { useState, type KeyboardEvent } from "react";
import { Bot, Code2, UserRound, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { AGENT_CLIENTS, CONTROLS, CORE_ITEMS, DOORS, type DoorId } from "./content";
import { Surface } from "./Section";
import styles from "./technical.module.css";

/*
 * "One core, three doors": the web app, a REST API, and an MCP server call the
 * same query templates and read the same serving tables. Drawn in one SVG on a
 * fixed 1040 x 492 grid, in the style of the four-layer system diagram.
 * Hovering or selecting a door lights its route.
 */

const W = 1040;
const H = 492;
const FONT = "var(--font-sans)";
const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

const CLIENT_X = 0;
const CLIENT_W = 230;
const DOOR_X = 300;
const DOOR_W = 172;
const DOOR_H = 60;
const CORE_X = 542;
const CORE_W = 258;
const CORE_TOP = 38;
const CORE_BOTTOM = 336;
const CORE_MID = (CORE_TOP + CORE_BOTTOM) / 2;
const SERVE_X = 860;
const SERVE_W = 180;
const SERVE_TOP = 88;
const SERVE_BOTTOM = 290;
const BAND_TOP = 420;
const BAND_H = 56;
const CONTROLS_X = 430;

/** Client boxes (analyst and customer software) and the agents frame. */
const ANALYST = { y: 40, h: 56 };
const CUSTOMER = { y: 116, h: 56 };
const AGENTS = { y: 192, h: 200 };
const AGENT_TOP = 232;
const AGENT_H = 32;
const AGENT_GAP = 8;
const agentY = (i: number) => AGENT_TOP + i * (AGENT_H + AGENT_GAP);

const DOOR_Y: Record<DoorId, number> = { web: 38, api: 114, mcp: 258 };
const doorMid = (id: DoorId) => DOOR_Y[id] + DOOR_H / 2;

const CORE_ITEM_TOP = 104;
const CORE_ITEM_H = 48;
const CORE_ITEM_GAP = 8;
const coreItemY = (i: number) => CORE_ITEM_TOP + i * (CORE_ITEM_H + CORE_ITEM_GAP);

const TABLES = ["entities", "edges", "documents", "entity_stats"];
const TABLE_TOP = 146;
const TABLE_H = 28;
const TABLE_GAP = 6;
const tableY = (i: number) => TABLE_TOP + i * (TABLE_H + TABLE_GAP);

/** A smooth horizontal S-curve between two points. */
function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = (x2 - x1) / 2;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

/** Connectors, each tied to the route it belongs to ("all" is shared by every route). */
const CONNECTORS: { d: string; route: DoorId | "all"; slow?: boolean }[] = [
  { d: curve(CLIENT_W, ANALYST.y + ANALYST.h / 2, DOOR_X, doorMid("web")), route: "web" },
  { d: curve(CLIENT_W, CUSTOMER.y + CUSTOMER.h / 2, DOOR_X, doorMid("api")), route: "api" },
  ...AGENT_CLIENTS.map((_, i) => ({
    d: curve(CLIENT_W - 12, agentY(i) + AGENT_H / 2, DOOR_X, doorMid("mcp")),
    route: "mcp" as const,
    slow: true,
  })),
  ...DOORS.map((d) => ({ d: curve(DOOR_X + DOOR_W, doorMid(d.id), CORE_X, CORE_MID), route: d.id })),
  { d: curve(CORE_X + CORE_W, CORE_MID, SERVE_X, (SERVE_TOP + SERVE_BOTTOM) / 2), route: "all" },
];

export function DoorsDiagram() {
  const [selected, setSelected] = useState<DoorId>("mcp");
  const [hovered, setHovered] = useState<DoorId | null>(null);
  const shown = hovered ?? selected;

  const handlers = (id: DoorId) => ({
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
  });
  const onKey = (id: DoorId) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(id);
    }
  };

  return (
    <Surface className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div className="flex items-center gap-5">
          <Legend swatch="line">Request flow</Legend>
          <Legend swatch="dash">Planned</Legend>
        </div>
        <p className="t-meta">Hover or select a door to see its route</p>
      </div>

      <div className="overflow-x-auto px-6 pt-6 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[880px]"
          role="group"
          aria-label="Three doors into one core: analysts use the web app, customer software uses the REST API, and AI agents use the MCP server. All three call the same query templates and read the same serving tables. API keys, rate limits, usage logs, and audit logs apply to every door."
        >
          {/* Column headers */}
          {[
            { x: CLIENT_X, t: "Clients" },
            { x: DOOR_X, t: "Doors" },
            { x: CORE_X, t: "Shared core" },
            { x: SERVE_X, t: "Serving tier" },
          ].map((h) => (
            <text key={h.t} x={h.x} y={24} fill="var(--text-3)" fontSize={12} fontWeight={500} fontFamily={FONT}>
              {h.t}
            </text>
          ))}

          {/* Connectors: a quiet base line, plus requests moving along it */}
          <g fill="none">
            {CONNECTORS.map((c, i) => {
              const lit = c.route === shown || c.route === "all";
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
                    strokeOpacity={lit ? 1 : 0.4}
                    style={{ animationDelay: `${-((i * 0.41) % 3)}s` }}
                  />
                </g>
              );
            })}
          </g>

          {/* Clients */}
          <g {...handlers("web")}>
            <ClientBox y={ANALYST.y} h={ANALYST.h} icon={UserRound} label="Analyst" sub="Asks in the web app" lit={shown === "web"} />
          </g>
          <g {...handlers("api")}>
            <ClientBox
              y={CUSTOMER.y}
              h={CUSTOMER.h}
              icon={Code2}
              label="Customer software"
              sub="Internal tools and dashboards"
              lit={shown === "api"}
            />
          </g>
          <g {...handlers("mcp")}>
            <rect
              x={CLIENT_X + 0.5}
              y={AGENTS.y + 0.5}
              width={CLIENT_W - 1}
              height={AGENTS.h - 1}
              rx={6}
              fill="var(--surface-2)"
              stroke={shown === "mcp" ? "var(--teal)" : "var(--border)"}
              style={{ transition: "stroke 120ms ease-out" }}
            />
            <text x={CLIENT_X + 14} y={AGENTS.y + 24} fill="var(--text-1)" fontSize={12} fontWeight={500} fontFamily={FONT}>
              AI agents
            </text>
            <text x={CLIENT_W - 14} y={AGENTS.y + 24} textAnchor="end" fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
              Any MCP client
            </text>
            {AGENT_CLIENTS.map((name, i) => (
              <g key={name}>
                <rect
                  x={CLIENT_X + 12.5}
                  y={agentY(i) + 0.5}
                  width={CLIENT_W - 25}
                  height={AGENT_H - 1}
                  rx={4}
                  fill="var(--surface-1)"
                  stroke="var(--border)"
                />
                <Bot x={CLIENT_X + 22} y={agentY(i) + 8} width={16} height={16} strokeWidth={1.5} color="var(--teal)" aria-hidden="true" />
                <text x={CLIENT_X + 46} y={agentY(i) + 20} fill="var(--text-2)" fontSize={11.5} fontFamily={FONT}>
                  {name}
                </text>
              </g>
            ))}
          </g>

          {/* Doors */}
          {DOORS.map((d) => {
            const on = d.id === shown;
            const planned = d.tag === "Planned";
            const y = DOOR_Y[d.id];
            const tagW = planned ? 56 : 64;
            return (
              <g
                key={d.id}
                className={styles.layer}
                tabIndex={0}
                role="button"
                aria-pressed={d.id === selected}
                aria-label={`${d.label}, ${d.tag.toLowerCase()}`}
                onFocus={() => setSelected(d.id)}
                onClick={() => setSelected(d.id)}
                onKeyDown={onKey(d.id)}
                {...handlers(d.id)}
              >
                <rect
                  className={styles.layerFrame}
                  x={DOOR_X + 0.75}
                  y={y + 0.75}
                  width={DOOR_W - 1.5}
                  height={DOOR_H - 1.5}
                  rx={6}
                  fill="var(--surface-2)"
                  stroke={on ? "var(--orange)" : planned ? "var(--teal)" : "var(--border)"}
                  strokeWidth={on ? 1.5 : 1}
                  strokeDasharray={planned ? "4 3" : undefined}
                />
                <text x={DOOR_X + 14} y={y + 25} fill="var(--text-1)" fontSize={13} fontWeight={600} fontFamily={FONT}>
                  {d.label}
                </text>
                <text x={DOOR_X + 14} y={y + 43} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
                  {d.sub}
                </text>
                <rect
                  x={DOOR_X + DOOR_W - 12 - tagW}
                  y={y + 12}
                  width={tagW}
                  height={18}
                  rx={4}
                  fill="none"
                  stroke={planned ? "var(--border-strong)" : "var(--teal)"}
                />
                <text
                  x={DOOR_X + DOOR_W - 12 - tagW / 2}
                  y={y + 25}
                  textAnchor="middle"
                  fill={planned ? "var(--text-2)" : "var(--teal-bright)"}
                  fontSize={11}
                  fontWeight={500}
                  fontFamily={FONT}
                >
                  {d.tag}
                </text>
              </g>
            );
          })}

          {/* The shared core */}
          <rect
            x={CORE_X + 0.75}
            y={CORE_TOP + 0.75}
            width={CORE_W - 1.5}
            height={CORE_BOTTOM - CORE_TOP - 1.5}
            rx={6}
            fill="var(--surface-2)"
            stroke="var(--teal)"
          />
          <text x={CORE_X + 16} y={CORE_TOP + 26} fill="var(--text-3)" fontSize={12} fontWeight={500} fontFamily={FONT}>
            One core for every door
          </text>
          <text
            x={CORE_X + 16}
            y={CORE_TOP + 50}
            fill="var(--text-1)"
            fontSize={15}
            fontWeight={600}
            fontFamily="var(--font-display)"
            letterSpacing="-0.005em"
          >
            Query templates + citations
          </text>
          {CORE_ITEMS.map((it, i) => (
            <g key={it.label}>
              <rect
                x={CORE_X + 12.5}
                y={coreItemY(i) + 0.5}
                width={CORE_W - 25}
                height={CORE_ITEM_H - 1}
                rx={4}
                fill="var(--surface-1)"
                stroke="var(--border)"
              />
              <text x={CORE_X + 26} y={coreItemY(i) + 20} fill="var(--text-1)" fontSize={12} fontWeight={500} fontFamily={FONT}>
                {it.label}
              </text>
              <text x={CORE_X + 26} y={coreItemY(i) + 36} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
                {it.sub}
              </text>
            </g>
          ))}

          {/* Serving tables */}
          <rect
            x={SERVE_X + 0.5}
            y={SERVE_TOP + 0.5}
            width={SERVE_W - 1}
            height={SERVE_BOTTOM - SERVE_TOP - 1}
            rx={6}
            fill="var(--surface-2)"
            stroke="var(--border)"
          />
          <text x={SERVE_X + 14} y={SERVE_TOP + 24} fill="var(--text-1)" fontSize={13} fontWeight={600} fontFamily={FONT}>
            Serving tables
          </text>
          <text x={SERVE_X + 14} y={SERVE_TOP + 42} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
            Checked before release
          </text>
          {TABLES.map((t, i) => (
            <g key={t}>
              <rect
                x={SERVE_X + 12.5}
                y={tableY(i) + 0.5}
                width={SERVE_W - 25}
                height={TABLE_H - 1}
                rx={4}
                fill="var(--surface-1)"
                stroke="var(--border)"
              />
              <text x={SERVE_X + 24} y={tableY(i) + 18} fill="var(--text-1)" fontSize={12} fontWeight={600} fontFamily={MONO_FONT}>
                {t}
              </text>
            </g>
          ))}

          {/* Controls on every door */}
          <line
            x1={DOOR_X + DOOR_W / 2}
            y1={DOOR_Y.mcp + DOOR_H}
            x2={DOOR_X + DOOR_W / 2}
            y2={BAND_TOP}
            stroke="var(--border-strong)"
            strokeDasharray="2 3"
          />
          <line
            x1={CORE_X + CORE_W / 2}
            y1={CORE_BOTTOM}
            x2={CORE_X + CORE_W / 2}
            y2={BAND_TOP}
            stroke="var(--border-strong)"
            strokeDasharray="2 3"
          />
          <rect
            x={DOOR_X + 0.5}
            y={BAND_TOP + 0.5}
            width={W - DOOR_X - 1}
            height={BAND_H - 1}
            rx={6}
            fill="var(--surface-2)"
            stroke="var(--border)"
          />
          <text x={DOOR_X + 14} y={BAND_TOP + 24} fill="var(--text-1)" fontSize={13} fontWeight={600} fontFamily={FONT}>
            Controls
          </text>
          <text x={DOOR_X + 14} y={BAND_TOP + 41} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
            On every door
          </text>
          {CONTROLS.map((c, i) => {
            const cellW = (W - CONTROLS_X) / CONTROLS.length;
            const x = CONTROLS_X + i * cellW;
            return (
              <g key={c.label}>
                <line x1={x} y1={BAND_TOP + 12} x2={x} y2={BAND_TOP + BAND_H - 12} stroke="var(--border)" />
                <text x={x + 16} y={BAND_TOP + 24} fill="var(--text-1)" fontSize={12} fontWeight={500} fontFamily={FONT}>
                  {c.label}
                </text>
                <text x={x + 16} y={BAND_TOP + 41} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
                  {c.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* What each door is */}
      <ul className="grid grid-cols-1 border-t border-line md:grid-cols-3" aria-live="polite">
        {DOORS.map((d, i) => {
          const on = d.id === shown;
          return (
            <li
              key={d.id}
              className={cx(
                "px-6 py-5 transition-colors duration-[120ms]",
                i > 0 && "border-t border-line md:border-t-0 md:border-l",
                on && "bg-surface-2",
              )}
              {...handlers(d.id)}
            >
              <p className={cx("t-meta", on && "text-orange-ink")}>{d.tag}</p>
              <h3 className="t-card-title mt-1">{d.title}</h3>
              <p className="t-body mt-1.5 text-fg-2">{d.body}</p>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}

function ClientBox({
  y,
  h,
  icon: Icon,
  label,
  sub,
  lit,
}: {
  y: number;
  h: number;
  icon: LucideIcon;
  label: string;
  sub: string;
  lit: boolean;
}) {
  return (
    <g>
      <rect
        x={CLIENT_X + 0.5}
        y={y + 0.5}
        width={CLIENT_W - 1}
        height={h - 1}
        rx={6}
        fill="var(--surface-2)"
        stroke={lit ? "var(--teal)" : "var(--border)"}
        style={{ transition: "stroke 120ms ease-out" }}
      />
      <Icon x={CLIENT_X + 14} y={y + h / 2 - 9} width={18} height={18} strokeWidth={1.5} color="var(--teal)" aria-hidden="true" />
      <text x={CLIENT_X + 44} y={y + 24} fill="var(--text-1)" fontSize={12} fontWeight={500} fontFamily={FONT}>
        {label}
      </text>
      <text x={CLIENT_X + 44} y={y + 40} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
        {sub}
      </text>
    </g>
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
