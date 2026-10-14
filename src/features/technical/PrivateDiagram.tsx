import { Bot, Code2, Lock, UserRound, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { PRIVATE_CORE, PRIVATE_CUSTOMER_DATA, PRIVATE_KEPT, PRIVATE_SOURCES, PRIVATE_USERS } from "./content";
import { Surface } from "./Section";
import styles from "./technical.module.css";

/*
 * Private deployment data flow: the public-record graph syncs one way into a
 * private instance inside the customer's boundary. Customer records join it
 * there and never leave. The build pipeline stays in Privyus Cloud.
 * Drawn on a fixed 1040 x 456 grid, in the style of the doors diagram.
 */

const W = 1040;
const H = 456;
const FONT = "var(--font-sans)";

const CLOUD_X = 0;
const CLOUD_W = 200;
const GRAPH = { y: 56, h: 180 };
const KEPT = { y: 264, h: 160 };

const BOUND_X = 248;
const BOUND_TOP = 40;
const BOUND_BOTTOM = 448;

const CUST_X = 284;
const CUST_W = 196;
const CUST = { y: 196, h: 180 };

const CORE_X = 560;
const CORE_W = 240;
const CORE_TOP = 56;
const CORE_BOTTOM = 376;
const CORE_MID = (CORE_TOP + CORE_BOTTOM) / 2;
const CORE_ITEM_TOP = 120;
const CORE_ITEM_H = 50;
const CORE_ITEM_GAP = 8;
const coreItemY = (i: number) => CORE_ITEM_TOP + i * (CORE_ITEM_H + CORE_ITEM_GAP);

const USERS_X = 860;
const USERS_W = 164;
const USER_H = 56;
const USER_TOP = 110;
const USER_GAP = 22;
const userY = (i: number) => USER_TOP + i * (USER_H + USER_GAP);
const USER_ICONS: LucideIcon[] = [UserRound, Bot, Code2];

const ITEM_H = 24;
const ITEM_STEP = 30;
const listY = (top: number, i: number) => top + 58 + i * ITEM_STEP;

const SYNC_Y1 = GRAPH.y + GRAPH.h / 2;
const SYNC_Y2 = 128;

/** A smooth horizontal S-curve between two points. */
function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = (x2 - x1) / 2;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

const CONNECTORS: { d: string; slow?: boolean }[] = [
  { d: curve(CLOUD_W, SYNC_Y1, CORE_X, SYNC_Y2), slow: true },
  { d: curve(CUST_X + CUST_W, CUST.y + CUST.h / 2, CORE_X, 292) },
  ...PRIVATE_USERS.map((_, i) => ({ d: curve(CORE_X + CORE_W, CORE_MID, USERS_X, userY(i) + USER_H / 2) })),
];

export function PrivateDiagram() {
  return (
    <Surface className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div className="flex items-center gap-5">
          <Legend swatch="line">Data flow</Legend>
          <Legend swatch="dash">Customer boundary</Legend>
        </div>
        <p className="t-meta">One way in. Nothing flows back.</p>
      </div>

      <div className="overflow-x-auto px-6 pt-6 pb-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[880px]"
          role="img"
          aria-label="Private deployment. Privyus Cloud syncs the public-record graph one way into a private instance inside the customer's environment. Inside that boundary, the customer's CRM contacts, meeting notes, and memos join the same entities, and the customer's analysts, AI agents, and internal tools query it. Nothing flows back. The collectors, entity resolution, and join logic stay in Privyus Cloud."
        >
          {/* Column headers */}
          <text x={CLOUD_X} y={24} fill="var(--text-3)" fontSize={12} fontWeight={500} fontFamily={FONT}>
            Privyus Cloud
          </text>
          <text x={BOUND_X} y={24} fill="var(--text-3)" fontSize={12} fontWeight={500} fontFamily={FONT}>
            Your environment
          </text>
          <text x={W} y={24} textAnchor="end" fill="var(--text-3)" fontSize={12} fontFamily={FONT}>
            Your cloud account or data center
          </text>

          {/* The customer boundary */}
          <rect
            x={BOUND_X + 0.75}
            y={BOUND_TOP + 0.75}
            width={W - BOUND_X - 1.5}
            height={BOUND_BOTTOM - BOUND_TOP - 1.5}
            rx={8}
            fill="var(--teal-soft)"
            stroke="var(--teal)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <Lock
            x={CUST_X}
            y={BOUND_BOTTOM - 44}
            width={16}
            height={16}
            strokeWidth={1.5}
            color="var(--teal-bright)"
            aria-hidden="true"
          />
          <text x={CUST_X + 24} y={BOUND_BOTTOM - 32} fill="var(--text-1)" fontSize={12} fontWeight={500} fontFamily={FONT}>
            Your records never cross this line.
          </text>
          <text x={CUST_X + 24} y={BOUND_BOTTOM - 16} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
            Privyus Cloud sends public data in. It receives no customer records and no queries.
          </text>

          {/* Connectors */}
          <g fill="none">
            {CONNECTORS.map((c, i) => (
              <g key={i}>
                <path d={c.d} stroke="var(--teal)" strokeWidth={1.5} />
                <path
                  d={c.d}
                  stroke="var(--teal-bright)"
                  strokeWidth={2.5}
                  className={cx(styles.flow, c.slow && styles.flowSlow)}
                  style={{ animationDelay: `${-((i * 0.41) % 3)}s` }}
                />
              </g>
            ))}
          </g>

          {/* Sync label and the gate on the boundary */}
          <circle cx={BOUND_X + 0.75} cy={138} r={4} fill="var(--surface-1)" stroke="var(--teal-bright)" strokeWidth={1.5} />
          <text x={CUST_X + 8} y={112} fill="var(--teal-bright)" fontSize={11} fontWeight={500} fontFamily={FONT}>
            Daily sync, one way in
          </text>

          {/* Privyus Cloud: the graph that ships, and the build that stays */}
          <ListBox
            x={CLOUD_X}
            w={CLOUD_W}
            y={GRAPH.y}
            h={GRAPH.h}
            title="Public-record graph"
            sub="Finished serving tables"
            items={PRIVATE_SOURCES}
            stroke="var(--teal)"
          />
          <ListBox
            x={CLOUD_X}
            w={CLOUD_W}
            y={KEPT.y}
            h={KEPT.h}
            title="Stays in Privyus"
            sub="Never shipped"
            items={PRIVATE_KEPT}
            stroke="var(--border-strong)"
            dashed
          />

          {/* Customer data */}
          <ListBox
            x={CUST_X}
            w={CUST_W}
            y={CUST.y}
            h={CUST.h}
            title="Your data"
            sub="Stays inside the boundary"
            items={PRIVATE_CUSTOMER_DATA}
            stroke="var(--border)"
          />

          {/* The private instance */}
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
            Runs in your environment
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
            Private Privyus
          </text>
          {PRIVATE_CORE.map((it, i) => (
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
              <text x={CORE_X + 26} y={coreItemY(i) + 21} fill="var(--text-1)" fontSize={12} fontWeight={500} fontFamily={FONT}>
                {it.label}
              </text>
              <text x={CORE_X + 26} y={coreItemY(i) + 37} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
                {it.sub}
              </text>
            </g>
          ))}

          {/* Users inside the boundary */}
          <text x={USERS_X} y={USER_TOP - 14} fill="var(--text-3)" fontSize={12} fontWeight={500} fontFamily={FONT}>
            Your team
          </text>
          {PRIVATE_USERS.map((u, i) => {
            const Icon = USER_ICONS[i];
            const y = userY(i);
            return (
              <g key={u.label}>
                <rect
                  x={USERS_X + 0.5}
                  y={y + 0.5}
                  width={USERS_W - 1}
                  height={USER_H - 1}
                  rx={6}
                  fill="var(--surface-2)"
                  stroke="var(--border)"
                />
                <Icon x={USERS_X + 14} y={y + USER_H / 2 - 9} width={18} height={18} strokeWidth={1.5} color="var(--teal)" aria-hidden="true" />
                <text x={USERS_X + 44} y={y + 24} fill="var(--text-1)" fontSize={12} fontWeight={500} fontFamily={FONT}>
                  {u.label}
                </text>
                <text x={USERS_X + 44} y={y + 40} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
                  {u.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Surface>
  );
}

function ListBox({
  x,
  w,
  y,
  h,
  title,
  sub,
  items,
  stroke,
  dashed,
}: {
  x: number;
  w: number;
  y: number;
  h: number;
  title: string;
  sub: string;
  items: string[];
  stroke: string;
  dashed?: boolean;
}) {
  return (
    <g>
      <rect
        x={x + 0.75}
        y={y + 0.75}
        width={w - 1.5}
        height={h - 1.5}
        rx={6}
        fill="var(--surface-2)"
        stroke={stroke}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <text x={x + 14} y={y + 24} fill="var(--text-1)" fontSize={13} fontWeight={600} fontFamily={FONT}>
        {title}
      </text>
      <text x={x + 14} y={y + 42} fill="var(--text-3)" fontSize={11} fontFamily={FONT}>
        {sub}
      </text>
      {items.map((it, i) => (
        <g key={it}>
          <rect
            x={x + 12.5}
            y={listY(y, i) + 0.5}
            width={w - 25}
            height={ITEM_H - 1}
            rx={4}
            fill={dashed ? "transparent" : "var(--surface-1)"}
            stroke="var(--border)"
          />
          <text x={x + 24} y={listY(y, i) + 16} fill={dashed ? "var(--text-2)" : "var(--text-1)"} fontSize={11.5} fontFamily={FONT}>
            {it}
          </text>
        </g>
      ))}
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
