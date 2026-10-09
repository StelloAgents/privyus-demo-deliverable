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
    id: 'cosponsor-span',
    kind: 'span',
    focus: 's456',
    ring: 'cosponsors',
    text: 'Cosponsors joined between {start} and {end}',
  },
  {
    id: 'busiest-stretch',
    kind: 'stretch',
    focus: 'hartley',
    months: 3,
    minShare: 0.3,
    text: '{count} of {total} records fall between {start} and {end}',
  },
  {
    id: 'aegis-link',
    kind: 'link',
    focus: 'meeting-private',
    from: 'attendee-aegis',
    to: 'aegis',
    edge: 'aegis-cat-contributions',
    text: 'Aegis Systems also appears in her contributions',
  },
  {
    id: 'contribution-vote-meeting',
    kind: 'timing',
    focus: 'cat-contributions',
    points: [
      { edge: 'aegis-cat-contributions' },
      { edge: 'cat-votes-vote-s456', label: 'S. 456 vote' },
      { edge: 'cat-meetings-meeting-private', label: 'Private meeting' },
    ],
    text: 'Contribution, vote, and meeting within {weeks} weeks',
  },
];
