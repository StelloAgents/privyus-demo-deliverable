/**
 * The real-records fact base, normalized: one `Fact` per public record the demo
 * can cite, with its URLs, its ISO date, a canonical excerpt, and the verbatim
 * text it holds (`corpus`). `real-records.json` is a copy of the verified
 * fact base (retrieved 2026-10-10); this module only reshapes it.
 *
 * Canonical excerpts are either the record's own excerpt (votes, statements,
 * trips, House members) or record fields joined with " · " (bills, FARA rows and
 * contributions, FEC totals, hearings). The Ukraine-principal FARA rows, the
 * contributions, and the House members come from scripts/extract-fara-7255.ts. Every SourceDoc in src/data/sources.ts must use one of these
 * excerpts exactly (scripts/check-real-records.ts checks it).
 */
import data from './real-records.json';

export type FactKind =
  | 'member'
  | 'house-member'
  | 'former-senator'
  | 'senate-vote'
  | 'house-vote'
  | 'bill'
  | 'trip'
  | 'fara-registrant'
  | 'fara-registrant-bulk'
  | 'fara-principal'
  | 'fara-contact'
  | 'fara-contribution'
  | 'fec'
  | 'statement'
  | 'hearing';

export interface Fact {
  id: string;
  kind: FactKind;
  urls: string[];
  /** ISO date (yyyy-mm-dd). */
  date: string;
  excerpt: string;
  /** Every verbatim string in the record (numbers also as "$10,000"). */
  corpus: string[];
}

export const realRecords = data;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map(m => m.slice(0, 3));
const pad = (n: number) => String(n).padStart(2, '0');

