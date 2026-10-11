/**
 * A small sample for the /dev/graph test page only. The real fixtures live in
 * src/data/ (owned by the data agent). Placeholder names only (Member A, Contact H): not real people.
 */
import { buildCatalog } from "@/lib/catalog";
import type { Edge, Entity, ScriptTurn, SourceDoc } from "@/lib/types";

const entities: Entity[] = [
  { id: "t-ukraine", type: "topic", label: "US stance on Ukraine", icon: "flag-ua" },
  { id: "b-s456", type: "bill", label: "S. 0001 · Sample Senate Bill", icon: "file-text" },
  { id: "b-hr123", type: "bill", label: "H.R. 0002 · Sample House Bill", icon: "file-text" },
  { id: "p-hartley", type: "person", label: "Sen. Member A", sublabel: "R-OH", initials: "MA" },
  { id: "p-marquez", type: "person", label: "Sen. Member B", sublabel: "D-NM", initials: "MB" },
  { id: "p-bellamy", type: "person", label: "Sen. Member C", sublabel: "R-GA", initials: "MC" },
  { id: "p-okafor", type: "person", label: "Sen. Member D", sublabel: "D-MD", initials: "MD" },
  { id: "p-whitcomb", type: "person", label: "Sen. Member E", sublabel: "R-NE", initials: "ME" },
  { id: "p-lindqvist", type: "person", label: "Rep. Member F", sublabel: "D-MN", initials: "MF" },
  { id: "p-ferraro", type: "person", label: "Rep. Member G", sublabel: "R-PA", initials: "MG" },
  { id: "c-votes", type: "category", label: "Votes", sublabel: "6", categoryOf: "p-hartley" },
  { id: "c-trips", type: "category", label: "Trips", sublabel: "3", categoryOf: "p-hartley" },
  { id: "c-meetings", type: "category", label: "Meetings", sublabel: "5", categoryOf: "p-hartley" },
  { id: "c-contrib", type: "category", label: "Contributions", sublabel: "4", categoryOf: "p-hartley" },
  { id: "c-opinions", type: "category", label: "Opinions", sublabel: "3", categoryOf: "p-hartley" },
  { id: "c-others", type: "category", label: "Others", sublabel: "2", categoryOf: "p-hartley" },
  { id: "d-private", type: "detail", label: "Private meeting", sublabel: "Jun 17, 2026", icon: "users" },
  { id: "d-meridian-brief", type: "detail", label: "Policy briefing", sublabel: "Apr 9, 2026", icon: "briefcase" },
  { id: "d-embassy", type: "detail", label: "Embassy delegation", sublabel: "Apr 22, 2026", icon: "landmark" },
  { id: "d-kyiv", type: "detail", label: "Kyiv", sublabel: "Mar 2026", icon: "plane" },
  { id: "d-contrib-1", type: "detail", label: "$25,000", sublabel: "Aug 2025", icon: "circle-dollar-sign" },
  { id: "p-renner", type: "person", label: "Contact H", sublabel: "Sample Lobbying Firm", initials: "CH" },
  { id: "p-osei", type: "person", label: "Contact J", sublabel: "Sample Contractor", initials: "CJ" },
  { id: "p-castellano", type: "person", label: "Contact K", sublabel: "Sample Think Tank", initials: "CK" },
  { id: "o-meridian", type: "org", label: "Sample Lobbying Firm", sublabel: "Lobbying firm", icon: "building-2" },
  { id: "o-halvorsen", type: "org", label: "Sample Contractor", sublabel: "Defense contractor", icon: "factory" },
];

const e = (source: string, target: string, label: string, date?: string): Edge => ({
  id: `${source}__${target}`,
  source,
  target,
  label,
  date,
  sourceIds: ["src-1"],
});

const edges: Edge[] = [
  e("t-ukraine", "b-s456", "addresses"),
  e("t-ukraine", "b-hr123", "addresses"),
  e("b-s456", "p-hartley", "sponsored", "2026-02-11"),
  e("b-s456", "p-marquez", "cosponsored"),
  e("b-s456", "p-bellamy", "cosponsored"),
  e("b-s456", "p-okafor", "cosponsored"),
  e("b-s456", "p-whitcomb", "cosponsored"),
  e("b-hr123", "p-lindqvist", "sponsored"),
  e("b-hr123", "p-ferraro", "cosponsored"),
  e("p-hartley", "c-votes", "votes"),
  e("p-hartley", "c-trips", "trips"),
  e("p-hartley", "c-meetings", "meetings"),
  e("p-hartley", "c-contrib", "contributions"),
  e("p-hartley", "c-opinions", "opinions"),
  e("p-hartley", "c-others", "others"),
  e("c-meetings", "d-private", "private meeting", "2026-06-17"),
  e("c-meetings", "d-meridian-brief", "met with"),
  e("c-meetings", "d-embassy", "met with"),
  e("c-trips", "d-kyiv", "traveled to"),
  e("c-contrib", "d-contrib-1", "received"),
  e("d-private", "p-renner", "attended"),
  e("d-private", "p-osei", "attended"),
  e("d-private", "p-castellano", "attended"),
  e("p-renner", "o-meridian", "works at"),
  e("p-osei", "o-halvorsen", "works at"),
];

