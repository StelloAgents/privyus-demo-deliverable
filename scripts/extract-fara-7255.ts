/**
 * Builds the Moran Global Strategies network records from the original filings.
 *
 *   npx tsx scripts/extract-fara-7255.ts <7255.pdf> [MemberData.xml] [vote_118_2_00154.xml]
 *
 * Inputs (each is downloaded when no path is given):
 * - the FARA supplemental statement, No. 7255, received 11/26/2024 (efile.fara.gov);
 *   needs `pdftotext` (poppler) on the PATH;
 * - the House Clerk's member data XML (clerk.house.gov), for each House member's
 *   party, state, and district;
 * - Senate roll call 154 of the 118th Congress (senate.gov), for Bob Casey's
 *   party and state (he is not in the current Senate roster).
 *
 * Outputs:
 * - src/data/records/fara-7255-pages.txt: the text of the pages used (20 to 22,
 *   51 to 53), from `pdftotext -layout`, one "=== Page N ===" block per page;
 * - src/data/records/real-records.json: `fara.contacts` (every row for The
 *   Ministry for Strategic Industries of Ukraine, replacing the earlier ones;
 *   other principals' rows stay as they are), `fara.contributions` (James P.
 *   Moran's contributions to people in that contact list), `houseMembers`, and
 *   `formerSenators`.
 *
 * Nothing here is typed by hand: every row, amount, party, and state comes from
 * the inputs. scripts/check-real-records.ts checks the result against the page text.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTACT_PAGES,
  CONTRIBUTION_PAGES,
  EMPLOYERS_ONLY,
  FILING_URL,
  UA_CONTACT_PEOPLE,
  UA_PRINCIPAL,
  contactOfRecipient,
  parseContributions,
  parseUkraineContacts,
  personOfRow,
  slug,
  splitPages,
} from './lib/fara-7255';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECORDS = path.join(root, 'src/data/records/real-records.json');
const PAGES = path.join(root, 'src/data/records/fara-7255-pages.txt');
const CLERK_URL = 'https://clerk.house.gov/xml/lists/MemberData.xml';
const VOTE_URL = 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1182/vote_118_2_00154.xml';
const retrievedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

const tmp = mkdtempSync(path.join(tmpdir(), 'fara-7255-'));
function input(arg: string | undefined, url: string, name: string): string {
  if (arg) return arg;
  const out = path.join(tmp, name);
  execFileSync('curl', ['-sS', '-f', '-m', '60', '-A', 'Mozilla/5.0', '-o', out, url]);
  return out;
}
const [pdfArg, clerkArg, voteArg] = process.argv.slice(2);
const pdf = input(pdfArg, FILING_URL, '7255.pdf');
const clerkXml = readFileSync(input(clerkArg, CLERK_URL, 'MemberData.xml'), 'utf8');
const voteXml = readFileSync(input(voteArg, VOTE_URL, 'vote_118_2_00154.xml'), 'utf8');

/* 1. Page text ------------------------------------------------------ */

const pageText = [...CONTACT_PAGES, ...CONTRIBUTION_PAGES]
  .map(p => `=== Page ${p} ===\n${execFileSync('pdftotext', ['-f', String(p), '-l', String(p), '-layout', pdf, '-'], { encoding: 'utf8' }).replace(/\f/g, '')}`)
  .join('\n');
writeFileSync(PAGES, pageText.endsWith('\n') ? pageText : `${pageText}\n`);
const pages = splitPages(pageText);

/* 2. Contact rows --------------------------------------------------- */

const R = JSON.parse(readFileSync(RECORDS, 'utf8'));
const uaRows = parseUkraineContacts(pages).map(r => {
  const p = personOfRow(r.contactAsWritten);
  return {
    castMember: p.castMember,
    date: r.date,
    principal: r.principal,
    contactAsWritten: r.contactAsWritten,
    method: r.method,
    subject: r.subject,
    page: r.page,
    viaStaff: p.group === 'staff',
    group: p.group,
    staffOf: p.staffOf ?? null,
    sourceUrl: FILING_URL,
    verified: true,
  };
});
// The earlier Ukraine rows must come back word for word (they are cited already).
type Row = { castMember: string; date: string; principal: string; contactAsWritten: string; method: string; subject: string; page: number };
const key = (r: Row) => [r.castMember, r.date, r.contactAsWritten, r.method, r.subject, r.page].join('|');
const parsedKeys = new Set(uaRows.map(key));
for (const old of (R.fara.contacts as Row[]).filter(r => r.principal === UA_PRINCIPAL)) {
  if (!parsedKeys.has(key(old))) throw new Error(`earlier row not found in the PDF text: ${key(old)}`);
}
const others = (R.fara.contacts as Row[]).filter(r => r.principal !== UA_PRINCIPAL).map(r => ({ group: null, staffOf: null, ...r }));
R.fara.contacts = [...others, ...uaRows];

