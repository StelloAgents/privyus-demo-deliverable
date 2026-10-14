import type { ScriptTurn } from './types';
import { HR5334_VOTES, HR5334_VOTE_DATE, MORAN_CONTRIBUTIONS, MORAN_UA_NETWORK, MORAN_UA_SHARED_DATES, MORAN_UA_STAFF, MUNICH_2025_OTHERS, S5025_COSPONSORS, entities, uaContactSource, uaDayId } from './entities';
import { sources } from './sources';

const empty = { entities: [], edges: [] };

/** The records-in-common question (the presenter tour types it). */
export const RECORDS_IN_COMMON_QUESTION = 'Which of these people also cosponsored S. 5025 or voted yes on H.R. 5334?';

/*
 * The Explore story, from public records only. Answers state what each record
 * says, with its date; quoted text is verbatim from the cited record
 * (scripts/check-real-records.ts checks every quote). Links are records in
 * common, never a cause.
 */

const cosponsors = S5025_COSPONSORS;
const cosponsorEdges = cosponsors.map(id => `s5025-${id}`);
const pacs = ['pac-boeing', 'pac-gd', 'pac-northrop', 'pac-lockheed', 'pac-rtx'];
const pacEdges = pacs.map(id => `${id}-cat-contributions`);
/** Everyone the firm lists for its Ukraine principal (senators, House members, staff, press), and the firm's edge to each. */
const moranContacts = MORAN_UA_NETWORK.map(([person]) => person);
// Wicker's own contact stays on the graph as his June 9 record (Contacts), the way back to him.
const moranContactEdges = moranContacts.filter(p => p !== 'wicker').map(p => `moran-${p}`);
/** Staff to the members the filing names as employers (Calvert and Bacon appear only this way). */
const staffEdges = Object.entries(MORAN_UA_STAFF).map(([staff, member]) => `${staff}-staff-of-${member}`);
const employersOnly = [...new Set(Object.values(MORAN_UA_STAFF))].filter(m => !moranContacts.includes(m));
/** Contributions by James P. Moran listed in the same filing: faint record nodes next to their recipients. */
const moranContribs = MORAN_CONTRIBUTIONS.map(([detail]) => detail);
const moranContribEdges = MORAN_CONTRIBUTIONS.map(([detail, member]) => `${detail}-${member}`);

/* ------------------------------------------------------------------ */
/* People beyond votes: shared records, one step and two steps out      */
/* ------------------------------------------------------------------ */
/*
 * People connect through the record they share: a delegation list, a FARA
 * registrant, a PAC, a bill, or a date on which the firm lists a contact with
 * each of them (src/data/entities.ts, MORAN_UA_SHARED_DATES). Every name, date,
 * and number below comes from that data and the cited rows.
 */
const entityById = new Map(entities.map(e => [e.id, e]));
const label = (id: string) => entityById.get(id)?.label ?? id;
/** "Wicker" for a member of Congress, the full name for staff and press. */
const short = (id: string) => (/^(Sen|Rep)\. /.test(label(id)) ? label(id).replace(/^(?:Sen|Rep)\. /, '').split(' ').slice(1).join(' ') || label(id) : label(id));
const list = (items: string[]) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
const numberWord = (n: number) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] ?? String(n);
/** One contact row of the filing: "05/22/2024 · Senator ... · In-person · <subject> · Foreign principal: ... · Page 20". */
const row = (person: string, date: string) => {
  const parts = (sources.find(x => x.id === uaContactSource(person, date))?.excerpt ?? '').split(' · ');
  return { method: parts[2] === 'In-person' ? 'in person' : parts[2] === 'Phone' ? 'by phone' : (parts[2] ?? '').toLowerCase(), subject: parts[3] ?? '', page: (parts.at(-1) ?? '').replace('Page ', 'page ') };
};
const datesOf = (person: string) => MORAN_UA_SHARED_DATES.filter(([, ps]) => ps.includes(person));
const MEANING = 'A shared date means only that the firm reported a contact with each person on that date.';