/** "July 20, 2023,  03:26 PM", "16-Sep-2026", "05/20/2024", "2023-07-12", "February 13, 2025" -> ISO. */
export function isoDate(s: string): string {
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  m = /^(\d{1,2})-([A-Z][a-z]{2})-(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${pad(SHORT.indexOf(m[2]) + 1)}-${pad(Number(m[1]))}`;
  m = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})/.exec(s);
  if (m && MONTHS.includes(m[1])) return `${m[3]}-${pad(MONTHS.indexOf(m[1]) + 1)}-${pad(Number(m[2]))}`;
  throw new Error(`facts: unknown date format "${s}"`);
}

export const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function corpusOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'number') out.push(String(value), money(value));
  else if (Array.isArray(value)) value.forEach(v => corpusOf(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => corpusOf(v, out));
  return out;
}

const slugPrincipal = (p: string) => (/Ukraine/.test(p) ? 'ukraine' : /Qatar/.test(p) ? 'qatar' : /Armenia/.test(p) ? 'armenia' : 'other');

/** The display first name: "Roger F." -> "Roger", "Angus S., Jr." -> "Angus". */
export const firstNameOf = (first: string) => first.replace(/,.*$/, '').split(/\s+/)[0];

const facts: Fact[] = [];
const add = (f: Omit<Fact, 'corpus'>, raw: unknown) => facts.push({ ...f, corpus: corpusOf(raw) });

for (const m of data.members) {
  add({ id: `member:${m.id}`, kind: 'member', urls: [m.sourceUrl], date: isoDate(m.retrievedAt), excerpt: `${firstNameOf(m.firstName)} ${m.lastName} (${m.party}-${m.state}) · ${m.class}` }, m);
}
for (const m of data.houseMembers) {
  add({ id: `member:${m.id}`, kind: 'house-member', urls: [m.sourceUrl], date: isoDate(m.publishDate), excerpt: m.excerpt }, m);
}
for (const m of data.formerSenators) {
  add({ id: `member:${m.id}`, kind: 'former-senator', urls: [m.sourceUrl], date: '2024-04-23', excerpt: m.excerpt }, m);
}
for (const v of data.senateVotes) {
  add({ id: `vote:${v.id}`, kind: 'senate-vote', urls: [v.sourceUrl], date: isoDate(v.date), excerpt: v.excerpt }, v);
}
for (const v of data.houseVotes) {
  add({ id: `vote:${v.id}`, kind: 'house-vote', urls: [v.sourceUrl], date: isoDate(v.date), excerpt: v.excerpt }, v);
}
for (const b of data.bills) {
  const sponsor = b.sponsors[0]?.name;
  const excerpt = [b.title, sponsor ? `Sponsor: ${sponsor}` : '', `Introduced ${b.introducedDate}`, `Latest action ${b.latestAction.date}: ${b.latestAction.text}`].filter(Boolean).join(' · ');
  add({ id: `bill:${b.id}`, kind: 'bill', urls: [b.sourceUrl, b.congressGovUrl], date: b.latestAction.date, excerpt }, b);
}
for (const t of data.trips) {
  const list = t.memberListAsStated.length === 1 && t.memberListAsStated[0] === t.excerpt ? '' : ` Members listed: ${t.memberListAsStated.join('; ')}`;
  add({ id: `trip:${t.id}`, kind: 'trip', urls: [t.sourceUrl, t.secondSource].filter((u): u is string => !!u), date: isoDate(t.releaseDate), excerpt: `${t.excerpt}${list}` }, t);
}
{
  const r = data.fara.registrant;
  const received = /received (\d{2}\/\d{2}\/\d{4})/.exec(r.filing)![1];
  add({ id: 'fara:registrant', kind: 'fara-registrant', urls: [r.sourceUrl], date: isoDate(received), excerpt: `${r.name} · Registration No. ${r.registrationNumber} · ${r.filing}` }, r);
  const b = data.fara.registrantBulk;
  add({ id: 'fara:registrant-bulk', kind: 'fara-registrant-bulk', urls: [b.sourceUrl], date: isoDate(b.registrationDate), excerpt: `${b.name} · Registration No. ${b.registrationNumber} · Registered ${b.registrationDate} · ${b.address}, ${b.city}, ${b.state}` }, b);
}
for (const p of data.fara.principals) {
  const term = p.fpTerminationDate ? ` · Terminated ${p.fpTerminationDate}` : '';
  add({ id: `fara:principal:${slugPrincipal(p.foreignPrincipal)}`, kind: 'fara-principal', urls: [p.sourceUrl], date: isoDate(p.fpRegistrationDate), excerpt: `${p.foreignPrincipal} (${p.country}) · Registered ${p.fpRegistrationDate}${term} · Registrant: ${p.registrant}` }, p);
}
{
  const groups = new Map<string, (typeof data.fara.contacts)[number][]>();
  for (const c of data.fara.contacts) {
    const key = `fara:contact:${c.castMember.toLowerCase().replace(/\s+/g, '-')}:${slugPrincipal(c.principal)}:${isoDate(c.date)}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const [id, rows] of groups) {
    const excerpt = rows.map(r => `${r.date} · ${r.contactAsWritten} · ${r.method} · ${r.subject} · Foreign principal: ${r.principal} · Page ${r.page}`).join(' | ');
    add({ id, kind: 'fara-contact', urls: [rows[0].sourceUrl], date: isoDate(rows[0].date), excerpt }, rows);
  }
}
{
  // Political contributions listed in the same FARA filing (Item 15(c)), one fact per recipient and date.
  const groups = new Map<string, (typeof data.fara.contributions)[number][]>();
  for (const c of data.fara.contributions) {
    const key = `fara:contribution:${c.castMember.toLowerCase().replace(/\s+/g, '-')}:${isoDate(c.date)}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const [id, rows] of groups) {
    const excerpt = rows.map(r => `${r.date} · Donor: ${r.donor} · ${r.recipientAsWritten} · ${r.method} · $${r.amountAsWritten} · Page ${r.page}`).join(' | ');
    add({ id, kind: 'fara-contribution', urls: [rows[0].sourceUrl], date: isoDate(rows[0].date), excerpt }, rows);
  }
}
{
  const groups = new Map<string, (typeof data.fec.contributions)[number][]>();
  for (const c of data.fec.contributions) {
    const key = `fec:${c.senator.toLowerCase().replace(/\s+/g, '-')}:${c.cycle}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const [id, rows] of groups) {
    rows.sort((a, b) => a.pac.localeCompare(b.pac));
    const last = rows.flatMap(r => r.transactions.map(t => t.date)).sort().at(-1)!;
    const excerpt = `${rows[0].senator} · ${rows[0].cycle} · ${rows.map(r => `${r.pac} PAC ${money(r.netTotal)} (${r.transactionCount} transactions)`).join('; ')}`;
    const urls = [rows[0].candidatePage, ...new Set(rows.map(r => r.sourceUrl)), ...rows.map(r => r.fecUrl)];
    add({ id, kind: 'fec', urls, date: last, excerpt }, rows);
  }
}
for (const s of data.statements) {
  add({ id: `stmt:${s.id}`, kind: 'statement', urls: [s.sourceUrl!], date: s.date!, excerpt: s.excerpt! }, s);
}
/** "[META og:title] SABOTAGE ... | United States Senate ..." -> "SABOTAGE ...". */
export const hearingTitle = (t: string) =>
  t.replace(/^\[META og:title\]\s*/, '').replace(/^Hearing:\s*\[\d{4}-\d{2}-\d{2}\]\s*/, '').replace(/\s*\|.*$/, '').replace(/\.{3}$/, '').trim();
for (const h of data.hearings) {
  add({ id: `hearing:${h.id}`, kind: 'hearing', urls: [h.sourceUrl], date: h.date, excerpt: `${h.committee} · ${h.type} · ${h.dateAsStated} · ${hearingTitle(h.title)}` }, h);
}

export const factList: Fact[] = facts;
export const factById: Map<string, Fact> = new Map(facts.map(f => [f.id, f]));
