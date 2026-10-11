/**
 * Public statements (demo fixtures). Each item is a real line, word for word,
 * from a 2026 Senate press release or a news report that quotes a senator
 * (src/data/records/real-records.json; scripts/check-real-records.ts checks the
 * wording, the date, the URL, and the sentiment label).
 *
 * Product rule: these items show beside an answer, never as its citations, and
 * they never feed the graph. Keep them in this file, away from src/data.
 *
 * Sentiment: each label is a reading of the item's own quoted text only (the
 * `quote` field), toward the topic it names. It is not a reading of the person,
 * and it does not predict votes.
 */

/** The tone of a statement toward the topic in its label. */
export type Tone = "supportive" | "critical";

export interface Sentiment {
  /** The chip text: "Supports Ukraine", "Critical of Russia and Iran". */
  label: string;
  tone: Tone;
  /** The tone toward Ukraine, only when the quoted text names Ukraine. */
  ukraine?: Tone;
}

export interface PublicStatement {
  id: string;
  /** The senator quoted (a person id from src/data/entities.ts). */
  personId: string;
  /** The release or report date (ISO yyyy-mm-dd; no time is published). */
  date: string;
  /** A verbatim line from the item. */
  quote: string;
  /** What the item is, as published: "Press release", "Floor remarks reported by Roll Call". */
  kind: string;
  /** The original item. */
  url: string;
  /** The item in the fact base (src/data/records/facts.ts). */
  recordId: string;
  sentiment: Sentiment;
}

export const STATEMENTS: PublicStatement[] = [
  {
    id: "stmt-wicker-0928",
    personId: "wicker",
    date: "2026-09-28",
    quote: "And he has new tools to stop Russia’s “shadow fleet” from evading existing sanctions.",
    kind: "Weekly report column",
    url: "https://www.wicker.senate.gov/2026/09/28/wicker-putin-must-be-defeated/",
    recordId: "stmt:stmt-7",
    sentiment: { label: "Supports Russia sanctions", tone: "supportive" },
  },
  {
    id: "stmt-wicker-0807",
    personId: "wicker",
    date: "2026-08-07",
    quote: "This sanctions bill will help save lives.",
    kind: "Press release",
    url: "https://www.wicker.senate.gov/2026/08/07/chairman-wicker-applauds-passage-of-russia-sanctions-bill-championed-by-sen-lindsey-graham/",
    recordId: "stmt:stmt-5",
    sentiment: { label: "Supports the sanctions bill", tone: "supportive" },
  },
  {
    id: "stmt-wicker-0806",
    personId: "wicker",
    date: "2026-08-06",
    quote: "The United States stands with Poland, Romania, and its NATO allies and will continue to support Ukraine.",
    kind: "Press release",
    url: "https://www.wicker.senate.gov/2026/08/06/chairman-wicker-issues-statement-on-russias-unprecedented-escalation-against-nato-allies/",
    recordId: "stmt:stmt-6",
    sentiment: { label: "Supports Ukraine", tone: "supportive", ukraine: "supportive" },
  },
  {
    id: "stmt-blumenthal-0916",
    personId: "blumenthal",
    date: "2026-09-16",
    quote: "Today is a historic triumph for democracy— ours and Ukraine’s — showing that America can still muster bipartisan unity in the fight for freedom.",
    kind: "Statement reported by Roll Call",
    url: "https://rollcall.com/2026/09/16/robust-house-majority-backs-sanctions-on-russia-and-iran/",
    recordId: "stmt:stmt-3",
    sentiment: { label: "Supports Ukraine", tone: "supportive", ukraine: "supportive" },
  },
  {
    id: "stmt-blumenthal-0807",
    personId: "blumenthal",
    date: "2026-08-07",
    quote: "Today we say to the people of Ukraine, you are not alone.",
    kind: "Floor remarks reported by Roll Call",
    url: "https://rollcall.com/2026/08/07/long-stalled-russia-sanctions-bill-passed-by-senate/",
    recordId: "stmt:stmt-1",
    sentiment: { label: "Supports Ukraine", tone: "supportive", ukraine: "supportive" },
  },
  {
    id: "stmt-cramer-0807",
    personId: "cramer",
    date: "2026-08-07",
    quote: "Moscow, Tehran, and all those who bankroll them have to feel the consequences of the terror they’re inflicting around the world.",
    kind: "Press release",
    url: "https://www.cramer.senate.gov/news/press-releases/senate-approves-sweeping-russia-sanctions-bill",
    recordId: "stmt:stmt-8",
    sentiment: { label: "Critical of Russia and Iran", tone: "critical" },
  },
  {
    id: "stmt-coons-0723",
    personId: "coons",
    date: "2026-07-23",
    quote: "Ukraine is winning on the battlefield against Russian invaders, and there’s much more the United States can do to strangle Russia’s war machine without putting ourselves at risk.",
    kind: "Press release",
    url: "https://www.coons.senate.gov/news/press-releases/senator-coons-blumenthal-graham-colleagues-introduce-landmark-bipartisan-legislation-with-60-cosponsors-to-apply-greater-economic-pressure-on-russian-oil/",
    recordId: "stmt:stmt-9",
    sentiment: { label: "Supports Ukraine", tone: "supportive", ukraine: "supportive" },
  },
  {
    id: "stmt-coons-blumenthal-0723",
    personId: "blumenthal",
    date: "2026-07-23",
    quote: "Sanctions provide a path toward peace.",
    kind: "Quoted in a Coons press release",
    url: "https://www.coons.senate.gov/news/press-releases/senator-coons-blumenthal-graham-colleagues-introduce-landmark-bipartisan-legislation-with-60-cosponsors-to-apply-greater-economic-pressure-on-russian-oil/",
    recordId: "stmt:stmt-4",
    sentiment: { label: "Supports sanctions", tone: "supportive" },
  },
  {
    id: "stmt-shaheen-0811",
    personId: "shaheen",
    date: "2026-08-11",
    quote: "It’s clear that this legislation will deal a decisive blow to the Kremlin’s coffers and would be a boon to Ukraine’s war effort and morale.",
    kind: "Senate Foreign Relations minority release",
    url: "https://www.foreign.senate.gov/press/dem/release/ranking-member-shaheen-celebrates-house-introduction-of-the-lindsey-o-graham-sanctioning-russia-and-iran-act",
    recordId: "stmt:stmt-10",
    sentiment: { label: "Supports Ukraine", tone: "supportive", ukraine: "supportive" },
  },
];

/** The site an item comes from: "wicker.senate.gov", "rollcall.com". */
export const domainOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

/** The heading of the block, and the line under it. */
export const STATEMENTS_HEADING = "Public statements";
export const STATEMENTS_SUBHEAD = "Pulled from public sources";
/** The one footnote under every block of statements. */
export const SENTIMENT_FOOTNOTE = "Sentiment is an AI reading of the statement text. It does not predict votes.";

/**
 * "Tone on Ukraine: supportive (2 of 2 statements)": only when the shown items that name Ukraine
 * all read the same way. Undefined when none names Ukraine or they differ.
 */
export function ukraineToneLine(items: PublicStatement[]): string | undefined {
  const tones = items.map((s) => s.sentiment.ukraine).filter((t): t is Tone => !!t);
  if (!tones.length || tones.some((t) => t !== tones[0])) return undefined;
  return `Tone on Ukraine: ${tones[0]} (${tones.length} of ${items.length} ${items.length === 1 ? "statement" : "statements"})`;
}