const sources: SourceDoc[] = [
  {
    id: "src-1",
    kind: "LDA",
    title: "LDA Q2 2026 report: Sample Lobbying Firm",
    date: "2026-07-20",
    excerpt: "Lobbying contacts with the office of Sen. Member A on defense support appropriations.",
  },
  {
    id: "src-2",
    kind: "FARA",
    title: "FARA supplemental statement #6843",
    date: "2026-05-02",
    excerpt: "Registrant reports a meeting with Senate staff on security assistance.",
  },
];

export const sampleCatalog = buildCatalog({ entities, edges, sources });

const ids = (list: Edge[]) => list.map((x) => x.id);
const edgesFrom = (source: string) => edges.filter((x) => x.source === source);

export const sampleTurns: ScriptTurn[] = [
  {
    id: "build",
    trigger: { question: "What is the United States' stance on Ukraine?", keywords: ["ukraine", "stance"] },
    steps: [
      { label: "Set root node: Ukraine", delta: { add: { entities: ["t-ukraine"], edges: [] } } },
      { label: "Query the database", delta: { add: { entities: [], edges: [] } } },
      { label: "Populate related bills", delta: { add: { entities: ["b-s456", "b-hr123"], edges: [] } } },
      { label: "Establish connections", delta: { add: { entities: [], edges: ids(edgesFrom("t-ukraine")) } } },
      { label: "Render", delta: { add: { entities: [], edges: [] } } },
    ],
    answer:
      "Two bills sit at the center of the US stance on Ukraine: S. 0001 and H.R. 0002, two sample bills. Click a bill to see its supporters.",
    citations: ["src-1"],
    suggestions: ["Who supports S. 0001?"],
  },
  {
    id: "bill",
    trigger: { nodeClick: "b-s456", keywords: ["s. 456", "defense support"] },
    steps: [
      {
        label: "Find supporting members",
        delta: {
          add: { entities: edgesFrom("b-s456").map((x) => x.target), edges: ids(edgesFrom("b-s456")) },
          focus: "b-s456",
          expand: "b-s456",
        },
      },
    ],
    answer: "Five senators support S. 0001. Sen. Member A (R-OH) is the sponsor.",
    citations: ["src-1"],
    suggestions: ["Explore Sen. Member A"],
  },
  {
    id: "person",
    trigger: { nodeClick: "p-hartley", keywords: ["hartley"] },
    steps: [
      {
        label: "Open categories for Sen. Member A",
        delta: {
          add: { entities: edgesFrom("p-hartley").map((x) => x.target), edges: ids(edgesFrom("p-hartley")) },
          focus: "p-hartley",
          expand: "p-hartley",
        },
      },
    ],
    answer: "Sen. Member A has 6 votes, 3 trips, 5 meetings, 4 contributions, 3 opinions, and 2 other records.",
    citations: ["src-1", "src-2"],
    suggestions: ["Show Member A's meetings"],
  },
  {
    id: "meetings",
    trigger: { nodeClick: "c-meetings", keywords: ["meetings"] },
    steps: [
      {
        label: "Load meetings",
        delta: {
          add: { entities: edgesFrom("c-meetings").map((x) => x.target), edges: ids(edgesFrom("c-meetings")) },
          focus: "c-meetings",
          expand: "c-meetings",
        },
      },
    ],
    answer: "Five meetings are on record. One private meeting on Jun 17, 2026 had 3 other attendees.",
    citations: ["src-2"],
    suggestions: ["Who attended the private meeting?"],
  },
  {
    id: "private",
    trigger: { nodeClick: "d-private", keywords: ["private meeting", "attended"] },
    steps: [
      {
        label: "Load attendees",
        delta: {
          add: {
            entities: ["p-renner", "p-osei", "p-castellano", "o-meridian"],
            edges: ids(edgesFrom("d-private")).concat("p-renner__o-meridian"),
          },
          focus: "d-private",
          expand: "d-private",
        },
      },
    ],
    answer:
      "Contact H of Sample Lobbying Firm, Contact J of Sample Contractor, and Contact K of the Sample Think Tank attended the private meeting.",
    citations: ["src-1", "src-2"],
    suggestions: ["What did Sample Firm lobby on?"],
  },
];
