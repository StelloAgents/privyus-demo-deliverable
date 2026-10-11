/**
 * Checks the demo data against the real-records fact base.
 *
 *   npx tsx scripts/check-real-records.ts
 *
 * The fact base is src/data/records/real-records.json (a verified subset of the
 * records retrieved on 2026-10-10), normalized by src/data/records/facts.ts.
 * This script asserts that:
 * - every SourceDoc points at a fact (`recordId`) and carries that fact's URL,
 *   date, and excerpt, word for word;
 * - every person and organization entity matches the fact base (name, party,
 *   state, IDs, filing state);
 * - every date, amount, position, and list behind the graph, the shared contact dates,
 *   the vote charts, the records in common, and the public statements matches its record;
 * - every quoted string in UI copy exists verbatim in a cited record;
 * - UI copy has no causal or predictive words about people, and names Lindsey
 *   Graham only inside verbatim record text.
 * Exits 1 on any failure.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboard } from '../src/data/dashboard';
import { edges, entities, HR5334_VOTES, MORAN_CONTRIBUTIONS, MORAN_UA_NETWORK, MORAN_UA_SHARED_DATES, MORAN_UA_STAFF, MUNICH_2025_OTHERS, OTHER_TRIP_MEMBERS, S5025_COSPONSORS, uaContactSource, uaDayId } from '../src/data/entities';
import { graphNotes } from '../src/data/graph-notes';
import { factById, firstNameOf, isoDate, money, realRecords as R, type Fact } from '../src/data/records/facts';
import { PEOPLE_STORY, script } from '../src/data/script';
import { sources } from '../src/data/sources';
import { houseStateVotes, senateSeats, votes } from '../src/data/votes';
import { SENTIMENT_FOOTNOTE, STATEMENTS, ukraineToneLine } from '../src/features/feeds/data';
import { UA_CONTACT_PEOPLE, UA_PRINCIPAL, contactOfRecipient, parseContributions, parseUkraineContacts, personOfRow, slug as slugOf, splitPages } from './lib/fara-7255';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);
let checks = 0;
const ok = (cond: unknown, msg: string) => {
  checks += 1;
  if (!cond) fail(msg);
};

const entityById = new Map(entities.map(e => [e.id, e]));
const edgeById = new Map(edges.map(e => [e.id, e]));
const sourceById = new Map(sources.map(s => [s.id, s]));
const memberById = new Map(R.members.map(m => [m.id, m]));
const memberByLast = new Map(R.members.map(m => [m.lastName, m]));
const idByLast = (last: string) => memberByLast.get(last)?.id;
const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const long = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const norm = (t: string) => t.replace(/\s+-\s+/g, '-').replace(/\s+/g, ' ');

/* ------------------------------------------------------------------ */
/* 1. Sources: URL, date, and excerpt from the fact                    */
/* ------------------------------------------------------------------ */

for (const s of sources) {
  const where = `source ${s.id}`;
  const f = s.recordId ? factById.get(s.recordId) : undefined;
  ok(f, `${where}: no fact ${s.recordId}`);
  if (!f) continue;
  ok(s.url && f.urls.includes(s.url), `${where}: url ${s.url} is not a URL of ${f.id}`);
  ok(s.date === f.date, `${where}: date ${s.date} is not the record date ${f.date}`);
  ok(s.excerpt === f.excerpt, `${where}: excerpt differs from the record`);
}
// Every fact is a verified record (the fact base holds no unverified item).
const unverified = JSON.stringify(R).match(/"verified": ?false/g);
ok(!unverified, 'fact base: holds an unverified item');

/* ------------------------------------------------------------------ */
/* 2. People and organizations                                         */
/* ------------------------------------------------------------------ */

