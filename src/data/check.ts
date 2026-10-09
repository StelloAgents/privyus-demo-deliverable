import { entities, edges } from './entities';
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date < '2025-01-01' || date > '2026-09-30') errors.push(`${where}: invalid date ${date}`);
};
for (const entity of entities) {
  if (/Barakat|Max/i.test(entity.label)) errors.push(`entity ${entity.id}: forbidden label`);
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
  if ((source?.type === 'org' && source.sublabel === 'Defense contractor' && target?.type === 'person') ||
      (target?.type === 'org' && target.sublabel === 'Defense contractor' && source?.type === 'person')) errors.push(`edge ${edge.id}: defense contractor connected to person`);
  if (!edge.sourceIds.length) errors.push(`edge ${edge.id}: no sources`);
  for (const id of edge.sourceIds) requireId(sourceIds, id, `edge ${edge.id} sourceIds`);
  if (edge.date) validDate(edge.date, `edge ${edge.id}`);
}
const entitiesById = new Map(entities.map(entity => [entity.id, entity]));
const categoryParents = new Map<string, Set<string>>();
for (const edge of edges) {
  if (entitiesById.get(edge.source)?.type !== 'category' || entitiesById.get(edge.target)?.type !== 'detail') continue;
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
if (members.length !== 14) errors.push(`expected 14 Congress members, got ${members.length}`);
const orgCounts = ['Lobbying firm', 'Defense contractor', 'Think tank'].map(kind => entities.filter(entity => entity.type === 'org' && entity.sublabel === kind).length);
if (orgCounts.join(',') !== '3,3,2') errors.push(`expected 3/3/2 organizations, got ${orgCounts.join('/')}`);
const expectedCategoryCounts: Record<string, number> = { Votes: 6, Trips: 3, Meetings: 5, Contributions: 1, Opinions: 3, Others: 2 };
const categories = entities.filter(entity => entity.type === 'category' && entity.categoryOf === 'hartley');
if (categories.length !== 6) errors.push(`expected six Hartley categories, got ${categories.length}`);
for (const category of categories) {
  const children = edges.filter(edge => edge.source === category.id && entities.find(entity => entity.id === edge.target)?.type === 'detail');
  if (children.length !== expectedCategoryCounts[category.label]) errors.push(`${category.label}: expected ${expectedCategoryCounts[category.label]} detail children, got ${children.length}`);
}
if (edges.filter(edge => edge.source === 'meeting-private' && edge.target.startsWith('attendee-')).length !== 3) errors.push('private meeting: expected three attendees');
// Notes on the Explore graph: every date, count, and link they state comes from the records.
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
      const dates = edges.filter(edge => edge.source === note.focus && /^cosponsored/.test(edge.label) && edge.date).map(edge => edge.date!).sort();
      if (note.ring !== 'cosponsors' || dates.length < 2) errors.push(`${where}: expected dated cosponsors of ${note.focus}`);
      else if (LONG[monthOf(dates[0]) % 12] !== 'March' || dates.at(-1)!.slice(0, 7) !== '2025-06') errors.push(`${where}: cosponsor dates ${dates[0]} to ${dates.at(-1)} changed; review the note`);
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
      else if (top[0].m0 !== monthOf('2026-04-01') || best !== 8 || months.length !== 23) errors.push(`${where}: busiest stretch changed (${best} of ${months.length} from month ${top[0].m0}); review the note`);
    }
    if (note.kind === 'link') {
      const edge = edgeById.get(note.edge);
      const from = entitiesById.get(note.from);
      const to = entitiesById.get(note.to);
      if (!edge || !from || !to) errors.push(`${where}: missing records`);
      else {
        const category = entitiesById.get(edge.source === note.to ? edge.target : edge.source);
        if ((edge.source !== note.to && edge.target !== note.to) || category?.type !== 'category' || category.label !== 'Contributions') errors.push(`${where}: ${note.edge} is not a contribution by ${note.to}`);
        if (from.sublabel !== to.label) errors.push(`${where}: ${note.from} does not represent ${to.label}`);
        if (!note.text.startsWith(to.label)) errors.push(`${where}: text must name ${to.label}`);
      }
    }
    if (note.kind === 'timing') {
      const dates = note.points.map(point => edgeById.get(point.edge)?.date);
      if (dates.some(date => !date)) errors.push(`${where}: every point needs a dated record`);
      else {
        const sorted = [...dates as string[]].sort();
        const weeks = Math.ceil((dayOf(sorted.at(-1)!) - dayOf(sorted[0])) / 7);
        if (weeks !== 10) errors.push(`${where}: records span ${weeks} weeks; review the note`);
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
}
const memberCounts = new Map(members.map(member => [member.id, sources.filter(source => source.subjectIds?.includes(member.id)).length]));
for (const [id, count] of memberCounts) if (count < 3 || count > 16) errors.push(`member ${id}: expected 3–16 sources, got ${count}`);
if (sources.filter(source => source.kind === 'FARA').length < 5) errors.push('sources: expected at least 5 FARA records');
for (const vote of votes) {
  const where = `vote ${vote.billId}`;
  requireId(entityIds, vote.billId, `${where} billId`);
  requireId(sourceIds, vote.sourceId, `${where} sourceId`);
  if (sources.find(source => source.id === vote.sourceId)?.kind !== 'CONGRESS') errors.push(`${where}: source must be CONGRESS`);
  validDate(vote.date, where);
  if (vote.seats !== (vote.chamber === 'senate' ? 100 : 435)) errors.push(`${where}: seats do not match chamber`);
  if (vote.yes + vote.no + vote.notVoting !== vote.seats) errors.push(`${where}: tally does not equal ${vote.seats}`);
  const prefix = vote.chamber === 'senate' ? 'Sen.' : 'Rep.';
  for (const id of [vote.sponsorId, ...vote.cosponsorIds]) {
    if (!memberIds.has(id)) errors.push(`${where}: ${id} is not a member`);
    else if (!entitiesById.get(id)?.label.startsWith(prefix)) errors.push(`${where}: ${id} not in ${vote.chamber}`);
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
const partyOf = (id: string) => entitiesById.get(id)?.sublabel?.split('-')[0];
const stateOf = (id: string) => entitiesById.get(id)?.sublabel?.split('-')[1];
for (const entity of entities) {
  if (entity.type === 'org' && !entity.hqState) errors.push(`org ${entity.id}: missing hqState`);
  if (entity.hqState && !centroidCodes.has(entity.hqState)) errors.push(`entity ${entity.id}: hqState ${entity.hqState} not in geo`);
  if (entity.hqState && entity.type !== 'org') errors.push(`entity ${entity.id}: hqState only allowed on orgs`);
}
const memberState = (id: string) => (memberIds.has(id) ? stateOf(id) : undefined);
for (const source of sources) {
  const where = `source ${source.id} geo`;
  const subjects = source.subjectIds ?? [];
  const memberStates = new Set(subjects.map(memberState).filter((code): code is string => !!code));
  const orgStates = new Set(subjects.map(id => entitiesById.get(id)).filter(entity => entity?.type === 'org').map(entity => entity!.hqState!));
  const geo = source.geo;
  if (memberStates.size && !geo?.to) errors.push(`${where}: member subject but no to`);
  if (!geo) continue;
  for (const code of [geo.from, geo.to]) if (code && !centroidCodes.has(code)) errors.push(`${where}: unknown code ${code}`);
  if (geo.to && !memberStates.has(geo.to)) errors.push(`${where}: to ${geo.to} is not a member state in subjectIds`);
  if (source.kind === 'FEC' && (!geo.from || !orgStates.has(geo.from))) errors.push(`${where}: FEC from must be a contributor org hqState`);
  if ((source.kind === 'LDA' || source.kind === 'FARA') && geo.to && geo.from !== 'DC') errors.push(`${where}: ${source.kind} from must be DC`);
  if (source.kind === 'DISCLOSURE' && geo.from && geo.from !== 'DC' && !orgStates.has(geo.from)) errors.push(`${where}: DISCLOSURE from must be DC or an org hqState`);
  if (['TRAVEL', 'CONGRESS', 'STATEMENT'].includes(source.kind) && geo.from) errors.push(`${where}: ${source.kind} must be to-only`);
}
const senateVote = votes.find(vote => vote.billId === 's456');
const houseVote = votes.find(vote => vote.billId === 'hr123');
if (!senateVote) errors.push('senate seats: missing s456 tally');
else {
  if (senateSeats.length !== 100) errors.push(`senate seats: expected 100, got ${senateSeats.length}`);
  const seatIds = new Set(senateSeats.map(seat => seat.seatId));
  if (seatIds.size !== senateSeats.length) errors.push('senate seats: duplicate seatId');
  const count = (pred: (seat: typeof senateSeats[number]) => boolean) => senateSeats.filter(pred).length;
  const tally = [count(s => s.vote === 'yes'), count(s => s.vote === 'no'), count(s => s.vote === 'nv')];
  if (tally.join() !== [senateVote.yes, senateVote.no, senateVote.notVoting].join()) errors.push(`senate seats: tally ${tally.join('/')} does not match ${senateVote.yes}/${senateVote.no}/${senateVote.notVoting}`);
  const parties = [count(s => s.party === 'R'), count(s => s.party === 'D'), count(s => s.party === 'I')];
  if (parties.join() !== '51,47,2') errors.push(`senate seats: expected 51/47/2 R/D/I, got ${parties.join('/')}`);
  for (const code of stateCodes) if (count(s => s.state === code) !== 2) errors.push(`senate seats: ${code} needs exactly 2 seats`);
  for (const seat of senateSeats) if (!(seat.state in apportionment)) errors.push(`senate seat ${seat.seatId}: unknown state`);
  const named = senateSeats.filter(seat => seat.memberId);
  const expectedNamed = [senateVote.sponsorId, ...senateVote.cosponsorIds];
  if (named.length !== expectedNamed.length || !expectedNamed.every(id => named.some(seat => seat.memberId === id))) errors.push('senate seats: named members must be exactly the sponsor and cosponsors');
  for (const seat of named) {
    const id = seat.memberId!;
    if (partyOf(id) !== seat.party || stateOf(id) !== seat.state) errors.push(`senate seat ${seat.seatId}: ${id} party/state does not match entities`);
    if (seat.vote !== 'yes') errors.push(`senate seat ${seat.seatId}: ${id} must vote yes`);
  }
}
if (!houseVote) errors.push('house votes: missing hr123 tally');
else {
  const sum = (pick: (row: typeof houseStateVotes[number]) => number) => houseStateVotes.reduce((total, row) => total + pick(row), 0);
  if (houseStateVotes.length !== 50 || new Set(houseStateVotes.map(row => row.state)).size !== 50) errors.push(`house votes: expected 50 unique states, got ${houseStateVotes.length}`);
  for (const row of houseStateVotes) {
    if (apportionment[row.state] !== row.seats) errors.push(`house ${row.state}: seats ${row.seats} do not match apportionment ${apportionment[row.state]}`);
    const filled = (['R', 'D'] as const).reduce((total, party) => total + row.byParty[party].yes + row.byParty[party].no + row.byParty[party].nv, 0);
    if (filled !== row.seats) errors.push(`house ${row.state}: party votes ${filled} do not equal ${row.seats} seats`);
    for (const party of ['R', 'D'] as const) for (const value of Object.values(row.byParty[party])) if (!Number.isInteger(value) || value < 0) errors.push(`house ${row.state}: bad count`);
  }
  if (sum(row => row.seats) !== 435) errors.push(`house votes: seats sum to ${sum(row => row.seats)}, expected 435`);
  const tally = (['yes', 'no', 'nv'] as const).map(key => sum(row => row.byParty.R[key] + row.byParty.D[key]));
  if (tally.join() !== [houseVote.yes, houseVote.no, houseVote.notVoting].join()) errors.push(`house votes: tally ${tally.join('/')} does not match ${houseVote.yes}/${houseVote.no}/${houseVote.notVoting}`);
  for (const id of [houseVote.sponsorId, ...houseVote.cosponsorIds]) {
    const party = partyOf(id), code = stateOf(id);
    const row = houseStateVotes.find(item => item.state === code);
    if ((party !== 'R' && party !== 'D') || !row) errors.push(`house votes: ${id} has no matching state/party row`);
    else if (row.byParty[party].yes < 1) errors.push(`house votes: ${id} (${party}-${code}) needs a yes vote in that row`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(error);
  console.error(`FAILED: ${errors.length} error(s)`);
  process.exitCode = 1;
} else {
  console.log(`${entities.length} entities · ${edges.length} edges · ${sources.length} sources · ${script.length} turns · ${votes.length} votes`);
  console.log(`sources by kind: ${[...new Set(sources.map(s => s.kind))].map(k => `${k} ${sources.filter(s => s.kind === k).length}`).join(' · ')}`);
  console.log(`records per member: ${[...memberCounts].map(([id, n]) => `${id} ${n}`).join(' · ')}`);
  console.log(`${dashboard.kpis.length} KPIs · ${dashboard.watchlist.length} watchlist · ${dashboard.radar.length} radar · ${dashboard.activity.length} activity · ${dashboard.checkpoints.length} checkpoints`);
  const cross = (['R', 'D', 'I'] as const).map(party => `${party} ${(['yes', 'no', 'nv'] as const).map(vote => senateSeats.filter(seat => seat.party === party && seat.vote === vote).length).join('/')}`);
  console.log(`senate s456 yes/no/nv by party: ${cross.join(' · ')}`);
  const houseParty = (['R', 'D'] as const).map(party => `${party} ${houseStateVotes.reduce((total, row) => total + row.byParty[party].yes + row.byParty[party].no + row.byParty[party].nv, 0)} (${(['yes', 'no', 'nv'] as const).map(vote => houseStateVotes.reduce((total, row) => total + row.byParty[party][vote], 0)).join('/')})`);
  console.log(`house hr123 by party (yes/no/nv): ${houseParty.join(' · ')} · ${states.length} state centroids`);
  console.log('OK');
}
