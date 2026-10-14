import { entities, edges, MORAN_UA_NETWORK, MORAN_UA_SHARED_DATES, uaContactSource, uaDayId } from './entities';
import { sources } from './sources';
import { script } from './script';
import { dashboard } from './dashboard';
import { votes, senateSeats, houseStateVotes } from './votes';
import { states } from './geo';
import { graphNotes } from './graph-notes';

const errors: string[] = [];
const unique = (name: string, values: { id: string }[]) => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) errors.push(`${name}: duplicate id ${value.id}`);
    seen.add(value.id);
  }
  return seen;
};
const entityIds = unique('entity', entities);
const edgeIds = unique('edge', edges);
const sourceIds = unique('source', sources);
unique('turn', script);
unique('KPI', dashboard.kpis);
unique('watchlist', dashboard.watchlist);
unique('radar', dashboard.radar);
unique('activity', dashboard.activity);
unique('checkpoint', dashboard.checkpoints);
const requireId = (set: Set<string>, id: string, where: string) => { if (!set.has(id)) errors.push(`${where}: missing ${id}`); };
const validDate = (date: string, where: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date < '2023-01-01' || date > '2026-10-10') errors.push(`${where}: invalid date ${date}`);
};
for (const entity of entities) {
  if (/Barakat|Max|Lindsey|Graham/i.test(entity.label)) errors.push(`entity ${entity.id}: forbidden label`);
  if (entity.categoryOf) {
    requireId(entityIds, entity.categoryOf, `entity ${entity.id} categoryOf`);
    if (entities.find(item => item.id === entity.categoryOf)?.type !== 'person') errors.push(`entity ${entity.id}: categoryOf must be a person`);
  }
  if (entity.type === 'person' && !entity.initials) errors.push(`person ${entity.id}: missing initials`);
}
for (const edge of edges) {
  requireId(entityIds, edge.source, `edge ${edge.id} source`);
  requireId(entityIds, edge.target, `edge ${edge.id} target`);
  const source = entities.find(entity => entity.id === edge.source);
  const target = entities.find(entity => entity.id === edge.target);
  if ((source?.type === 'org' && /PAC/.test(source.sublabel ?? '') && target?.type === 'person') ||
      (target?.type === 'org' && /PAC/.test(target.sublabel ?? '') && source?.type === 'person')) errors.push(`edge ${edge.id}: PAC connected straight to a person (use a contribution record)`);
  if (!edge.sourceIds.length) errors.push(`edge ${edge.id}: no sources`);
  for (const id of edge.sourceIds) requireId(sourceIds, id, `edge ${edge.id} sourceIds`);
  if (edge.date) validDate(edge.date, `edge ${edge.id}`);
}
const entitiesByIdMap = new Map(entities.map(entity => [entity.id, entity]));
function entitiesById(id: string) { return entitiesByIdMap.get(id); }
const categoryParents = new Map<string, Set<string>>();
for (const edge of edges) {
  if (entitiesById(edge.source)?.type !== 'category' || entitiesById(edge.target)?.type !== 'detail') continue;
  const parents = categoryParents.get(edge.target) ?? new Set<string>();
  parents.add(edge.source);
  categoryParents.set(edge.target, parents);
}
const labelsByParent = new Map<string, Map<string, string>>();
for (const entity of entities) {
  const parents = entity.categoryOf ? [entity.categoryOf] : [...(categoryParents.get(entity.id) ?? [])];
  for (const parent of parents) {
    const labels = labelsByParent.get(parent) ?? new Map<string, string>();
    const previous = labels.get(entity.label);
    if (previous && previous !== entity.id) errors.push(`parent ${parent}: duplicate label ${entity.label} (${previous}, ${entity.id})`);
    labels.set(entity.label, entity.id);
    labelsByParent.set(parent, labels);
  }
}
for (const source of sources) validDate(source.date, `source ${source.id}`);
for (const turn of script) {
  if (!!turn.trigger.nodeClick === !!turn.trigger.question) errors.push(`turn ${turn.id}: expected one trigger type`);
  if (turn.trigger.nodeClick) requireId(entityIds, turn.trigger.nodeClick, `turn ${turn.id} nodeClick`);
  if (turn.steps.length < 3 || turn.steps.length > 6) errors.push(`turn ${turn.id}: expected 3–6 steps`);
  if (!turn.steps.at(-1)?.delta.focus) errors.push(`turn ${turn.id}: last step missing focus`);
  if (turn.answer.split(/(?<=[.!?])\s+/).length < 2) errors.push(`turn ${turn.id}: answer too short`);
  for (const [index, step] of turn.steps.entries()) {
    const where = `turn ${turn.id} step ${index + 1}`;
    for (const id of step.delta.add.entities) requireId(entityIds, id, `${where} entity`);
    for (const id of step.delta.add.edges) requireId(edgeIds, id, `${where} edge`);
    for (const id of step.delta.ghost?.entities ?? []) requireId(entityIds, id, `${where} ghost entity`);
    for (const id of step.delta.ghost?.edges ?? []) requireId(edgeIds, id, `${where} ghost edge`);
    if (step.delta.focus) requireId(entityIds, step.delta.focus, `${where} focus`);
    if (step.delta.expand) requireId(entityIds, step.delta.expand, `${where} expand`);
  }
  for (const id of turn.citations) requireId(sourceIds, id, `turn ${turn.id} citation`);
}
const opening = script.find(turn => turn.id === 'ukraine-stance');
if (opening) {
  const laterTurns = script.slice(script.indexOf(opening) + 1);
  const laterEntities = new Set(laterTurns.flatMap(turn => turn.steps.flatMap(step => step.delta.add.entities)));
  const laterEdges = new Set(laterTurns.flatMap(turn => turn.steps.flatMap(step => step.delta.add.edges)));
  for (const step of opening.steps) {
    for (const id of step.delta.ghost?.entities ?? []) if (!laterEntities.has(id)) errors.push(`ukraine-stance ghost entity ${id}: never added later`);
    for (const id of step.delta.ghost?.edges ?? []) if (!laterEdges.has(id)) errors.push(`ukraine-stance ghost edge ${id}: never added later`);
  }
}
const members = entities.filter(entity => entity.type === 'person' && /^(Sen\.|Rep\.)/.test(entity.label));
const senators = members.filter(member => member.label.startsWith('Sen.'));
if (senators.length !== 19) errors.push(`expected 19 senators, got ${senators.length}`);
// The firm's Ukraine-principal network adds House members (14), a former senator, staff (4), and press (1).
const house = members.filter(member => member.label.startsWith('Rep.'));
if (house.length !== 14 || house.some(member => member.group !== 'house')) errors.push(`expected 14 House members, got ${house.length}`);
const people = entities.filter(entity => entity.type === 'person');
const personIds = new Set(people.map(person => person.id));
for (const person of people) if (!/^(Sen\.|Rep\.)/.test(person.label) && !person.group) errors.push(`person ${person.id}: not a member, so it needs a group (senate, staff, or press)`);
const orgCounts = [/FARA registrant/, /FARA foreign principal/, /Corporate PAC/].map(kind => entities.filter(entity => entity.type === 'org' && kind.test(entity.sublabel ?? '')).length);
if (orgCounts.join(',') !== '1,1,5') errors.push(`expected 1/1/5 organizations (registrant/principal/PACs), got ${orgCounts.join('/')}`);
const expectedCategoryCounts: Record<string, number> = { Votes: 8, Trips: 1, Contacts: 1, Contributions: 0, Statements: 3, Others: 1 };
const categories = entities.filter(entity => entity.type === 'category' && entity.categoryOf === 'wicker');
if (categories.length !== 6) errors.push(`expected six Wicker categories, got ${categories.length}`);
for (const category of categories) {
  const children = edges.filter(edge => edge.source === category.id && entities.find(entity => entity.id === edge.target)?.type === 'detail');
  if (children.length !== expectedCategoryCounts[category.label]) errors.push(`${category.label}: expected ${expectedCategoryCounts[category.label]} detail children, got ${children.length}`);
}
if (edges.filter(edge => edge.target === 'cat-contributions' && entitiesById(edge.source)?.type === 'org').length !== 5) errors.push('contributions: expected five PACs');
if (!edges.some(edge => edge.source === 'contact-ua-0609' && edge.target === 'moran')) errors.push('June 9 contact: expected the registrant link');
if (!edges.some(edge => edge.source === 'moran' && edge.target === 'ua-ministry')) errors.push('registrant: expected the foreign principal link');
// Notes on the Explore graph: every date, count, and link they state comes from the records.
/** The busiest two months of Wicker's records (the stretch note); review the note if this changes. */
const STRETCH = { start: '2024-06-01', count: 6, total: 23 };
{
  const monthOf = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  const dayOf = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
  const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  for (const note of graphNotes) {
    const where = `graph note ${note.id}`;
    requireId(entityIds, note.focus, `${where} focus`);
    if (/\{(?!start\}|end\}|count\}|total\}|weeks\})/.test(note.text)) errors.push(`${where}: unknown placeholder`);
    if (note.kind === 'span') {
      const dates = edges.filter(edge => edge.source === note.focus && /cosponsor/.test(edge.label) && edge.date).map(edge => edge.date!).sort();
      if (dates.length < 2 || dates[0] === dates.at(-1)) errors.push(`${where}: a span note needs records on different dates`);
      void LONG;
    }
    if (note.kind === 'stretch') {
      const person = note.focus;
      const cats = new Set(entities.filter(entity => entity.categoryOf === person).map(entity => entity.id));
      const months = edges.filter(edge => edge.date && ((cats.has(edge.source) && edge.target !== person) || (cats.has(edge.target) && edge.source !== person))).map(edge => monthOf(edge.date!));
      const lo = Math.min(...months);
      const hi = Math.max(...months);
      const runs = [];
      for (let m0 = lo; m0 + note.months - 1 <= hi; m0++) runs.push({ m0, count: months.filter(m => m >= m0 && m < m0 + note.months).length });
      const best = Math.max(...runs.map(run => run.count));
      const top = runs.filter(run => run.count === best);
      if (top.length !== 1) errors.push(`${where}: no single busiest stretch`);
      else if (best / months.length < note.minShare) errors.push(`${where}: busiest stretch holds ${best} of ${months.length}, under ${note.minShare}`);
      else if (top[0].m0 !== monthOf(STRETCH.start) || best !== STRETCH.count || months.length !== STRETCH.total) errors.push(`${where}: busiest stretch changed (${best} of ${months.length} from month ${top[0].m0}); review the note`);
    }
    if (note.kind === 'link') {
      const edge = edgeById.get(note.edge);
      const from = entitiesById(note.from);
      const to = entitiesById(note.to);
      if (!edge || !from || !to) errors.push(`${where}: missing records`);
      else if (![edge.source, edge.target].includes(note.from) || ![edge.source, edge.target].includes(note.to)) errors.push(`${where}: ${note.edge} does not join ${note.from} and ${note.to}`);
      else if (note.id === 'principal-link') {
        // "Registered as its principal Sep 24, 2023 to Jan 31, 2025": the FARA bulk record.
        const principal = sources.find(source => source.id === 'fara-principal-ukraine');
        if (edge.date !== '2023-09-24' || !principal?.excerpt.includes('Registered 09/24/2023 · Terminated 01/31/2025')) errors.push(`${where}: registration dates changed; review the note`);
      }
    }
    if (note.kind === 'timing') {
      const dates = note.points.map(point => edgeById.get(point.edge)?.date);
      if (dates.some(date => !date)) errors.push(`${where}: every point needs a dated record`);
      else {
        const sorted = [...dates as string[]].sort();
        const weeks = Math.ceil((dayOf(sorted.at(-1)!) - dayOf(sorted[0])) / 7);
        if (/\{weeks\}/.test(note.text) && weeks < 1) errors.push(`${where}: records span ${weeks} weeks`);
      }
    }
  }
}
if (dashboard.greeting !== 'What can I help you solve today?') errors.push('dashboard: expected the greeting headline');
for (const [name, values, expected] of [['KPIs', dashboard.kpis, 3], ['watchlist', dashboard.watchlist, 4], ['radar', dashboard.radar, 3], ['activity', dashboard.activity, 12], ['checkpoints', dashboard.checkpoints, 3]] as const) {
  if (values.length !== expected) errors.push(`dashboard: expected ${expected} ${name}, got ${values.length}`);
}
for (const kpi of dashboard.kpis) if (kpi.series.length !== 12) errors.push(`KPI ${kpi.id}: expected 12 points`);
for (const item of dashboard.watchlist) {
  requireId(entityIds, item.entityId, `watchlist ${item.id}`);
  if (item.kind === 'person' && entities.find(entity => entity.id === item.entityId)?.type !== 'person') errors.push(`watchlist ${item.id}: expected person`);
}
for (const item of dashboard.radar) if (item.entityId) requireId(entityIds, item.entityId, `radar ${item.id}`);
for (const item of dashboard.activity) {
  validDate(item.date, `activity ${item.id}`);
  if (item.entityId) requireId(entityIds, item.entityId, `activity ${item.id}`);
}
for (const item of dashboard.checkpoints) {
  validDate(item.date, `checkpoint ${item.id}`);
  requireId(entityIds, item.entityId, `checkpoint ${item.id}`);
}
const memberIds = new Set(members.map(member => member.id));
for (const source of sources) {
  for (const id of source.subjectIds ?? []) requireId(entityIds, id, `source ${source.id} subjectIds`);
  if (/\bBarakat\b|\bMax\b/.test(`${source.title} ${source.excerpt}`)) errors.push(`source ${source.id}: forbidden name`);
  if (/Graham/.test(source.title)) errors.push(`source ${source.id}: title names Graham (only verbatim excerpts may)`);
}
const memberCounts = new Map(senators.map(member => [member.id, sources.filter(source => source.subjectIds?.includes(member.id)).length]));
// Everyone else in the network: at least one cited record.
for (const person of people.filter(p => !senators.includes(p))) if (!sources.some(source => source.subjectIds?.includes(person.id))) errors.push(`person ${person.id}: no source names this person`);
for (const [id, count] of memberCounts) if (count < 3 || count > 40) errors.push(`member ${id}: expected 3–40 sources, got ${count}`);
// Shared contact dates: one record per date on which the firm lists two or more people (a staffer
// and the member the row names as employer count once), joined to each of them by that person's row.
{
  const sourceById = new Map(sources.map(source => [source.id, source]));
  for (const [date, people] of MORAN_UA_SHARED_DATES) {
    const where = `shared date ${date}`;
    const id = uaDayId(date);
    requireId(entityIds, id, where);
    if (entitiesById(id)?.type !== 'detail') errors.push(`${where}: ${id} must be a record (detail)`);
    if (people.length < 2) errors.push(`${where}: fewer than two people`);
    for (const person of people) {
      requireId(personIds, person, `${where} person`);
      if (!MORAN_UA_NETWORK.some(([p, ds]) => p === person && ds.includes(date))) errors.push(`${where}: the filing does not list ${person} on ${date}`);
      const edge = edges.find(e => e.id === `${id}-${person}`);
      if (!edge || edge.source !== id || edge.target !== person || edge.date !== date) errors.push(`${where}: missing or wrong edge to ${person}`);
      else if (edge.sourceIds.join() !== uaContactSource(person, date)) errors.push(`${where}: edge to ${person} must cite that person's row`);
      const row = sourceById.get(uaContactSource(person, date));
      if (!row?.subjectIds?.includes(person) || row.date !== date) errors.push(`${where}: row ${uaContactSource(person, date)} does not name ${person} on ${date}`);
    }
    // Every person the filing lists on the date is on the record.
    for (const [p, ds] of MORAN_UA_NETWORK) if (ds.includes(date) && !people.includes(p)) errors.push(`${where}: misses ${p}`);
  }
  const dayEntities = entities.filter(e => e.id.startsWith('ua-day-'));
  if (dayEntities.length !== MORAN_UA_SHARED_DATES.length) errors.push(`shared dates: ${dayEntities.length} records, expected ${MORAN_UA_SHARED_DATES.length}`);
}
if (sources.filter(source => source.kind === 'FARA').length < 5) errors.push('sources: expected at least 5 FARA records');
for (const vote of votes) {
  const where = `vote ${vote.billId}`;
  requireId(entityIds, vote.billId, `${where} billId`);
  requireId(sourceIds, vote.sourceId, `${where} sourceId`);
  if (sources.find(source => source.id === vote.sourceId)?.kind !== 'CONGRESS') errors.push(`${where}: source must be CONGRESS`);
  validDate(vote.date, where);
  if (vote.seats !== (vote.chamber === 'senate' ? 100 : 435)) errors.push(`${where}: seats do not match chamber`);
  if (vote.yes + vote.no + vote.notVoting + (vote.notOnRoll ?? 0) !== vote.seats) errors.push(`${where}: tally does not equal ${vote.seats}`);
  const prefix = vote.chamber === 'senate' ? 'Sen.' : 'Rep.';
  for (const id of vote.memberIds) {
    if (!memberIds.has(id)) errors.push(`${where}: ${id} is not a member`);
    else if (!entitiesById(id)?.label.startsWith(prefix)) errors.push(`${where}: ${id} not in ${vote.chamber}`);
  }
}

