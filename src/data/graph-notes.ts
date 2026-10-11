/**
 * Notes on the Explore graph: one short note per answer, anchored next to what
 * it refers to. A note shows when the graph's focus is `focus` and every record
 * it names is on the graph. Notes state dates and links only (never a cause):
 * every number and date in the text is filled in from the records
 * (`{start}`, `{end}`, `{count}`, `{total}`, `{weeks}`), and `check.ts`
 * verifies each claim against the data.
 */
export type GraphNoteSpec =
  /** The dates a ring's records span (the dial marks the span). */
  | { id: string; kind: 'span'; focus: string; ring: string; text: string }
  /**
   * The busiest stretch of `months` calendar months in the center person's
   * records. Shows only when one stretch is the clear busiest (no tie) and holds
   * at least `minShare` of the records.
   */
  | { id: string; kind: 'stretch'; focus: string; months: number; minShare: number; text: string }
  /** A link between two records on screen (`edge` is the record behind it). */
  | { id: string; kind: 'link'; focus: string; from: string; to: string; edge: string; text: string }
  /** Records on different rings, joined in date order; each point's chip shows its date. */
  | { id: string; kind: 'timing'; focus: string; points: { edge: string; label?: string }[]; text: string };

export const graphNotes: GraphNoteSpec[] = [
  {
    id: 'principal-link',
    kind: 'link',
    focus: 'contact-ua-0609',
    from: 'moran',
    to: 'ua-ministry',
    edge: 'moran-ua-ministry',
    text: 'Registered as its principal Sep 24, 2023 to Jan 31, 2025',
  },
];
