/**
 * A small sample for the /dev/graph test page only. The real fixtures live in
 * src/data/ (owned by the data agent). All people here are fictional.
 */
import { buildCatalog } from "@/lib/catalog";
import type { Edge, Entity, ScriptTurn, SourceDoc } from "@/lib/types";

const entities: Entity[] = [
  { id: "t-ukraine", type: "topic", label: "US stance on Ukraine", icon: "flag-ua" },
  { id: "b-s456", type: "bill", label: "S. 456 · Defense Support Act", icon: "file-text" },
  { id: "b-hr123", type: "bill", label: "H.R. 123 · Ukraine Aid Act", icon: "file-text" },
  { id: "p-hartley", type: "person", label: "Sen. Ellen Hartley", sublabel: "R-OH", initials: "EH" },
  { id: "p-marquez", type: "person", label: "Sen. Isabel Marquez", sublabel: "D-NM", initials: "IM" },
  { id: "p-bellamy", type: "person", label: "Sen. Thomas Bellamy", sublabel: "R-GA", initials: "TB" },
  { id: "p-okafor", type: "person", label: "Sen. Daniel Okafor", sublabel: "D-MD", initials: "DO" },
  { id: "p-whitcomb", type: "person", label: "Sen. Claire Whitcomb", sublabel: "R-NE", initials: "CW" },
  { id: "p-lindqvist", type: "person", label: "Rep. Karin Lindqvist", sublabel: "D-MN", initials: "KL" },
  { id: "p-ferraro", type: "person", label: "Rep. Paul Ferraro", sublabel: "R-PA", initials: "PF" },
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
  { id: "p-renner", type: "person", label: "Graham Renner", sublabel: "Meridian Public Affairs", initials: "GR" },
  { id: "p-osei", type: "person", label: "Abena Osei", sublabel: "Halvorsen Dynamics", initials: "AO" },
  { id: "p-castellano", type: "person", label: "Luca Castellano", sublabel: "Atlantic Policy Forum", initials: "LC" },
  { id: "o-meridian", type: "org", label: "Meridian Public Affairs", sublabel: "Lobbying firm", icon: "building-2" },
  { id: "o-halvorsen", type: "org", label: "Halvorsen Dynamics", sublabel: "Defense contractor", icon: "factory" },
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
    title: "LDA Q2 2026 report: Meridian Public Affairs",
    date: "2026-07-20",
    excerpt: "Lobbying contacts with the office of Sen. Ellen Hartley on defense support appropriations.",
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
      "Two bills sit at the center of the US stance on Ukraine: S. 456, the Defense Support Act, and H.R. 123, the Ukraine Aid Act. Click a bill to see its supporters.",
    citations: ["src-1"],
    suggestions: ["Who supports S. 456?"],
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
    answer: "Five senators support S. 456. Sen. Ellen Hartley (R-OH) is the sponsor.",
    citations: ["src-1"],
    suggestions: ["Explore Sen. Ellen Hartley"],
  },
  {
    id: "person",
    trigger: { nodeClick: "p-hartley", keywords: ["hartley"] },
    steps: [
      {
        label: "Open categories for Sen. Ellen Hartley",
        delta: {
          add: { entities: edgesFrom("p-hartley").map((x) => x.target), edges: ids(edgesFrom("p-hartley")) },
          focus: "p-hartley",
          expand: "p-hartley",
        },
      },
    ],
    answer: "Sen. Ellen Hartley has 6 votes, 3 trips, 5 meetings, 4 contributions, 3 opinions, and 2 other records.",
    citations: ["src-1", "src-2"],
    suggestions: ["Show Hartley's meetings"],
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
      "Graham Renner of Meridian Public Affairs, Abena Osei of Halvorsen Dynamics, and Luca Castellano of the Atlantic Policy Forum attended the private meeting.",
    citations: ["src-1", "src-2"],
    suggestions: ["What did Meridian lobby on?"],
  },
];