/** Common first names used on the screens, each shown in a record as "Senator <name> <last>". */
const ALIASES: Record<string, string> = { durbin: 'Dick', markey: 'Ed', coons: 'Chris' };
const corpusAll = [...factById.values()].flatMap(f => f.corpus).join('\n');
const uaRows = R.fara.contacts.filter(r => r.principal === UA_PRINCIPAL);
const houseById = new Map(R.houseMembers.map(m => [m.id, m]));
const formerById = new Map(R.formerSenators.map(m => [m.id, m]));
for (const e of entities.filter(x => x.type === 'person')) {
  if (e.group === 'house') {
    // House members: party, state, and name from the House Clerk's member data; the first
    // name is the Clerk's or the one the FARA filing writes ("Representative Bobby Scott").
    const m = houseById.get(e.id);
    ok(m, `person ${e.id}: not a House member in the fact base`);
    if (!m) continue;
    const first = e.label.replace(/^Rep\. /, '').replace(new RegExp(` ${m.lastName}$`), '');
    const written = uaRows.some(r => r.contactAsWritten.toLowerCase() === `representative ${first} ${m.lastName}`.toLowerCase()) || uaRows.some(r => r.contactAsWritten.includes(`Rep. ${first} ${m.lastName})`));
    ok(e.label === `Rep. ${first} ${m.lastName}` && (first === m.firstName || written), `person ${e.id}: label "${e.label}" is not the Clerk's or the filing's name`);
    ok(e.sublabel === `${m.party}-${m.state}`, `person ${e.id}: sublabel ${e.sublabel} is not ${m.party}-${m.state} (House Clerk)`);
    ok(m.verified && m.sourceUrl.startsWith('https://clerk.house.gov/'), `person ${e.id}: not a verified House Clerk record`);
    continue;
  }
  if (formerById.has(e.id)) {
    const m = formerById.get(e.id)!;
    ok(e.label === `${m.firstName} ${m.lastName}` && e.sublabel?.startsWith(`${m.party}-${m.state} · `) && e.group === 'senate', `person ${e.id}: name, party, or state differs from the Senate roll call`);
    ok(uaRows.some(r => r.contactAsWritten === `Senator ${m.firstName} ${m.lastName}`), `person ${e.id}: the filing does not name "Senator ${m.firstName} ${m.lastName}"`);
    continue;
  }
  if (e.group === 'staff' || e.group === 'press') {
    // Staff and press: name, role, and employer exactly as the contact row writes them.
    const rows = uaRows.filter(r => slugOf(r.castMember) === e.id);
    ok(rows.length > 0, `person ${e.id}: no contact row`);
    const want = e.group === 'staff' ? `${e.label} (${(e.sublabel ?? '').replace(' · ', ', ')})` : `${e.label}, ${e.sublabel}`;
    ok(rows.every(r => r.contactAsWritten === want), `person ${e.id}: name or role differs from the row ("${rows[0]?.contactAsWritten}")`);
    continue;
  }
  const m = memberById.get(e.id);
  ok(m, `person ${e.id}: not a member in the fact base`);
  if (!m) continue;
  const first = ALIASES[e.id] ?? firstNameOf(m.firstName);
  ok(e.label === `Sen. ${first} ${m.lastName}`, `person ${e.id}: label "${e.label}" does not match ${first} ${m.lastName}`);
  if (ALIASES[e.id]) ok(corpusAll.includes(`Senator ${first} ${m.lastName}`), `person ${e.id}: alias ${first} is not in any record`);
  ok(e.sublabel === `${m.party}-${m.state}`, `person ${e.id}: sublabel ${e.sublabel} is not ${m.party}-${m.state}`);
  ok(m.sittingSenator && m.verified, `person ${e.id}: not a verified sitting senator`);
}
ok(!entities.some(e => /graham/i.test(`${e.label} ${e.sublabel ?? ''}`)), 'entities: Graham is never a node');
{
  const moran = entityById.get('moran')!;
  const b = R.fara.registrantBulk;
  ok(moran.label === b.name && moran.sublabel?.includes(b.registrationNumber) && moran.hqState === b.state, 'org moran: name, number, or state differs from the FARA registrant record');
  const ua = entityById.get('ua-ministry')!;
  ok(R.fara.principals.some(p => p.foreignPrincipal === ua.label && p.country === 'UKRAINE'), 'org ua-ministry: not the FARA principal');
  for (const e of entities.filter(x => x.type === 'org' && /PAC/.test(x.sublabel ?? ''))) {
    const id = /C\d{8}/.exec(e.sublabel ?? '')?.[0] ?? '';
    const pac = (R.fec.pacs as Record<string, { label: string }>)[id];
    const addr = (R.fec.pacAddresses as Record<string, { state: string }>)[id];
    ok(pac && e.label === `${pac.label} PAC`, `org ${e.id}: label or FEC ID differs from the fact base`);
    ok(addr && e.hqState === addr.state, `org ${e.id}: hqState is not the PAC's filing state`);
  }
}

/* ------------------------------------------------------------------ */
/* 3. Bills, cosponsors, trips, votes, contacts, contributions         */
/* ------------------------------------------------------------------ */