/* 3. Contributions -------------------------------------------------- */

const contributions = parseContributions(pages)
  .filter(c => c.donor === 'James P. Moran')
  .flatMap(c => {
    const castMember = contactOfRecipient(c.recipientAsWritten);
    return castMember ? [{ castMember, ...c, sourceUrl: FILING_URL, verified: true }] : [];
  });
R.fara.contributions = contributions;

/* 4. House members (Clerk member data) ------------------------------ */

const publishDate = /<MemberData publish-date="([^"]+)"/.exec(clerkXml)?.[1];
if (!publishDate) throw new Error('MemberData.xml: no publish date');
const blocks = [...clerkXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map(m => m[1]);
const tag = (b: string, t: string) => new RegExp(`<${t}>([^<]*)</${t}>`).exec(b)?.[1]?.trim() ?? '';
const house = [...UA_CONTACT_PEOPLE.filter(p => p.group === 'house').map(p => ({ last: p.castMember, written: p.written })), ...EMPLOYERS_ONLY.map(last => ({ last, written: undefined }))];
const staffRole = (last: string) => UA_CONTACT_PEOPLE.find(p => p.staffOf === last)?.role ?? '';
R.houseMembers = house.map(({ last, written }) => {
  let hits = blocks.filter(b => tag(b, 'lastname') === last);
  if (hits.length > 1) {
    // Two members share the last name (Scott): keep the one whose name the filing uses.
    const first = (written?.source.match(/Representative (\w+)/)?.[1] ?? staffRole(last).match(/Rep\. (\w+)/)?.[1]) ?? '';
    hits = hits.filter(b => tag(b, 'official-name').includes(first) || tag(b, 'firstname') === first);
  }
  if (hits.length !== 1) throw new Error(`MemberData.xml: ${hits.length} members named ${last}`);
  const b = hits[0];
  const state = /<state postal-code="([A-Z]{2})"/.exec(b)?.[1] ?? '';
  const m = {
    id: slug(last),
    lastName: last,
    firstName: tag(b, 'firstname'),
    officialName: tag(b, 'official-name').replace(/&quot;/g, '"'),
    party: tag(b, 'party'),
    state,
    stateDistrict: tag(b, 'statedistrict'),
    bioguideId: tag(b, 'bioguideID'),
    sourceUrl: CLERK_URL,
    publishDate,
    retrievedAt,
    verified: true,
    excerpt: '',
  };
  m.excerpt = `${m.officialName} (${m.party}-${m.state}) · ${m.stateDistrict} · Bioguide ${m.bioguideId}`;
  return m;
});

/* 5. Former senators (Senate roll call XML) ------------------------- */

R.formerSenators = UA_CONTACT_PEOPLE.filter(p => p.group === 'senate' && !R.members.some((m: { lastName: string }) => m.lastName === p.castMember)).map(p => {
  const b = [...voteXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map(x => x[1]).find(x => tag(x, 'last_name') === p.castMember);
  if (!b) throw new Error(`roll call 154: no ${p.castMember}`);
  return {
    id: slug(p.castMember),
    lastName: p.castMember,
    firstName: tag(b, 'first_name'),
    party: tag(b, 'party'),
    state: tag(b, 'state'),
    lisMemberId: tag(b, 'lis_member_id'),
    sourceUrl: VOTE_URL,
    retrievedAt,
    verified: true,
    excerpt: `${tag(b, 'member_full')} · Senate roll call 154, 118th Congress, April 23, 2024`,
  };
});

// The file was first written by Python: keep its float style for the agreement percentages ("pct": 60.0).
writeFileSync(RECORDS, `${JSON.stringify(R, null, 1).replace(/("pct": )(\d+)(,?)$/gm, '$1$2.0$3')}\n`);
console.log(`${uaRows.length} Ukraine-principal contact rows · ${contributions.length} contributions · ${R.houseMembers.length} House members · ${R.formerSenators.length} former senators`);
console.log(`wrote ${path.relative(root, PAGES)} and ${path.relative(root, RECORDS)}`);