/** Wicker's shared contact date: the firm lists him and one other person on June 9, 2024. */
const WICKER_DATE = datesOf('wicker')[0];
const WICKER_DAY = uaDayId(WICKER_DATE[0]);
const WICKER_DAY_OTHERS = WICKER_DATE[1].filter(p => p !== 'wicker');

/* Records in common: the firm's contacts on the same bills (S. 5025 cosponsors, H.R. 5334 votes). */
const FIRM_CONTACTS = MORAN_UA_NETWORK.map(([p]) => p);
const isSenator = (p: string) => label(p).startsWith('Sen.');
/** "Wicker, Blumenthal, ..." in the firm's order, Wicker first (the member the story starts from). */
const wickerFirst = (ps: string[]) => [...ps.filter(p => p === 'wicker'), ...ps.filter(p => p !== 'wicker')];
const byName = (ps: string[]) => [...ps].sort((a, b) => short(a).localeCompare(short(b)));
const RIC_COSPONSORS = wickerFirst(byName(FIRM_CONTACTS.filter(p => S5025_COSPONSORS.includes(p))));
const RIC_VOTERS = FIRM_CONTACTS.filter(p => HR5334_VOTES[p]);
const RIC_YES = RIC_VOTERS.filter(p => HR5334_VOTES[p] === 'yes');
const RIC_NO = RIC_VOTERS.filter(p => HR5334_VOTES[p] === 'no');
const RIC_YES_SENATE = byName(RIC_YES.filter(isSenator));
const RIC_YES_HOUSE = byName(RIC_YES.filter(p => !isSenator(p)));
const RIC_NO_SENATE = byName(RIC_NO.filter(isSenator));
const RIC_NO_HOUSE = byName(RIC_NO.filter(p => !isSenator(p)));
/** Staff and press cast no votes; a listed member with no position held no seat on the roll call. */
const RIC_STAFF_PRESS = FIRM_CONTACTS.filter(p => ['staff', 'press'].includes(entityById.get(p)?.group ?? ''));
const RIC_STAFF = RIC_STAFF_PRESS.filter(p => entityById.get(p)?.group === 'staff');
const RIC_PRESS = RIC_STAFF_PRESS.filter(p => entityById.get(p)?.group === 'press');
const RIC_NOT_ON_ROLL = FIRM_CONTACTS.filter(p => !HR5334_VOTES[p] && !RIC_STAFF_PRESS.includes(p));
const RIC_COSPONSORS_YES = RIC_COSPONSORS.filter(p => HR5334_VOTES[p] === 'yes');
const yesEdges = RIC_YES.map(p => `hr5334-yes-${p}`);
const cosponsorContactEdges = RIC_COSPONSORS.map(p => `s5025-${p}`);
const reps = (ps: string[]) => (ps.length === 1 ? `Rep. ${short(ps[0])}` : `Reps. ${list(ps.map(short))}`);

/** Blumenthal: a firm contact who is also an S. 5025 cosponsor, on Wicker's Munich 2025 delegation list, and a recipient the filing lists. */
const FOCUS_MEMBER = RIC_COSPONSORS.find(p => p !== 'wicker' && MUNICH_2025_OTHERS.includes(p) && MORAN_CONTRIBUTIONS.some(([, m]) => m === p))!;
const MEMBER_DATE = datesOf(FOCUS_MEMBER)[0][0];
const MEMBER_ROW = row(FOCUS_MEMBER, MEMBER_DATE);
const MEMBER_RTX = (entityById.get(`contrib-rtx-${FOCUS_MEMBER}`)?.label ?? '').replace('RTX PAC · ', '').replace(', ', ' in ');
const MEMBER_GIFT = MORAN_CONTRIBUTIONS.find(([, m]) => m === FOCUS_MEMBER)!;
const s5025Date = longDate('2026-07-16');