const bill = (id: string) => R.bills.find(b => b.id === id)!;
{
  const hr815 = bill('HR-815-118');
  const hr5334 = bill('HR-5334-119');
  const s5025 = bill('S-5025-119');
  ok(entityById.get('hr815')!.sublabel === `P.L. ${hr815.laws[0].number} · ${short(hr815.latestAction.date)}`, 'bill hr815: law or date differs');
  ok(entityById.get('hr5334')!.sublabel === `P.L. ${hr5334.laws[0].number} · ${short(hr5334.latestAction.date)}`, 'bill hr5334: law or date differs');
  ok(entityById.get('s5025')!.sublabel === `Senate · introduced ${short(s5025.introducedDate)}`, 'bill s5025: introduced date differs');
  const cast = (s5025.castCosponsors as { lastName: string; sponsorshipDate: string }[]);
  ok(JSON.stringify([...S5025_COSPONSORS].sort()) === JSON.stringify(cast.map(c => idByLast(c.lastName)).sort()), 'S. 5025: cosponsors differ from the bill status record');
  for (const c of cast) {
    const e = edgeById.get(`s5025-${idByLast(c.lastName)}`);
    ok(e && e.date === c.sponsorshipDate, `S. 5025: ${c.lastName} cosponsor date differs`);
  }
  const s1241 = bill('S-1241-119');
  const w = (s1241.castCosponsors as { lastName: string; sponsorshipDate: string }[]).find(c => c.lastName === 'Wicker');
  ok(w && edgeById.get('cat-others-other-s1241')?.date === w.sponsorshipDate, 'S. 1241: Wicker cosponsor date differs');
  // H.R. 5334 path: each step date is a key action date.
  const actions = new Set((hr5334.keyActions as { date: string }[]).map(a => a.date));
  for (const id of ['hr5334-step-s224', 'hr5334-step-h308', 'hr5334-step-law']) ok(actions.has(edgeById.get(id)!.date!), `${id}: date is not a key action date`);
}
{
  const trip = (id: string) => R.trips.find(t => t.id === id)!;
  const m25 = trip('trip-munich-2025');
  ok(m25.wickerListed && m25.listsMatch, 'Munich 2025: Wicker not listed or the two releases disagree');
  ok(JSON.stringify([...MUNICH_2025_OTHERS].sort()) === JSON.stringify(m25.castMembers.filter(n => n !== 'Wicker').map(idByLast).sort()), 'Munich 2025: delegation differs from the releases');
  for (const [id, members] of Object.entries(OTHER_TRIP_MEMBERS)) {
    const t = trip(id);
    const confirmed = new Set(t.castMembers.map(idByLast));
    for (const m of members) ok(confirmed.has(m), `${id}: ${m} is not a confirmed member of the delegation`);
    const unconfirmed = ((t as { castMembersUnconfirmed?: string[] }).castMembersUnconfirmed ?? []).map(idByLast);
    for (const m of members) ok(!unconfirmed.includes(m), `${id}: ${m} is unconfirmed`);
    ok(!t.wickerListed, `${id}: Wicker is listed (would need a Wicker link)`);
  }
}
{
  // Wicker's votes: position prefix and date.
  for (const [detail, roll] of [['vote-224', 224], ['vote-212', 212], ['vote-178', 178], ['vote-76', 76], ['vote-154', 154], ['vote-48', 48], ['vote-200', 200], ['vote-195', 195]] as const) {
    const v = R.senateVotes.find(x => x.rollCall === roll)!;
    const e = entityById.get(detail)!;
    const pos = (v.castPositions as Record<string, string>).Wicker;
    ok(e.label.startsWith(`${pos} · `), `${detail}: Wicker voted ${pos}`);
    ok(edgeById.get(`cat-votes-${detail}`)!.date === isoDate(v.date), `${detail}: date differs`);
    ok(e.sublabel === `${short(isoDate(v.date))} · roll call ${roll}`, `${detail}: sublabel differs`);
  }
  for (const [detail, roll, tally] of [['step-s212', 212, '86-12'], ['step-s224', 224, '86-11']] as const) {
    const v = R.senateVotes.find(x => x.rollCall === roll)!;
    ok(v.result.includes(`(${tally}`) && entityById.get(detail)!.label.endsWith(tally), `${detail}: tally differs`);
  }
  const h = R.houseVotes.find(x => x.rollCall === 308)!;
  ok(entityById.get('step-h308')!.label.endsWith(`${h.totals.yea}-${h.totals.nay}`), 'step-h308: tally differs');
}
{
  // FARA contacts: dates, subjects, and principals.
  const rows = R.fara.contacts;
  const find = (member: string, principal: RegExp, iso: string) => rows.filter(r => idByLast(r.castMember) === member && principal.test(r.principal) && isoDate(r.date) === iso);
  for (const [detail, principal, date, n] of [['contact-ua-0609', /Ukraine/, '2024-06-09', 1]] as const) {
    ok(find('wicker', principal, date).length === n, `${detail}: expected ${n} Wicker row(s)`);
    ok(edgeById.get(`cat-contacts-${detail}`)!.date === date, `${detail}: date differs`);
  }
  const ua = R.fara.principals.find(p => /Ukraine/.test(p.foreignPrincipal))!;
  ok(edgeById.get('moran-ua-ministry')!.date === isoDate(ua.fpRegistrationDate), 'moran-ua-ministry: date is not the registration date');
}
{
  // The Ukraine-principal network against the PDF text (src/data/records/fara-7255-pages.txt,
  // from pdftotext -layout; scripts/extract-fara-7255.ts writes both).
  const pages = splitPages(readFileSync(path.join(root, 'src/data/records/fara-7255-pages.txt'), 'utf8'));
  const flat = (p: number) => norm((pages.find(x => x.page === p)?.lines ?? []).join(' ').replace(/Representat ive/g, 'Representative'));
  const parsed = parseUkraineContacts(pages);
  ok(parsed.length === uaRows.length, `FARA: ${parsed.length} Ukraine rows in the PDF text, ${uaRows.length} in the fact base`);
  parsed.forEach((p, i) => {
    const r = uaRows[i];
    const where = `FARA row ${i + 1} (${p.date})`;
    ok(r && r.date === p.date && r.contactAsWritten === p.contactAsWritten && r.method === p.method && r.subject === p.subject && r.page === p.page, `${where}: differs from the PDF text`);
    // Every word of the row is on its page (the cells wrap, so words, not whole strings).
    // A row may wrap onto the next page.
    const text = `${flat(p.page)} ${flat(p.page + 1)}`;
    for (const w of `${p.date} ${p.contactAsWritten} ${p.method} ${p.subject}`.split(/\s+/)) ok(text.includes(w), `${where}: "${w}" is not on page ${p.page} or ${p.page + 1}`);
    ok(r && slugOf(r.castMember) === slugOf(personOfRow(p.contactAsWritten).castMember), `${where}: castMember differs`);
  });
  // The network table (entities.ts): every person, in the filing's order, with each date.
  const byPerson = new Map<string, string[]>();
  for (const r of uaRows) {
    const id = slugOf(r.castMember);
    const d = isoDate(r.date);
    byPerson.set(id, [...new Set([...(byPerson.get(id) ?? []), d])]);
  }
  ok(JSON.stringify(MORAN_UA_NETWORK) === JSON.stringify([...byPerson]), 'MORAN_UA_NETWORK: differs from the Ukraine rows');
  for (const [person, dates] of MORAN_UA_NETWORK) {
    ok(entityById.get(person)?.type === 'person', `network ${person}: no person entity`);
    const e = edgeById.get(`moran-${person}`);
    ok(e && e.source === 'moran' && e.target === person && e.date === dates[0], `network ${person}: firm edge missing or not dated at the first contact`);
    ok(e && JSON.stringify(e.sourceIds) === JSON.stringify(dates.map(d => uaContactSource(person, d))), `network ${person}: firm edge does not cite every row`);
    for (const d of dates) {
      const src = sourceById.get(uaContactSource(person, d));
      ok(src?.recordId === `fara:contact:${person}:ukraine:${d}`, `network ${person} ${d}: source is not the row`);
      ok(src?.subjectIds?.includes(person) && src.subjectIds.includes('moran'), `network ${person} ${d}: source does not name the person and the firm`);
      ok(/ · Page \d+$/.test(src?.excerpt ?? '') || / · Page \d+ \|/.test(src?.excerpt ?? ''), `network ${person} ${d}: source has no page number`);
    }
    const group = UA_CONTACT_PEOPLE.find(p => slugOf(p.castMember) === person)?.group;
    ok(entityById.get(person)?.group === group || (group === 'senate' && entityById.get(person)?.label.startsWith('Sen. ')), `network ${person}: group differs from the filing`);
  }
  // Staff: each to the member the row names as employer.
  for (const r of uaRows.filter(x => x.viaStaff)) {
    const staff = slugOf(r.castMember);
    const member = r.staffOf ? slugOf(r.staffOf) : '';
    ok(MORAN_UA_STAFF[staff] === member && edgeById.has(`${staff}-staff-of-${member}`), `staff ${staff}: employer ${member} differs or has no edge`);
    ok(r.contactAsWritten.includes(`Rep. ${entityById.get(member)?.label.replace(/^Rep\. /, '')})`), `staff ${staff}: the row does not name ${member}`);
  }
  // Contributions: James P. Moran's rows to people in the contact list, as the PDF text lists them.
  const parsedC = parseContributions(pages).filter(c => c.donor === 'James P. Moran' && contactOfRecipient(c.recipientAsWritten));
  ok(JSON.stringify(parsedC.map(c => [c.date, c.recipientAsWritten, c.amount, c.page])) === JSON.stringify(R.fara.contributions.map(c => [c.date, c.recipientAsWritten, c.amount, c.page])), 'contributions: differ from the PDF text');
  for (const c of R.fara.contributions) {
    const text = flat(c.page);
    for (const w of `${c.date} ${c.donor} ${c.recipientAsWritten} ${c.amountAsWritten}`.split(/\s+/)) ok(text.includes(w), `contribution ${c.date}: "${w}" is not on page ${c.page}`);
  }
  ok(MORAN_CONTRIBUTIONS.length === R.fara.contributions.length, 'contributions: the table and the fact base differ in length');
  for (const [detail, member, date, amount, recipient, src] of MORAN_CONTRIBUTIONS) {
    const r = R.fara.contributions.find(c => slugOf(c.castMember) === member && isoDate(c.date) === date && c.recipientAsWritten === recipient);
    ok(r && r.amount === amount, `${detail}: no row for ${member} on ${date} with ${money(amount)} to "${recipient}"`);
    ok(sourceById.get(src)?.recordId === `fara:contribution:${member}:${date}`, `${detail}: source ${src} is not the row`);
    const e = entityById.get(detail);
    ok(e?.label === `Contribution listed · ${money(amount)}` && e.sublabel === `${short(date)} · ${recipient}`, `${detail}: label differs from the row`);
  }
  // The Explore answer: its counts are the filing's.
  const turn = script.find(t => t.id === 'moran-network')!;
  const groups = (g: string) => UA_CONTACT_PEOPLE.filter(p => p.group === g).length;
  const own = (p: string, q: string) => MORAN_UA_STAFF[p] === q || MORAN_UA_STAFF[q] === p;
  const sharedDates = [...new Set(uaRows.map(r => isoDate(r.date)))].filter(d => {
    const people = MORAN_UA_NETWORK.filter(([, ds]) => ds.includes(d)).map(([p]) => p);
    return people.some((p, i) => people.slice(i + 1).some(q => !own(p, q)));
  });
  for (const phrase of [`${uaRows.length} contact rows`, `${MORAN_UA_NETWORK.length} people`, `${groups('senate')} senators`, `${groups('house')} House members`, `${groups('staff')} staff members`, `${groups('press')} reporter`, `On ${sharedDates.length} dates`]) {
    ok(turn.answer.includes(phrase), `turn moran-network: "${phrase}" is not in the answer`);
  }
  for (const p of UA_CONTACT_PEOPLE.filter(x => x.group === 'senate')) ok(turn.answer.includes(p.castMember), `turn moran-network: does not name Senator ${p.castMember}`);
  const pagesSeen = [...new Set(uaRows.map(r => r.page))].sort((a, b) => a - b);
  ok(turn.answer.includes(`pages ${pagesSeen[0]} to ${pagesSeen.at(-1)}`), 'turn moran-network: page range differs');
  // Shared contact dates: one record per date that lists two or more people (not a staffer and
  // their own member), joined to exactly the people the rows list on it, each by their own row.
  ok(JSON.stringify(MORAN_UA_SHARED_DATES.map(([d]) => d)) === JSON.stringify(sharedDates), `shared dates: ${MORAN_UA_SHARED_DATES.map(([d]) => d).join(', ')} differ from the rows (${sharedDates.join(', ')})`);
  for (const [d, people] of MORAN_UA_SHARED_DATES) {
    const want = [...new Set(uaRows.filter(r => isoDate(r.date) === d).map(r => slugOf(r.castMember)))];
    ok(JSON.stringify([...people].sort()) === JSON.stringify([...want].sort()), `shared date ${d}: people differ from the rows`);
    const e = entityById.get(uaDayId(d));
    ok(e?.label === `FARA contacts · ${short(d)}` && e.sublabel === `Moran Global Strategies · ${want.length} people`, `shared date ${d}: label differs from the rows`);
    for (const p of people) {
      const edge = edgeById.get(`${uaDayId(d)}-${p}`);
      ok(edge && edge.date === d && edge.sourceIds.join() === uaContactSource(p, d) && sourceById.get(edge.sourceIds[0])?.recordId === `fara:contact:${p}:ukraine:${d}`, `shared date ${d}: edge to ${p} does not cite the row`);
    }
  }
  // The deeper layers after the firm's network: the shared date and the member answer name the rows'.
  {
    const s2 = script.find(x => x.id === 'same-date-wicker')!;
    for (const p of MORAN_UA_SHARED_DATES.find(([d]) => d === PEOPLE_STORY.wickerDate)![1]) {
      const r = uaRows.find(x => slugOf(x.castMember) === p && isoDate(x.date) === PEOPLE_STORY.wickerDate)!;
      ok(s2.answer.includes(`“${r.subject}”`), `turn same-date-wicker: does not give ${p}'s subject as written`);
    }
    // The member answer: the four kinds of record it names are each in the data.
    const m = PEOPLE_STORY.member;
    ok(MORAN_UA_NETWORK.some(([p]) => p === m) && MUNICH_2025_OTHERS.includes(m) && S5025_COSPONSORS.includes(m) && entityById.has(`contrib-rtx-${m}`), `turn member-shared-records: ${m} does not share all four kinds of record with Wicker`);
  }
}

