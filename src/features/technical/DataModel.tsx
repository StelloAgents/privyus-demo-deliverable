import { cx } from "@/components/ui/cx";
import { MODEL_NOTES, SCHEMA, type SchemaTable } from "./content";
import { MONO } from "./Code";
import { Surface } from "./Section";

/*
 * The serving data model as a schema diagram on a fixed 1000 x 472 canvas.
 * Tables have fixed row heights, so the relation lines are computed, not measured.
 */

const CANVAS_W = 1000;
const CANVAS_H = 472;
const HEADER = 52;
const ROW = 28;
const PAD_B = 6;
const FOOTER = 44;

type Key = keyof typeof SCHEMA;

const POS: Record<Key, { x: number; y: number; w: number; footer?: string }> = {
  entities: { x: 32, y: 0, w: 240 },
  edges: { x: 352, y: 0, w: 280, footer: "Sorted by (src_id, type, event_date). A second copy sorted by (dst_id, type)." },
  documents: { x: 720, y: 0, w: 280 },
  entity_stats: { x: 32, y: 300, w: 240 },
  votes: { x: 352, y: 330, w: 280 },
};

/** The y of the middle of a column row. */
function rowY(table: Key, column: string) {
  const i = SCHEMA[table].columns.findIndex((c) => c.name === column);
  return POS[table].y + HEADER + i * ROW + ROW / 2;
}
const leftX = (t: Key) => POS[t].x;
const rightX = (t: Key) => POS[t].x + POS[t].w;

const ID = { x: rightX("entities"), y: rowY("entities", "id") };
const ID_LEFT = { x: leftX("entities"), y: rowY("entities", "id") };

const RELATIONS: { d: string; ends: [number, number][]; label?: { x: number; y: number; text: string } }[] = [
  {
    d: `M${leftX("edges")},${rowY("edges", "src_id")} L${ID.x},${ID.y}`,
    ends: [[leftX("edges"), rowY("edges", "src_id")], [ID.x, ID.y]],
  },
  {
    d: `M${leftX("edges")},${rowY("edges", "dst_id")} C${leftX("edges") - 40},${rowY("edges", "dst_id")} ${ID.x + 40},${ID.y} ${ID.x},${ID.y}`,
    ends: [[leftX("edges"), rowY("edges", "dst_id")]],
  },
  {
    d: `M${rightX("edges")},${rowY("edges", "source_doc_id")} C${rightX("edges") + 44},${rowY("edges", "source_doc_id")} ${leftX("documents") - 44},${rowY("documents", "doc_id")} ${leftX("documents")},${rowY("documents", "doc_id")}`,
    ends: [[rightX("edges"), rowY("edges", "source_doc_id")], [leftX("documents"), rowY("documents", "doc_id")]],
  },
  {
    d: `M${leftX("entity_stats")},${rowY("entity_stats", "entity_id")} C${leftX("entity_stats") - 32},${rowY("entity_stats", "entity_id")} ${ID_LEFT.x - 32},${ID_LEFT.y} ${ID_LEFT.x},${ID_LEFT.y}`,
    ends: [[leftX("entity_stats"), rowY("entity_stats", "entity_id")], [ID_LEFT.x, ID_LEFT.y]],
  },
  {
    d: `M${leftX("votes")},${rowY("votes", "member_id")} C${leftX("votes") - 56},${rowY("votes", "member_id")} ${ID.x + 56},${ID.y + 40} ${ID.x},${ID.y}`,
    ends: [[leftX("votes"), rowY("votes", "member_id")]],
  },
];

export function DataModel() {
  return (
    <div className="flex flex-col gap-4">
      <Surface className="overflow-x-auto p-6">
        <div className="relative mx-auto" style={{ width: CANVAS_W, height: CANVAS_H }}>
          <svg
            width={CANVAS_W}
            height={CANVAS_H}
            className="absolute inset-0"
            aria-hidden="true"
          >
            {RELATIONS.map((r, i) => (
              <g key={i}>
                <path d={r.d} fill="none" stroke="var(--teal)" strokeWidth={1.25} />
                {r.ends.map(([x, y], j) => (
                  <circle key={j} cx={x} cy={y} r={3} fill="var(--surface-1)" stroke="var(--teal)" strokeWidth={1.25} />
                ))}
              </g>
            ))}
          </svg>
          {(Object.keys(SCHEMA) as Key[]).map((k) => (
            <TableCard key={k} table={SCHEMA[k]} pos={POS[k]} />
          ))}
        </div>
      </Surface>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MODEL_NOTES.map((n) => (
          <li key={n} className="t-body border-l-2 border-teal pl-4 text-fg-2">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableCard({ table, pos }: { table: SchemaTable; pos: { x: number; y: number; w: number; footer?: string } }) {
  const height = HEADER + table.columns.length * ROW + PAD_B + (pos.footer ? FOOTER : 0);
  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-card border border-line-strong bg-surface-2"
      style={{ left: pos.x, top: pos.y, width: pos.w, height }}
      role="table"
      aria-label={`Table ${table.name}`}
    >
      <div className="flex flex-col justify-center border-b border-line px-3" style={{ height: HEADER }} role="row">
        <span className={cx(MONO, "text-[13.5px] font-semibold text-fg-1")} role="columnheader">
          {table.name}
        </span>
        {table.note ? <span className="t-meta truncate">{table.note}</span> : null}
      </div>
      <div className="flex-1">
        {table.columns.map((c) => (
          <div key={c.name} className="flex items-center gap-2 px-3" style={{ height: ROW }} role="row">
            <span className="w-6 shrink-0 text-[10px] leading-3 font-semibold text-teal-bright" role="cell">
              {c.key === "pk" ? "PK" : c.key === "fk" ? "FK" : ""}
            </span>
            <span className={cx(MONO, "min-w-0 flex-1 truncate", c.key ? "text-fg-1" : "text-fg-2")} role="cell">
              {c.name}
            </span>
            <span className="t-meta" role="cell">
              {c.type}
            </span>
          </div>
        ))}
      </div>
      {pos.footer ? (
        <div className="t-meta flex items-center border-t border-line px-3" style={{ height: FOOTER }}>
          {pos.footer}
        </div>
      ) : null}
    </div>
  );
}