export const script: ScriptTurn[] = [
  {
    id: 'ukraine-stance',
    trigger: { question: "What is the United States' stance on Ukraine?", keywords: ['United States', 'stance', 'Ukraine'] },
    steps: [
      { label: 'Set root node', delta: { add: { entities: ['ukraine'], edges: [] }, focus: 'ukraine' } },
      { label: 'Query the database', delta: { add: empty } },
      { label: 'Find related legislation', delta: { add: { entities: ['hr815', 's5025', 'hr5334'], edges: ['ukraine-hr815', 'ukraine-s5025', 'ukraine-hr5334'] }, ghost: { entities: cosponsors, edges: cosponsorEdges } } },
      { label: 'Establish connections', delta: { add: { entities: [], edges: [] } } },
      { label: 'Render', delta: { add: empty, focus: 'ukraine' } },
    ],
    answer:
      'On the record, Congress backs Ukraine and presses Russia. In the Senate, most Democrats and most Republicans voted yes.\n- Aid: the Senate approved the final text of H.R. 815, the 2024 emergency supplemental, 79-18. It became law on April 24, 2024.\n- Sanctions: H.R. 5334 passed the Senate 86-11 on August 7, 2026. The House agreed 262-159, and it became law on September 18, 2026.\n- Pending: S. 5025, a further Russia sanctions bill from July 2026, has 63 cosponsors. It is in committee.\nThe record shows votes and bill text, not intent. Select S. 5025 to see who cosponsored it.',
    citations: ['bill-hr815', 'roll-s154', 'bill-s5025', 'bill-hr5334', 'roll-s224', 'roll-h308', 'hearing-sfrc-0325'],
    suggestions: ['Who cosponsored S. 5025?', 'How did H.R. 5334 become law?', 'Which defense PACs gave to Wicker?'],
  },
  {
    id: 's5025-cosponsors',
    trigger: { nodeClick: 's5025' },
    steps: [
      { label: 'Focus S. 5025', delta: { add: empty, focus: 's5025' } },
      { label: 'Query the bill record', delta: { add: empty } },
      { label: 'Populate members', delta: { add: { entities: cosponsors, edges: cosponsorEdges } } },
      { label: 'Establish connections', delta: { add: { entities: [], edges: [] } } },
      { label: 'Render', delta: { add: empty, focus: 's5025', expand: 's5025' } },
    ],
    answer:
      'S. 5025 has 63 cosponsors, and 17 of the 19 senators in this exploration are among them.\n- All 17 are original cosponsors, dated July 16, 2026: Barrasso, Blumenthal, Coons, Cramer, Daines, Durbin, Ernst, Fischer, Heinrich, Kaine, King, Murkowski, Shaheen, Sullivan, Tillis, Van Hollen, and Wicker.\n- The bill record lists the sponsor as “Sen. Graham, Darline [R-SC]”.\n- Markey and Warner are not on the cosponsor list.\nThe record has no floor vote on this bill.',
    citations: ['bill-s5025'],
    suggestions: ['Explore Sen. Roger Wicker', 'How did H.R. 5334 become law?'],
  },
  {
    id: 'wicker-profile',
    trigger: { nodeClick: 'wicker' },
    steps: [
      { label: 'Focus Sen. Roger Wicker', delta: { add: empty, focus: 'wicker' } },
      { label: 'Query public records', delta: { add: empty } },
      { label: 'Populate categories', delta: { add: { entities: ['cat-votes', 'cat-trips', 'cat-contacts', 'cat-contributions', 'cat-statements', 'cat-others'], edges: ['wicker-cat-votes', 'wicker-cat-trips', 'wicker-cat-contacts', 'wicker-cat-contributions', 'wicker-cat-statements', 'wicker-cat-others'] } } },
      { label: 'Establish connections', delta: { add: { entities: [], edges: [] } } },
      { label: 'Render', delta: { add: empty, focus: 'wicker', expand: 'wicker' } },
    ],
    answer:
      'Sen. Roger Wicker has records in six groups here: Votes, Trips, Contacts, Contributions, Statements, and Others.\n- Votes: eight Ukraine-related Senate roll calls from 2023 to 2026.\n- Trips and contacts: the Munich Security Conference 2025 delegation, and a June 9, 2024 FARA contact entry for a Ukrainian government principal.\n- Contributions: transfers from five defense company PACs in 2023-24.\n- Statements: three statements from August and September 2026.\nOpen a group to see each record and its source.',
    citations: ['roll-s224', 'travel-munich-2025', 'fara-wicker-ua-0609', 'fec-wicker-2024', 'stmt-wicker-0807'],
    suggestions: ['Show Wicker contacts', 'Show Wicker contributions'],
  },
  {
    id: 'wicker-contacts',
    trigger: { nodeClick: 'cat-contacts' },
    steps: [
      { label: 'Focus Contacts', delta: { add: empty, focus: 'cat-contacts' } },
      { label: 'Query FARA filings', delta: { add: empty } },
      { label: 'Populate contacts', delta: { add: { entities: ['contact-ua-0609'], edges: ['cat-contacts-contact-ua-0609'] } } },
      { label: 'Establish connections', delta: { add: { entities: [], edges: [] } } },
      { label: 'Render', delta: { add: empty, focus: 'cat-contacts', expand: 'cat-contacts' } },
    ],
    answer:
      'Moran Global Strategies, a FARA registrant, lists one contact with Wicker: an in-person contact on June 9, 2024.\n- The firm filed it for The Ministry for Strategic Industries of Ukraine.\n- The filing names “Senator Roger Wicker”. The subject is “Discussion of National Defense Authorization Act”.\n- The source is the firm’s supplemental statement for the six months ending October 31, 2024.\nSelect the June 9 entry to see the registrant and its principal.',
    citations: ['fara-wicker-ua-0609', 'fara-moran-supplemental'],
    suggestions: ['Who filed the June 9 contact?', 'Which FARA registrant contacted Wicker?'],
  },
  {
    id: 'moran-contact',
    trigger: { nodeClick: 'contact-ua-0609' },
    steps: [
      { label: 'Focus the June 9 contact', delta: { add: empty, focus: 'contact-ua-0609' } },
      { label: 'Query the FARA filing', delta: { add: empty } },
      { label: 'Populate registrant', delta: { add: { entities: ['moran'], edges: ['contact-ua-0609-moran'] } } },
      { label: 'Establish connections', delta: { add: { entities: ['ua-ministry'], edges: ['moran-ua-ministry'] } } },
      { label: 'Render', delta: { add: empty, focus: 'contact-ua-0609', expand: 'contact-ua-0609' } },
    ],
    answer:
      'Moran Global Strategies, Inc. filed the June 9, 2024 entry for The Ministry for Strategic Industries of Ukraine.\n- Registrant: FARA registration No. 7255, at 1023 Queen Street in Alexandria, Virginia.\n- Principal: registered on 09/24/2023 and terminated on 01/31/2025.\n- Entry: method “In-person”, subject “Discussion of National Defense Authorization Act”, on page 20.\nThe entry gives the subject only, not what was said.',
    citations: ['fara-wicker-ua-0609', 'fara-moran-registration', 'fara-principal-ukraine'],
    suggestions: ['Who else did Moran Global Strategies contact for Ukraine?', 'Which defense PACs gave to Wicker?', 'Who was on the Munich 2025 delegation list with Wicker?'],
  },
  {
    id: 'wicker-contributions',
    trigger: { nodeClick: 'cat-contributions' },
    steps: [
      { label: 'Focus Contributions', delta: { add: empty, focus: 'cat-contributions' } },
      { label: 'Query FEC filings', delta: { add: empty } },
      { label: 'Populate contributions', delta: { add: { entities: pacs, edges: pacEdges } } },
      { label: 'Establish connections', delta: { add: empty } },
      { label: 'Render', delta: { add: empty, focus: 'cat-contributions', expand: 'cat-contributions' } },
    ],
    answer:
      'Five defense company PACs gave $43,500 in all to Wicker’s campaign committee in 2023-24, per FEC bulk data.\n- Boeing $10,000, General Dynamics $10,000, and Northrop Grumman $10,000.\n- Lockheed Martin $8,000 and RTX $5,500.\n- The 2025-26 bulk file lists no transfers from these five PACs to Wicker.\nThese are reported campaign contributions. The record does not tie them to any vote.',
    citations: ['fec-wicker-2024'],
    suggestions: ['Which defense PACs gave to Wicker?', 'Show Wicker contacts'],
  },
  {
    id: 'defense-pac-contributions',
    trigger: { question: 'Which defense PACs gave to Wicker?', keywords: ['defense', 'PACs', 'Wicker'] },
    steps: [
      { label: 'Focus Contributions', delta: { add: empty, focus: 'cat-contributions' } },
      { label: 'Query FEC filings', delta: { add: empty } },
      { label: 'Populate organizations', delta: { add: { entities: ['cat-contributions', ...pacs], edges: pacEdges } } },
      { label: 'Establish connections', delta: { add: { entities: [], edges: [] } } },
      { label: 'Render', delta: { add: empty, focus: 'cat-contributions' } },
    ],
    answer:
      'Five defense company PACs gave to Wicker’s campaign committee in the 2023-24 cycle: Boeing, General Dynamics, Northrop Grumman, Lockheed Martin, and RTX.\n- $10,000 each from Boeing PAC (2 transactions, both on January 31, 2023), General Dynamics PAC (7), and Northrop Grumman PAC (6).\n- $8,000 from Lockheed Martin PAC (5 transactions) and $5,500 from RTX PAC (5). The transactions run from January 30, 2023 to September 24, 2024.\n- Kaine, Heinrich, King, Barrasso, Fischer, and Cramer also received transfers from all five PACs in the same cycle.\nThe source is FEC bulk data. These are reported contributions, and the record does not tie them to any vote.',
    citations: ['fec-wicker-2024', 'fec-kaine-2024', 'fec-heinrich-2024'],
    suggestions: ['Which FARA registrant contacted Wicker?', 'Who was on the Munich 2025 delegation list with Wicker?'],
  },
  {
    id: 'moran-registrant',
    trigger: { question: 'Which FARA registrant contacted Wicker?', keywords: ['FARA', 'registrant', 'Wicker'] },
    steps: [
      { label: 'Focus Sen. Roger Wicker', delta: { add: empty, focus: 'wicker' } },
      { label: 'Query FARA filings', delta: { add: empty } },
      { label: 'Populate registrant', delta: { add: { entities: ['cat-contacts', 'contact-ua-0609', 'moran'], edges: ['wicker-cat-contacts', 'cat-contacts-contact-ua-0609', 'contact-ua-0609-moran'] } } },
      { label: 'Establish connections', delta: { add: { entities: ['ua-ministry'], edges: ['moran-ua-ministry'] } } },
      { label: 'Render', delta: { add: empty, focus: 'moran' } },
    ],
    answer:
      'Moran Global Strategies, Inc. (FARA No. 7255) is the registrant that lists a contact with Wicker.\n- Contact: June 9, 2024, in person, “Discussion of National Defense Authorization Act”.\n- Principal: The Ministry for Strategic Industries of Ukraine. The firm registered it on 09/24/2023 and terminated it on 01/31/2025.\n- Source: the firm’s supplemental statement for the six months ending October 31, 2024.\nThe filing gives the subject of the contact, not what was said.',
    citations: ['fara-moran-supplemental', 'fara-wicker-ua-0609', 'fara-principal-ukraine'],
    suggestions: ['Who else did Moran Global Strategies contact for Ukraine?', 'Show Wicker contributions'],
  },
  {
    id: 'hr5334-path',
    trigger: { question: 'How did H.R. 5334 become law?', keywords: ['H.R. 5334', 'become law'] },
    steps: [
      { label: 'Focus H.R. 5334', delta: { add: empty, focus: 'hr5334' } },
      { label: 'Query the bill record', delta: { add: empty } },
      { label: 'Populate actions', delta: { add: { entities: ['step-s212', 'step-s224', 'step-h308', 'step-law'], edges: ['hr5334-step-s212', 'hr5334-step-s224', 'hr5334-step-h308', 'hr5334-step-law'] } } },
      { label: 'Establish connections', delta: { add: { entities: [], edges: [] } } },
      { label: 'Render', delta: { add: empty, focus: 'hr5334', expand: 'hr5334' } },
    ],
    answer:
      'H.R. 5334 became law on September 18, 2026, as Public Law 119-111, through votes in both chambers.\n- House: Rep. Jimmy Panetta introduced it on September 11, 2025. The House passed it by voice vote on April 27, 2026.\n- Senate: the Senate invoked cloture on the motion to proceed 86-12 on July 28, 2026. It passed the bill “with an amendment and an amendment to the Title” 86-11 on August 7 (roll call 224).\n- House again: the House agreed to the Senate amendments 262-159 on September 16 (roll call 308).\nThe record shows the votes, not the reasons for them.',
    citations: ['bill-hr5334', 'roll-s212', 'roll-s224', 'roll-h308'],
    suggestions: ['Which defense PACs gave to Wicker?', 'Explore Sen. Roger Wicker'],
  },
  {
    id: 'moran-network',
    trigger: { question: 'Who else did Moran Global Strategies contact for Ukraine?', keywords: ['who else', 'Moran', 'contact', 'Ukraine'] },
    steps: [
      { label: 'Focus Moran Global Strategies', delta: { add: empty, focus: 'moran' } },
      { label: 'Query the FARA contact table', delta: { add: empty } },
      { label: 'Populate every contact', delta: { add: { entities: moranContacts, edges: moranContactEdges } } },
      { label: 'Link staff to their members', delta: { add: { entities: employersOnly, edges: staffEdges }, ghost: { entities: moranContribs, edges: moranContribEdges } } },
      { label: 'Render', delta: { add: empty, focus: 'moran' } },
    ],
    answer:
      'For this Ukraine principal, Moran Global Strategies lists contacts with 25 people: 8 senators, 12 House members, 4 staff members, and 1 reporter.\n- The senators are Durbin, Blumenthal, Markey, Warner, Wicker, Casey, Kaine, and Van Hollen. Two staff rows name Rep. Ken Calvert and Rep. Don Bacon as employers.\n- The filing has 43 contact rows from May 20 to October 16, 2024, on pages 20 to 22.\n- On 8 dates it lists two or more of these people on the same day, for example Wicker and Rep. Mike Turner on June 9, and Blumenthal, Markey, and Rep. Bobby Scott on May 22.\n- The small dots are political contributions by James P. Moran, also listed in this filing.\nA shared date means only that the firm reported a contact with each person on that date.',
    citations: ['fara-moran-supplemental', 'fara-wicker-ua-0609', 'fara-turner-ua-0609', 'fara-blumenthal-ua-0522', 'fara-markey-ua-0522', 'fara-scott-ua-0522', 'fara-keightley-ua-0603', 'fara-dreiling-ua-0618'],
    suggestions: ['Who was on the Munich 2025 delegation list with Wicker?', 'Which defense PACs gave to Wicker?'],
  },
  {
    id: 'munich-trip',
    trigger: { question: 'Who was on the Munich 2025 delegation list with Wicker?', keywords: ['delegation list', 'Munich', 'delegation', 'trip'] },
    steps: [
      { label: 'Focus Sen. Roger Wicker', delta: { add: empty, focus: 'wicker' } },
      { label: 'Query travel releases', delta: { add: empty } },
      { label: 'Populate delegation', delta: { add: { entities: ['cat-trips', 'trip-munich-2025', ...MUNICH_2025_OTHERS], edges: ['wicker-cat-trips', 'cat-trips-trip-munich-2025', ...MUNICH_2025_OTHERS.map(id => `${id}-trip-munich-2025`)] } } },
      { label: 'Check the second release', delta: { add: empty } },
      { label: 'Render', delta: { add: empty, focus: 'trip-munich-2025' } },
    ],
    answer:
      'Seven other senators in this exploration are on the Munich 2025 delegation list with Wicker: Blumenthal, Coons, Ernst, Sullivan, Tillis, Van Hollen, and Warner.\n- Sen. Whitehouse’s release of February 13, 2025 lists the congressional delegation to that weekend’s Munich Security Conference.\n- A release from Sen. Schiff lists the same members.\nThe releases give no exact travel dates.',
    citations: ['travel-munich-2025'],
    suggestions: ['Which defense PACs gave to Wicker?', 'Who cosponsored S. 5025?'],
  },
  {
    id: 'records-in-common',
    trigger: { question: RECORDS_IN_COMMON_QUESTION, keywords: ['records in common', 'cosponsored', 'voted', 'H.R. 5334'] },
    steps: [
      { label: 'Focus Moran Global Strategies', delta: { add: empty, focus: 'moran' } },
      { label: 'Query the bill records', delta: { add: empty } },
      // The firm's contacts on the same bills: the S. 5025 cosponsor rows (already on the graph) and the H.R. 5334 yes votes.
      { label: 'Link shared bill records', delta: { add: { entities: ['s5025', 'hr5334'], edges: [...cosponsorContactEdges, ...yesEdges] } } },
      { label: 'Establish connections', delta: { add: empty } },
      { label: 'Render', delta: { add: empty, focus: 'moran' } },
    ],
    answer: [
      `Back to the bills. Of the ${FIRM_CONTACTS.length} people the firm lists for this Ukraine principal, ${RIC_COSPONSORS.length} are original cosponsors of S. 5025, and ${RIC_YES.length} voted yes on H.R. 5334.`,
      `- S. 5025: ${list(RIC_COSPONSORS.map(short))} are original cosponsors, dated ${s5025Date}.`,
      `- H.R. 5334, yes: ${RIC_YES_SENATE.length} senators on Senate roll call 224, ${longDate(HR5334_VOTE_DATE.senate)} (${list(RIC_YES_SENATE.map(short))}), and ${RIC_YES_HOUSE.length} House members on House roll call 308, ${longDate(HR5334_VOTE_DATE.house)} (${list(RIC_YES_HOUSE.map(short))}).`,
      `- H.R. 5334, no: ${list([...RIC_NO_SENATE.map(p => `Sen. ${short(p)}`), reps(RIC_NO_HOUSE)])}.`,
      `- No vote to count: the ${RIC_STAFF.length} staff members and the ${RIC_PRESS.length === 1 ? 'reporter' : `${RIC_PRESS.length} reporters`} do not vote, and ${list(RIC_NOT_ON_ROLL.map(short))} ${RIC_NOT_ON_ROLL.length === 1 ? 'is' : 'are'} not on the 2026 Senate roll call.`,
      `${RIC_COSPONSORS_YES.length === RIC_COSPONSORS.length ? `All ${RIC_COSPONSORS.length} cosponsors also voted yes. ` : ''}These are records in common. They do not show a reason for any vote.`,
    ].join('\n'),
    citations: ['bill-s5025', 'roll-s224', 'roll-h308', 'fara-moran-supplemental'],
    suggestions: ['Which defense PACs gave to Wicker?', 'Who was on the Munich 2025 delegation list with Wicker?'],
  },
  {
    id: 'same-date-wicker',
    trigger: { nodeClick: WICKER_DAY },
    steps: [
      // The date record joins the graph with the click: the people on it are already there.
      { label: `Focus ${longDate(WICKER_DATE[0])}`, delta: { add: { entities: [WICKER_DAY], edges: [] }, focus: WICKER_DAY } },
      { label: 'Read the FARA filing rows', delta: { add: empty } },
      { label: 'Populate people listed', delta: { add: { entities: [...WICKER_DATE[1], 'moran'], edges: [...WICKER_DATE[1].map(p => `${WICKER_DAY}-${p}`), ...WICKER_DAY_OTHERS.map(p => `moran-${p}`)] } } },
      { label: 'Establish connections', delta: { add: empty } },
      { label: 'Render', delta: { add: empty, focus: WICKER_DAY } },
    ],
    answer: [
      `The filing lists ${numberWord(WICKER_DATE[1].length)} people on ${longDate(WICKER_DATE[0])}, for the same Ukraine principal: ${list(['wicker', ...WICKER_DAY_OTHERS].map(p => (p === 'wicker' ? 'Wicker' : label(p))))}. The date is the record they share.`,
      ...['wicker', ...WICKER_DAY_OTHERS].map(p => {
        const r = row(p, WICKER_DATE[0]);
        return `- ${short(p)}: ${r.method}, “${r.subject}”, ${r.page}.`;
      }),
      '- The firm reports many of the same visits under other clients too.',
      MEANING,
    ].join('\n'),
    citations: [...WICKER_DATE[1].map(p => uaContactSource(p, WICKER_DATE[0])), 'fara-moran-supplemental'],
    suggestions: ['Which defense PACs gave to Wicker?', 'Who else did Moran Global Strategies contact for Ukraine?'],
  },
  {
    id: 'member-shared-records',
    trigger: { nodeClick: FOCUS_MEMBER },
    steps: [
      { label: `Focus ${label(FOCUS_MEMBER)}`, delta: { add: empty, focus: FOCUS_MEMBER } },
      { label: 'Query public records', delta: { add: empty } },
      {
        label: 'Populate records',
        delta: {
          add: {
            // His records with Wicker: the bill, the firm and its date, the delegation (the PAC transfer
            // and the contribution the filing lists stay in the answer and its sources).
            entities: ['s5025', 'moran', uaDayId(MEMBER_DATE), 'trip-munich-2025'],
            edges: [`s5025-${FOCUS_MEMBER}`, `moran-${FOCUS_MEMBER}`, `${uaDayId(MEMBER_DATE)}-${FOCUS_MEMBER}`, `${FOCUS_MEMBER}-trip-munich-2025`],
          },
        },
      },
      { label: 'Establish connections', delta: { add: empty } },
      { label: 'Render', delta: { add: empty, focus: FOCUS_MEMBER } },
    ],
    answer: [
      `${label(FOCUS_MEMBER)} (${entityById.get(FOCUS_MEMBER)?.sublabel}) shares four kinds of public record with Wicker here: a FARA registrant, a delegation list, a PAC, and a bill.`,
      `- FARA: Moran Global Strategies lists a contact with him on ${longDate(MEMBER_DATE)}, ${MEMBER_ROW.method}.`,
      `- With Wicker: the Munich 2025 delegation list, RTX PAC transfers (${MEMBER_RTX}), and S. 5025, as an original cosponsor dated ${s5025Date}.`,
      `Also listed in this filing: a contribution by James P. Moran, $${MEMBER_GIFT[3].toLocaleString('en-US')}, ${longDate(MEMBER_GIFT[2])}, recipient as written “${MEMBER_GIFT[4]}”.`,
    ].join('\n'),
    citations: [uaContactSource(FOCUS_MEMBER, MEMBER_DATE), 'travel-munich-2025', `fec-${FOCUS_MEMBER}-2024`, 'bill-s5025', MEMBER_GIFT[5]],
    suggestions: ['Which defense PACs gave to Wicker?', 'Who cosponsored S. 5025?'],
  },
];

/** The story turns after the firm's network, and the records and people they center (the presenter tour and the checks read these). */
export const PEOPLE_STORY = {
  /** Wicker's shared contact date (June 9, 2024) and the other people on it. */
  wickerDay: WICKER_DAY,
  wickerDate: WICKER_DATE[0],
  wickerDayOthers: WICKER_DAY_OTHERS,
  /** Records in common: the firm's contacts who are S. 5025 original cosponsors, and how its members voted on H.R. 5334. */
  recordsInCommon: {
    contacts: FIRM_CONTACTS.length,
    cosponsors: RIC_COSPONSORS,
    yes: RIC_YES,
    no: RIC_NO,
    staffAndPress: RIC_STAFF_PRESS,
    notOnRoll: RIC_NOT_ON_ROLL,
  },
  /** The member centered last (the public statements show for them). */
  member: FOCUS_MEMBER,
  turns: ['records-in-common', 'same-date-wicker', 'member-shared-records'] as const,
};