/* ------------------------------------------------------------------ */
/* 4b. Records in common: the firm's contacts on S. 5025 and H.R. 5334  */
/* ------------------------------------------------------------------ */
{
  const where = 'records in common';
  const t = script.find(x => x.id === 'records-in-common')!;
  const ric = PEOPLE_STORY.recordsInCommon;
  const contacts = MORAN_UA_NETWORK.map(([p]) => p);
  ok(ric.contacts === contacts.length && contacts.length === 25, `${where}: the firm lists ${contacts.length} people, not 25`);
  // S. 5025: the contacts on the bill's cosponsor list, all original (dated the introduction date).
  const s5025 = bill('S-5025-119');
  const onBill = (p: string) => s5025.castCosponsors.find(c => idByLast(c.lastName) === p);
  const cos = contacts.filter(p => onBill(p));
  ok(JSON.stringify([...ric.cosponsors].sort()) === JSON.stringify([...cos].sort()), `${where}: S. 5025 cosponsors ${ric.cosponsors.join(', ')} differ from the bill record (${cos.join(', ')})`);
  for (const p of cos) ok(onBill(p)!.sponsorshipDate === s5025.introducedDate && !onBill(p)!.withdrawn, `${where}: ${p} is not an original cosponsor of S. 5025`);
  ok(cos.length === 5, `${where}: ${cos.length} S. 5025 cosponsors, expected 5`);
  // H.R. 5334: each listed member's position on Senate roll call 224 or House roll call 308.
  const v224 = R.senateVotes.find(v => v.rollCall === 224)!;
  const h308 = R.houseVotes.find(v => v.rollCall === 308)! as (typeof R.houseVotes)[number] & { castPositions?: { bioguideId: string; legislatorAsWritten: string; vote: string }[] };
  ok(h308.castPositions && h308.castPositions.length === R.houseMembers.length, `${where}: House roll call 308 positions missing`);
  const VOTE: Record<string, 'yes' | 'no'> = { Yea: 'yes', Nay: 'no' };
  const recorded: Record<string, 'yes' | 'no' | undefined> = {};
  for (const p of contacts) {
    const senator = memberById.get(p);
    const house = houseById.get(p);
    if (senator) {
      const seat = v224.allSeats!.find(x => x.state === senator.state && x.name.endsWith(senator.lastName));
      recorded[p] = seat ? VOTE[seat.vote] : undefined;
      ok(seat && (v224.castPositions as Record<string, string>)[senator.lastName] === seat.vote, `${where}: ${p} differs between roll call 224 seats and positions`);
    } else if (house) {
      const pos = h308.castPositions?.find(x => x.bioguideId === house.bioguideId);
      recorded[p] = pos ? VOTE[pos.vote] : undefined;
      ok(pos, `${where}: ${p} is not on House roll call 308`);
    } else if (formerById.has(p)) {
      ok(!v224.allSeats!.some(x => x.name.endsWith(formerById.get(p)!.lastName) && x.state === formerById.get(p)!.state), `${where}: former senator ${p} is on roll call 224`);
      ok(ric.notOnRoll.includes(p), `${where}: ${p} should be listed as not on the 2026 roll call`);
    } else {
      ok(ric.staffAndPress.includes(p), `${where}: ${p} is not a member and not listed as staff or press`);
    }
    ok(HR5334_VOTES[p] === recorded[p], `${where}: ${p} H.R. 5334 position ${HR5334_VOTES[p]} differs from the roll call (${recorded[p]})`);
  }
  const yes = contacts.filter(p => recorded[p] === 'yes');
  const no = contacts.filter(p => recorded[p] === 'no');
  ok(JSON.stringify([...ric.yes].sort()) === JSON.stringify([...yes].sort()) && yes.length === 13, `${where}: yes votes ${ric.yes.length} differ from the roll calls (${yes.length})`);
  ok(JSON.stringify([...ric.no].sort()) === JSON.stringify([...no].sort()) && no.length === 6, `${where}: no votes ${ric.no.length} differ from the roll calls (${no.length})`);
  ok(ric.staffAndPress.length === 5 && ric.staffAndPress.every(p => ['staff', 'press'].includes(entityById.get(p)?.group ?? '')), `${where}: staff and press differ`);
  ok(yes.length + no.length + ric.staffAndPress.length + ric.notOnRoll.length === contacts.length, `${where}: yes, no, staff and press, and not on the roll do not add up to the list`);
  // The yes-vote edges: one per yes vote, citing the chamber's roll call, dated its vote.
  for (const p of contacts) {
    const e = edgeById.get(`hr5334-yes-${p}`);
    if (recorded[p] !== 'yes') {
      ok(!e, `${where}: ${p} has a yes-vote edge but did not vote yes`);
      continue;
    }
    const senate = memberById.has(p);
    ok(e && e.source === 'hr5334' && e.target === p && e.sourceIds.join() === (senate ? 'roll-s224' : 'roll-h308') && e.date === (senate ? isoDate(v224.date) : isoDate(h308.date)), `${where}: ${p} yes-vote edge differs from the roll call`);
  }
  // The answer and the card give these counts and names.
  for (const phrase of [`Of the ${contacts.length} people`, `${cos.length} are original cosponsors of S. 5025`, `${yes.length} voted yes on H.R. 5334`, `Senate roll call 224, ${long(isoDate(v224.date))}`, `House roll call 308, ${long(isoDate(h308.date))}`, 'records in common', 'do not vote']) {
    ok(t.answer.includes(phrase), `turn records-in-common: "${phrase}" is not in the answer`);
  }
  for (const p of [...yes, ...no, ...cos, ...ric.notOnRoll]) {
    const last = (entityById.get(p)?.label ?? '').split(' ').at(-1)!;
    ok(t.answer.includes(last), `turn records-in-common: does not name ${p}`);
  }
  for (const c of ['bill-s5025', 'roll-s224', 'roll-h308']) ok(t.citations.includes(c), `turn records-in-common: does not cite ${c}`);
  const tour = readFileSync(path.join(root, 'src/data/tour.ts'), 'utf8');
  ok(/records in common, not a reason for any vote/.test(tour), `${where}: the card does not say "records in common, not a reason for any vote"`);
}