// Vote map and seat chart data
const apportionment: Record<string, number> = { AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1 };
const stateCodes = Object.keys(apportionment);
if (stateCodes.length !== 50) errors.push(`apportionment: expected 50 states, got ${stateCodes.length}`);
const centroidCodes = new Set(states.map(state => state.code));
const fiftyStates = states.filter(state => !state.district);
if (fiftyStates.length !== 50 || new Set(fiftyStates.map(state => state.code)).size !== 50) errors.push(`geo: expected 50 unique states, got ${fiftyStates.length}`);
if (centroidCodes.size !== states.length) errors.push('geo: duplicate state code');
for (const state of states) if (state.district && state.code !== 'DC') errors.push(`geo ${state.code}: only DC may be flagged district`);
for (const code of stateCodes) if (!centroidCodes.has(code)) errors.push(`geo: missing centroid for ${code}`);
for (const state of states) {
  if (!state.district && !(state.code in apportionment)) errors.push(`geo: unknown state ${state.code}`);
  if (!state.name || state.lat < 18 || state.lat > 72 || state.lng < -180 || state.lng > -66) errors.push(`geo ${state.code}: bad name or centroid`);
}
// Organization home states and source map connections
const partyOf = (id: string) => entitiesById(id)?.sublabel?.split('-')[0];
const stateOf = (id: string) => entitiesById(id)?.sublabel?.split('-')[1];
for (const entity of entities) {
  if (entity.type === 'org' && !entity.hqState && !/foreign principal/.test(entity.sublabel ?? '')) errors.push(`org ${entity.id}: missing hqState`);
  if (entity.hqState && !centroidCodes.has(entity.hqState)) errors.push(`entity ${entity.id}: hqState ${entity.hqState} not in geo`);
  if (entity.hqState && entity.type !== 'org') errors.push(`entity ${entity.id}: hqState only allowed on orgs`);
}
const memberState = (id: string) => (memberIds.has(id) ? stateOf(id) : undefined);
for (const source of sources) {
  const where = `source ${source.id} geo`;
  const subjects = source.subjectIds ?? [];
  const memberStates = new Set(subjects.map(memberState).filter((code): code is string => !!code));
  const orgStates = new Set(subjects.map(id => entitiesById(id)).filter(entity => entity?.type === 'org').map(entity => entity!.hqState!));
  const geo = source.geo;
  if (memberStates.size && !geo?.to) errors.push(`${where}: member subject but no to`);
  if (!geo) continue;
  for (const code of [geo.from, geo.to]) if (code && !centroidCodes.has(code)) errors.push(`${where}: unknown code ${code}`);
  if (geo.to && !memberStates.has(geo.to)) errors.push(`${where}: to ${geo.to} is not a member state in subjectIds`);
  if (source.kind === 'FEC' && (!geo.from || !orgStates.has(geo.from))) errors.push(`${where}: FEC from must be a contributor org hqState`);
  if ((source.kind === 'LDA' || source.kind === 'FARA') && geo.to && !orgStates.has(geo.from ?? '')) errors.push(`${where}: ${source.kind} from must be the registrant's hqState`);
  if (source.kind === 'DISCLOSURE' && geo.from && geo.from !== 'DC' && !orgStates.has(geo.from)) errors.push(`${where}: DISCLOSURE from must be DC or an org hqState`);
  if (['TRAVEL', 'CONGRESS', 'STATEMENT'].includes(source.kind) && geo.from) errors.push(`${where}: ${source.kind} must be to-only`);
}
const senateVote = votes.find(vote => vote.chamber === 'senate');
const houseVote = votes.find(vote => vote.chamber === 'house');
if (!senateVote) errors.push('senate seats: missing the senate tally');
else {
  if (senateSeats.length !== 100) errors.push(`senate seats: expected 100, got ${senateSeats.length}`);
  const seatIds = new Set(senateSeats.map(seat => seat.seatId));
  if (seatIds.size !== senateSeats.length) errors.push('senate seats: duplicate seatId');
  const count = (pred: (seat: typeof senateSeats[number]) => boolean) => senateSeats.filter(pred).length;
  const tally = [count(s => s.vote === 'yes'), count(s => s.vote === 'no'), count(s => s.vote === 'nv')];
  if (tally.join() !== [senateVote.yes, senateVote.no, senateVote.notVoting].join()) errors.push(`senate seats: tally ${tally.join('/')} does not match ${senateVote.yes}/${senateVote.no}/${senateVote.notVoting}`);
  const parties = [count(s => s.party === 'R'), count(s => s.party === 'D'), count(s => s.party === 'I')];
  if (parties.join() !== '53,45,2') errors.push(`senate seats: expected 53/45/2 R/D/I, got ${parties.join('/')}`);
  for (const code of stateCodes) if (count(s => s.state === code) !== 2) errors.push(`senate seats: ${code} needs exactly 2 seats`);
  for (const seat of senateSeats) if (!(seat.state in apportionment)) errors.push(`senate seat ${seat.seatId}: unknown state`);
  const named = senateSeats.filter(seat => seat.memberId);
  if (named.length !== senateVote.memberIds.length || !senateVote.memberIds.every(id => named.some(seat => seat.memberId === id))) errors.push('senate seats: named members must be exactly the members of the tally');
  for (const seat of named) {
    const id = seat.memberId!;
    if (partyOf(id) !== seat.party || stateOf(id) !== seat.state) errors.push(`senate seat ${seat.seatId}: ${id} party/state does not match entities`);
  }
}
if (!houseVote) errors.push('house votes: missing the house tally');
else {
  const sum = (pick: (row: typeof houseStateVotes[number]) => number) => houseStateVotes.reduce((total, row) => total + pick(row), 0);
  const parties = ['R', 'D', 'I'] as const;
  if (houseStateVotes.length !== 50 || new Set(houseStateVotes.map(row => row.state)).size !== 50) errors.push(`house votes: expected 50 unique states, got ${houseStateVotes.length}`);
  for (const row of houseStateVotes) {
    if (row.seats > apportionment[row.state]) errors.push(`house ${row.state}: ${row.seats} members exceed apportionment ${apportionment[row.state]}`);
    const filled = parties.reduce((total, party) => total + (row.byParty[party] ? row.byParty[party]!.yes + row.byParty[party]!.no + row.byParty[party]!.nv : 0), 0);
    if (filled !== row.seats) errors.push(`house ${row.state}: party votes ${filled} do not equal ${row.seats} members`);
    for (const party of parties) for (const value of Object.values(row.byParty[party] ?? {})) if (!Number.isInteger(value) || value < 0) errors.push(`house ${row.state}: bad count`);
  }
  if (sum(row => row.seats) + (houseVote.notOnRoll ?? 0) !== 435) errors.push(`house votes: ${sum(row => row.seats)} members and ${houseVote.notOnRoll ?? 0} not on the roll do not make 435`);
  const tally = (['yes', 'no', 'nv'] as const).map(key => sum(row => parties.reduce((t, p) => t + (row.byParty[p]?.[key] ?? 0), 0)));
  if (tally.join() !== [houseVote.yes, houseVote.no, houseVote.notVoting].join()) errors.push(`house votes: tally ${tally.join('/')} does not match ${houseVote.yes}/${houseVote.no}/${houseVote.notVoting}`);
}
if (errors.length) {
  for (const error of errors) console.error(error);
  console.error(`FAILED: ${errors.length} error(s)`);
  process.exitCode = 1;
} else {
  console.log(`${entities.length} entities · ${edges.length} edges · ${sources.length} sources · ${script.length} turns · ${votes.length} votes`);
  console.log(`sources by kind: ${[...new Set(sources.map(s => s.kind))].map(k => `${k} ${sources.filter(s => s.kind === k).length}`).join(' · ')}`);
  console.log(`records per member: ${[...memberCounts].map(([id, n]) => `${id} ${n}`).join(' · ')}`);
  console.log(`${MORAN_UA_SHARED_DATES.length} shared contact dates (${MORAN_UA_SHARED_DATES.map(([d, ps]) => `${d.slice(5)} ${ps.length}`).join(' · ')})`);
  console.log(`${dashboard.kpis.length} KPIs · ${dashboard.watchlist.length} watchlist · ${dashboard.radar.length} radar · ${dashboard.activity.length} activity · ${dashboard.checkpoints.length} checkpoints`);
  const cross = (['R', 'D', 'I'] as const).map(party => `${party} ${(['yes', 'no', 'nv'] as const).map(vote => senateSeats.filter(seat => seat.party === party && seat.vote === vote).length).join('/')}`);
  console.log(`senate roll call 224 yes/no/nv by party: ${cross.join(' · ')}`);
  const houseParty = (['R', 'D', 'I'] as const).map(party => `${party} ${(['yes', 'no', 'nv'] as const).map(vote => houseStateVotes.reduce((total, row) => total + (row.byParty[party]?.[vote] ?? 0), 0)).join('/')}`);
  console.log(`house roll call 308 by party (yes/no/nv): ${houseParty.join(' · ')} · ${states.length} state centroids`);
  console.log('OK');
}