const fecRows = (last: string, cycle = '2023-2024') => R.fec.contributions.filter(c => c.senator === last && c.cycle === cycle);
const lastTxn = (r: (typeof R.fec.contributions)[number]) => r.transactions.map(t => t.date).sort().at(-1)!;
{
  const PAC_ENTITY: Record<string, string> = { Boeing: 'pac-boeing', 'General Dynamics': 'pac-gd', 'Lockheed Martin': 'pac-lockheed', 'Northrop Grumman': 'pac-northrop', RTX: 'pac-rtx' };
  const wicker = fecRows('Wicker');
  ok(wicker.length === 5 && fecRows('Wicker', '2025-2026').length === 0, 'Wicker FEC: expected 5 PACs in 2023-24 and none in 2025-26');
  for (const r of wicker) {
    const e = edgeById.get(`${PAC_ENTITY[r.pac]}-cat-contributions`)!;
    ok(e.label === `contributed ${money(r.netTotal)}, 2023-24` && e.date === lastTxn(r), `${e.id}: amount or date differs from FEC`);
  }
  for (const e of entities.filter(x => x.id.startsWith('contrib-rtx-'))) {
    const member = e.id.replace('contrib-rtx-', '');
    const r = fecRows(memberById.get(member)!.lastName).find(x => x.pac === 'RTX')!;
    ok(r && e.label === `RTX PAC · ${money(r.netTotal)}, 2023-24` && e.sublabel === short(lastTxn(r)), `${e.id}: amount or date differs from FEC`);
  }
}

/* ------------------------------------------------------------------ */
/* 5. Vote charts                                                      */
/* ------------------------------------------------------------------ */

{
  const v224 = R.senateVotes.find(x => x.rollCall === 224)!;
  const VOTE: Record<string, string> = { Yea: 'yes', Nay: 'no', 'Not Voting': 'nv' };
  const key = (party: string, vote: string) => `${party}:${vote}`;
  const byStateRec = new Map<string, string[]>();
  for (const s of v224.allSeats!) byStateRec.set(s.state, [...(byStateRec.get(s.state) ?? []), key(s.party, VOTE[s.vote])].sort());
  const byStateData = new Map<string, string[]>();
  for (const s of senateSeats) byStateData.set(s.state, [...(byStateData.get(s.state) ?? []), key(s.party, s.vote)].sort());
  for (const [st, seats] of byStateRec) ok(JSON.stringify(seats) === JSON.stringify(byStateData.get(st)), `senate seats ${st}: differ from roll call 224`);
  for (const s of senateSeats.filter(x => x.memberId)) {
    const m = memberById.get(s.memberId!)!;
    const rec = v224.allSeats!.find(x => x.state === m.state && x.name.endsWith(m.lastName));
    ok(rec && VOTE[rec.vote] === s.vote && rec.party === s.party, `senate seat ${s.seatId}: ${m.lastName} differs from roll call 224`);
  }
  const senate = votes.find(v => v.chamber === 'senate')!;
  ok(`${senate.yes}-${senate.no}` === `${v224.count.yeas}-${v224.count.nays}` && String(senate.notVoting) === v224.count.absent, 'senate tally differs from roll call 224');
  const h = R.house308ByState.byState as Record<string, Record<'R' | 'D' | 'I', { yes: number; no: number; nv: number }>>;
  for (const row of houseStateVotes) {
    for (const p of ['R', 'D', 'I'] as const) {
      const rec = h[row.state][p];
      const got = row.byParty[p] ?? { yes: 0, no: 0, nv: 0 };
      ok(rec.yes === got.yes && rec.no === got.no && rec.nv === got.nv, `house ${row.state} ${p}: differs from roll call 308`);
    }
  }
  const house = votes.find(v => v.chamber === 'house')!;
  const hv = R.houseVotes.find(x => x.rollCall === 308)!;
  ok(house.yes === hv.totals.yea && house.no === hv.totals.nay && house.notVoting === hv.totals['not-voting'], 'house tally differs from roll call 308');
}

/* ------------------------------------------------------------------ */
/* 6. Public statements                                                */
/* ------------------------------------------------------------------ */

/** The words a sentiment label may use for its topic, each tied to words in the quoted text. */
const TOPIC_WORDS: [label: RegExp, text: RegExp][] = [
  [/Ukraine/, /Ukrain/],
  [/Russia/, /Russia|Moscow|Kremlin|Putin/],
  [/Iran/, /Iran|Tehran/],
  [/sanctions/i, /sanction/i],
];
for (const p of STATEMENTS) {
  const f = factById.get(p.recordId);
  ok(f, `statement ${p.id}: no fact ${p.recordId}`);
  if (!f) continue;
  ok(f.excerpt.includes(p.quote), `statement ${p.id}: quote is not verbatim in the record`);
  ok(f.urls.includes(p.url), `statement ${p.id}: url differs from the record`);
  ok(p.date === f.date, `statement ${p.id}: date differs from the record`);
  const stmt = R.statements.find(s => `stmt:${s.id}` === p.recordId)!;
  ok(idByLast(stmt.member) === p.personId, `statement ${p.id}: quoted member differs`);
  // The sentiment reads the quoted text only: every topic its label names is in the quote, and
  // the Ukraine tone is set only when the quote names Ukraine.
  const { label, tone, ukraine } = p.sentiment;
  ok(/^(Supports|Critical of) /.test(label) && (tone === 'supportive') === label.startsWith('Supports'), `statement ${p.id}: label "${label}" and tone ${tone} differ`);
  const topics = TOPIC_WORDS.filter(([l]) => l.test(label));
  ok(topics.length > 0, `statement ${p.id}: label "${label}" names no topic`);
  for (const [l, words] of topics) ok(words.test(p.quote), `statement ${p.id}: label topic ${l} is not in the quote`);
  ok(!!ukraine === /Ukrain/.test(p.quote), `statement ${p.id}: Ukraine tone set ${!!ukraine}, quote names Ukraine ${/Ukrain/.test(p.quote)}`);
  ok(!/\b(because|influenc\w*|likely|will|predict\w*)\b|Graham/i.test(label), `statement ${p.id}: label wording`);
}
// The member the tour centers last: the two newest statements, and the tone line they give.
{
  const shown = STATEMENTS.filter(s => s.personId === PEOPLE_STORY.member).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  ok(shown.length === 2 && ukraineToneLine(shown) === 'Tone on Ukraine: supportive (2 of 2 statements)', `statements: ${PEOPLE_STORY.member}'s tone line is "${ukraineToneLine(shown)}"`);
}
ok(SENTIMENT_FOOTNOTE === 'Sentiment is an AI reading of the statement text. It does not predict votes.', 'statements: footnote differs');
{
  // No feed or linked-content wording is left in the feature and the chat.
  for (const f of ['src/features/feeds/PublicStatements.tsx', 'src/features/feeds/StatementRow.tsx', 'src/features/feeds/data.ts', 'src/features/explore/ChatTurn.tsx', 'src/components/ui/AccountMenus.tsx', 'src/data/tour.ts']) {
    const text = readFileSync(path.join(root, f), 'utf8');
    ok(!/Linked by you|not a cited record|not part of the public record|Linked feeds|social media|\bposts?\b/i.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${f}: linked-feed or post wording`);
  }
}

/* ------------------------------------------------------------------ */
/* 7. UI copy: quotes, numbers, language                               */
/* ------------------------------------------------------------------ */

const quotesIn = (text: string) => [...text.matchAll(/“([^”]+)”/g)].map(m => m[1]);
const outsideQuotes = (text: string) => text.replace(/“[^”]*”/g, '“”');
/** The verbatim text of the facts, plus each House roll call's "yea-nay" tally (the XML gives the two numbers). */
const corpusOf = (facts: (Fact | undefined)[]) =>
  norm(
    facts
      .flatMap(f => [...(f?.corpus ?? []), ...(f?.kind === 'house-vote' ? R.houseVotes.filter(h => `vote:${h.id}` === f.id).map(h => `${h.totals.yea}-${h.totals.nay}`) : [])])
      .join('\n'),
  );
const FORBIDDEN = /\b(because|influenc\w*|likely|will|watch(?:es|ed|ing)?|explains?|predict\w*|caused?|led to|in exchange)\b/i;
/**
 * Copy about the firm's network (contacts on one date, contributions in the same filing)
 * never says people were together or met, and never ties money to a contact or a vote.
 */
const FORBIDDEN_NETWORK = /\b(together|met|meets?|meetings?|coordinat\w*|after|following|in return|linked to the meeting|alongside|joined|jointly|with each other)\b/i;

function checkCopy(where: string, text: string, facts: (Fact | undefined)[]) {
  const corpus = corpusOf(facts);
  for (const q of quotesIn(text)) ok(corpus.includes(norm(q)), `${where}: quote not verbatim in a cited record: “${q.slice(0, 60)}”`);
  const plain = outsideQuotes(text);
  const bad = FORBIDDEN.exec(plain);
  ok(!bad, `${where}: causal or predictive word "${bad?.[0]}"`);
  ok(!/Graham/.test(plain), `${where}: names Graham outside a verbatim quote`);
  for (const m of plain.matchAll(/\b(\d{2,3})-(\d{1,3})\b/g)) {
    if (/^20\d\d$/.test(m[1] + m[2]) || /\d{4}-\d{2}/.test(m[0])) continue;
    if (/\b(?:118|119)-\d+/.test(m[0])) continue; // Public Law numbers
    ok(corpus.includes(m[0]), `${where}: tally ${m[0]} not in a cited record`);
  }
  for (const m of plain.matchAll(/\$\d[\d,]*\d/g)) {
    const fec = facts.filter((f): f is Fact => f?.kind === 'fec');
    const sums = fec.map(f => money([...f.excerpt.matchAll(/\$([\d,]+)/g)].reduce((t, x) => t + Number(x[1].replace(/,/g, '')), 0)));
    ok(corpus.includes(m[0]) || sums.includes(m[0]), `${where}: amount ${m[0]} not in a cited record`);
  }
}

const factOf = (sourceId: string) => factById.get(sourceById.get(sourceId)?.recordId ?? '');
for (const t of script) checkCopy(`turn ${t.id}`, t.answer, t.citations.map(factOf));
{
  // The network copy: the firm's network answer, the deeper-layer answers, the shared
  // contact dates, the contribution records, and the graph notes.
  const networkCopy: [string, string][] = [
    ['turn moran-network', script.find(t => t.id === 'moran-network')!.answer],
    ...PEOPLE_STORY.turns.map((id): [string, string] => [`turn ${id}`, script.find(t => t.id === id)!.answer]),
    ...entities.filter(e => e.id.startsWith('contrib-moran-') || e.id.startsWith('ua-day-')).map((e): [string, string] => [`entity ${e.id}`, `${e.label} ${e.sublabel}`]),
    ...edges.filter(e => e.source === 'moran' || /-staff-of-|^contrib-moran-|^ua-day-/.test(e.id)).map((e): [string, string] => [`edge ${e.id}`, e.label]),
    ...graphNotes.map((n): [string, string] => [`graph note ${n.id}`, n.text]),
  ];
  for (const [where, text] of networkCopy) {
    const bad = FORBIDDEN_NETWORK.exec(outsideQuotes(text));
    ok(!bad, `${where}: network wording "${bad?.[0]}"`);
  }
}
for (const n of graphNotes) checkCopy(`graph note ${n.id}`, n.text, []);
for (const r of dashboard.activity) checkCopy(`activity ${r.id}`, `${r.title} ${r.description}`, r.sourceId ? [factOf(r.sourceId)] : []);
for (const w of dashboard.watchlist) checkCopy(`watchlist ${w.id}`, w.note, []);
const factsOfEntity = (id: string) => edges.filter(e => e.source === id || e.target === id).flatMap(e => e.sourceIds).map(factOf);
for (const e of entities) checkCopy(`entity ${e.id}`, `${e.label} ${e.sublabel ?? ''}`, factsOfEntity(e.id));
for (const s of sources) ok(!FORBIDDEN.test(s.title) && !/Graham/.test(s.title), `source ${s.id}: title wording`);
for (const p of STATEMENTS) ok(!/Graham/.test(p.kind), `statement ${p.id}: kind names Graham`);
for (const e of edges) checkCopy(`edge ${e.id}`, e.label, e.sourceIds.map(factOf));

// Activity rows: the date is the record's date.
for (const r of dashboard.activity) {
  const f = r.sourceId ? factOf(r.sourceId) : undefined;
  ok(f && (f.date === r.date || (f.kind === 'bill' && r.date === f.date)), `activity ${r.id}: date ${r.date} differs from its record`);
}

// Presenter copy (tour.ts body strings) and UI strings in the feature files.
{
  const tour = readFileSync(path.join(root, 'src/data/tour.ts'), 'utf8');
  for (const m of tour.matchAll(/(?:body|title):\s*([`'"])((?:\\.|(?!\1).)*)\1/g)) {
    const text = m[2];
    const bad = FORBIDDEN.exec(outsideQuotes(text));
    ok(!bad, `tour copy: "${bad?.[0]}" in ${text.slice(0, 60)}`);
    ok(!/Graham/.test(text), `tour copy: names Graham in ${text.slice(0, 60)}`);
  }
  // The steps about the firm's network (who else it contacted, records in common, the shared date): no "met" or "together".
  const blocks = tour.split(/\n\s*\{\n\s*id: '/).slice(1);
  for (const b of blocks.filter(x => /^(who-else-met|records-in-common|time-window|people-)/.test(x))) {
    const id = b.slice(0, b.indexOf("'"));
    for (const m of b.matchAll(/(?:body|title):\s*([`'"])((?:\\.|(?!\1).)*)\1/g)) {
      const bad = FORBIDDEN_NETWORK.exec(outsideQuotes(m[2]));
      ok(!bad, `tour step ${id}: network wording "${bad?.[0]}"`);
    }
  }
}

// The opening answer: each Senate tally it gives is a cited roll call's, a claim that most of each
// party voted yes holds on every one of them, and its dates and counts are the bill records'.
{
  const t = script.find(x => x.id === 'ukraine-stance')!;
  const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const rolls = t.citations
    .map(id => sourceById.get(id)?.recordId ?? '')
    .flatMap(rid => R.senateVotes.filter(v => `vote:${v.id}` === rid));
  ok(rolls.length > 0, 'turn ukraine-stance: cites no Senate roll call');
  for (const v of rolls) {
    const tally = `${v.count.yeas}-${v.count.nays}`;
    ok(t.answer.includes(tally), `turn ukraine-stance: Senate roll call ${v.rollCall} tally ${tally} is not in the answer`);
    if (/most Democrats and most Republicans/.test(t.answer)) {
      for (const party of ['D', 'R'] as const) {
        const p = (v.talliesByParty as Record<string, Record<string, number>>)[party] ?? {};
        ok((p.Yea ?? 0) > (p.Nay ?? 0), `turn ukraine-stance: on Senate roll call ${v.rollCall} most ${party} senators did not vote yes (${p.Yea ?? 0}-${p.Nay ?? 0})`);
      }
    }
  }
  const bill = (id: string) => R.bills.find(b => b.id === id)!;
  const hr815 = bill('HR-815-118');
  const hr5334 = bill('HR-5334-119');
  const s5025 = bill('S-5025-119');
  ok(t.answer.includes(`law on ${longDate(hr815.latestAction.date)}`) && /Became Public Law/.test(hr815.latestAction.text), 'turn ukraine-stance: H.R. 815 law date differs');
  ok(t.answer.includes(`law on ${longDate(hr5334.latestAction.date)}`) && /Became Public Law/.test(hr5334.latestAction.text), 'turn ukraine-stance: H.R. 5334 law date differs');
  const v224 = R.senateVotes.find(v => v.rollCall === 224)!;
  ok(v224.date.startsWith(longDate(isoDate(v224.date))) && t.answer.includes(`86-11 on ${longDate(isoDate(v224.date))}`), 'turn ukraine-stance: H.R. 5334 Senate date differs');
  ok(t.answer.includes(`${s5025.cosponsorCount} cosponsors`), 'turn ukraine-stance: S. 5025 cosponsor count differs');
  const [y, m] = s5025.introducedDate.split('-').map(Number);
  ok(t.answer.includes(`from ${new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`), 'turn ukraine-stance: S. 5025 month differs');
  ok(/referred to the Committee/.test(s5025.latestAction.text) && /in committee/.test(t.answer), 'turn ukraine-stance: S. 5025 status differs');
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`FAILED: ${errors.length} of ${checks} checks`);
  process.exitCode = 1;
} else {
  console.log(`${sources.length} sources match their records (URL, date, excerpt) · ${entities.filter(e => e.type === 'person').length} people · ${entities.filter(e => e.type === 'org').length} organizations · ${MORAN_UA_SHARED_DATES.length} shared contact dates · ${STATEMENTS.length} public statements`);
  console.log(`OK: ${checks} checks against src/data/records/real-records.json`);
}
