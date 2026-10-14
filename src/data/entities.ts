import type { Entity, Edge } from './types';

/*
 * The cast: real US senators, real bills, and real organizations from public
 * records (src/data/records/real-records.json, retrieved Oct 10, 2026). Every
 * label, date, and amount here comes from a record in sources.ts;
 * scripts/check-real-records.ts checks the people and organizations against
 * the fact base. Links show records in common, not wrongdoing.
 */

/**
 * Every person Moran Global Strategies lists as a contact for The Ministry for
 * Strategic Industries of Ukraine (FARA supplemental statement, pages 20 to 22),
 * in the filing's order, with each date the filing lists them. Generated from
 * src/data/records/real-records.json (scripts/extract-fara-7255.ts); checked by
 * scripts/check-real-records.ts.
 */
export const MORAN_UA_NETWORK: [person: string, dates: string[]][] = [
  ['durbin', ['2024-05-20']],
  ['mccollum', ['2024-05-21', '2024-06-11', '2024-06-26']],
  ['peterson', ['2024-05-21']],
  ['blumenthal', ['2024-05-22']],
  ['markey', ['2024-05-22']],
  ['scott', ['2024-05-22', '2024-06-03']],
  ['warner', ['2024-06-03', '2024-06-20']],
  ['keightley', ['2024-06-03']],
  ['turner', ['2024-06-09']],
  ['wicker', ['2024-06-09']],
  ['case', ['2024-06-12']],
  ['dreiling', ['2024-06-18']],
  ['kaptur', ['2024-06-19', '2024-10-08']],
  ['beyer', ['2024-06-21']],
  ['mcgovern', ['2024-06-25']],
  ['keating', ['2024-07-10', '2024-08-02', '2024-08-05', '2024-08-06', '2024-08-07', '2024-08-08']],
  ['bravender', ['2024-07-15']],
  ['casey', ['2024-07-25']],
  ['cole', ['2024-07-31']],
  ['amo', ['2024-08-02', '2024-08-05', '2024-08-06']],
  ['donovan', ['2024-08-02', '2024-08-06', '2024-08-08']],
  ['hoyer', ['2024-08-05', '2024-08-06', '2024-08-07', '2024-08-08']],
  ['kaine', ['2024-08-07']],
  ['obernolte', ['2024-08-13']],
  ['van-hollen', ['2024-10-16']],
];
/** Staff the filing names, and the member each one works for (as written in the contact row). */
export const MORAN_UA_STAFF: Record<string, string> = { peterson: 'mccollum', keightley: 'calvert', dreiling: 'bacon', donovan: 'keating' };
/** The source id of one contact row (one person on one date): "fara-vanhollen-ua-1016". */
export const uaContactSource = (person: string, date: string) => `fara-${person.replace(/-/g, '')}-ua-${date.slice(5, 7)}${date.slice(8, 10)}`;
/**
 * The dates on which the filing lists Ukraine-principal contacts with two or more
 * of these people (a staffer and the member the row names as employer do not
 * count as two): [date, people in the filing's order]. Each date is one record
 * node on the graph (`ua-day-MMDD`), the shared record between the people on it.
 * A shared date means only that the firm reported a contact with each person on
 * that date.
 */
export const MORAN_UA_SHARED_DATES: [date: string, people: string[]][] = [...new Set(MORAN_UA_NETWORK.flatMap(([, ds]) => ds))]
  .sort()
  .map((date): [string, string[]] => [date, MORAN_UA_NETWORK.filter(([, ds]) => ds.includes(date)).map(([p]) => p)])
  .filter(([, people]) => people.some((p, i) => people.slice(i + 1).some(q => MORAN_UA_STAFF[p] !== q && MORAN_UA_STAFF[q] !== p)));
/** The record node of one shared date: "ua-day-0609". */
export const uaDayId = (date: string) => `ua-day-${date.slice(5, 7)}${date.slice(8, 10)}`;
/**
 * Political contributions by James P. Moran listed in the same filing (Item 15(c)),
 * to people in that contact list: [detail, member, date, amount, recipient as written, source].
 */
export const MORAN_CONTRIBUTIONS: [detail: string, member: string, date: string, amount: number, recipient: string, source: string][] = [
  ['contrib-moran-blumenthal', 'blumenthal', '2024-05-25', 500, 'Blumenthal for Connecticut', 'fara-contrib-blumenthal-0525'],
  ['contrib-moran-mccollum', 'mccollum', '2024-06-26', 1000, 'Rep. Betty McCollum (McCollum For Congress)', 'fara-contrib-mccollum-0626'],
  ['contrib-moran-casey', 'casey', '2024-07-25', 1000, 'Rep. Bob Casey (Bob Casey for Senate)', 'fara-contrib-casey-0725'],
  ['contrib-moran-cole', 'cole', '2024-08-01', 1000, 'Cole for Congress', 'fara-contrib-cole-0801'],
  ['contrib-moran-kaine-vf', 'kaine', '2024-08-27', 1000, 'Kaine Victory Fund', 'fara-contrib-kaine-0827'],
  ['contrib-moran-kaine-va', 'kaine', '2024-08-27', 1000, 'Kaine for Virginia', 'fara-contrib-kaine-0827'],
  ['contrib-moran-case', 'case', '2024-09-18', 1000, 'Case for Congress', 'fara-contrib-case-0918'],
];
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const senator = (id: string, name: string, partyState: string, initials: string): Entity => ({
  id,
  type: 'person',
  label: `Sen. ${name}`,
  sublabel: partyState,
  initials,
});

const rep = (id: string, name: string, partyState: string, initials: string): Entity => ({
  id,
  type: 'person',
  label: `Rep. ${name}`,
  sublabel: partyState,
  initials,
  group: 'house',
});

/** Congressional staff and press, as the FARA filing names them (role and employer as written). */
const named = (id: string, name: string, sublabel: string, initials: string, group: 'staff' | 'press'): Entity => ({
  id,
  type: 'person',
  label: name,
  sublabel,
  initials,
  group,
});

export const entities: Entity[] = [
  { id: 'ukraine', type: 'topic', label: 'US Stance on Ukraine', sublabel: 'Foreign policy', icon: 'flag-ua' },
  { id: 'hr815', type: 'bill', label: 'H.R. 815 · FY2024 emergency supplemental', sublabel: 'P.L. 118-50 · Apr 24, 2024', icon: 'ScrollText' },
  { id: 's5025', type: 'bill', label: 'S. 5025 · Russia sanctions bill, 2026', sublabel: 'Senate · introduced Jul 16, 2026', icon: 'ScrollText' },
  { id: 'hr5334', type: 'bill', label: 'H.R. 5334 · Russia and Iran sanctions act, 2026', sublabel: 'P.L. 119-111 · Sep 18, 2026', icon: 'ScrollText' },

  senator('wicker', 'Roger Wicker', 'R-MS', 'RW'),
  senator('kaine', 'Tim Kaine', 'D-VA', 'TK'),
  senator('warner', 'Mark Warner', 'D-VA', 'MW'),
  senator('heinrich', 'Martin Heinrich', 'D-NM', 'MH'),
  senator('blumenthal', 'Richard Blumenthal', 'D-CT', 'RB'),
  senator('van-hollen', 'Chris Van Hollen', 'D-MD', 'CV'),
  senator('coons', 'Chris Coons', 'D-DE', 'CC'),
  senator('king', 'Angus King', 'I-ME', 'AK'),
  senator('durbin', 'Dick Durbin', 'D-IL', 'DD'),
  senator('markey', 'Ed Markey', 'D-MA', 'EM'),
  senator('barrasso', 'John Barrasso', 'R-WY', 'JB'),
  senator('fischer', 'Deb Fischer', 'R-NE', 'DF'),
  senator('cramer', 'Kevin Cramer', 'R-ND', 'KC'),
  senator('sullivan', 'Dan Sullivan', 'R-AK', 'DS'),
  senator('shaheen', 'Jeanne Shaheen', 'D-NH', 'JS'),
  senator('tillis', 'Thom Tillis', 'R-NC', 'TT'),
  senator('ernst', 'Joni Ernst', 'R-IA', 'JE'),
  senator('daines', 'Steve Daines', 'R-MT', 'SD'),
  senator('murkowski', 'Lisa Murkowski', 'R-AK', 'LM'),

  // Organizations: the FARA registrant, its foreign principal, and five corporate PACs.
  { id: 'moran', type: 'org', label: 'Moran Global Strategies, Inc.', sublabel: 'FARA registrant No. 7255', icon: 'Building2', hqState: 'VA' },
  { id: 'ua-ministry', type: 'org', label: 'The Ministry for Strategic Industries of Ukraine', sublabel: 'FARA foreign principal · Ukraine', icon: 'Landmark' },
  { id: 'pac-boeing', type: 'org', label: 'Boeing PAC', sublabel: 'Corporate PAC · FEC C00142711', icon: 'Factory', hqState: 'VA' },
  { id: 'pac-gd', type: 'org', label: 'General Dynamics PAC', sublabel: 'Corporate PAC · FEC C00078451', icon: 'Factory', hqState: 'VA' },
  { id: 'pac-lockheed', type: 'org', label: 'Lockheed Martin PAC', sublabel: 'Corporate PAC · FEC C00303024', icon: 'Factory', hqState: 'VA' },
  { id: 'pac-northrop', type: 'org', label: 'Northrop Grumman PAC', sublabel: 'Corporate PAC · FEC C00088591', icon: 'Factory', hqState: 'VA' },
  { id: 'pac-rtx', type: 'org', label: 'RTX PAC', sublabel: 'Corporate PAC · FEC C00097568', icon: 'Factory', hqState: 'VA' },

  // Wicker's record, by category.
  { id: 'cat-votes', type: 'category', label: 'Votes', icon: 'Vote', categoryOf: 'wicker' },
  { id: 'cat-trips', type: 'category', label: 'Trips', icon: 'Plane', categoryOf: 'wicker' },
  { id: 'cat-contacts', type: 'category', label: 'Contacts', icon: 'UsersRound', categoryOf: 'wicker' },
  { id: 'cat-contributions', type: 'category', label: 'Contributions', icon: 'BadgeDollarSign', categoryOf: 'wicker' },
  { id: 'cat-statements', type: 'category', label: 'Statements', icon: 'MessageSquareQuote', categoryOf: 'wicker' },
  { id: 'cat-others', type: 'category', label: 'Others', icon: 'MoreHorizontal', categoryOf: 'wicker' },

  { id: 'vote-224', type: 'detail', label: 'Yea · H.R. 5334 passage', sublabel: 'Aug 7, 2026 · roll call 224', icon: 'Vote' },
  { id: 'vote-212', type: 'detail', label: 'Yea · H.R. 5334 cloture', sublabel: 'Jul 28, 2026 · roll call 212', icon: 'Vote' },
  { id: 'vote-178', type: 'detail', label: 'Nay · Amdt. 1646, Ukraine security assistance', sublabel: 'Apr 4, 2025 · roll call 178', icon: 'Vote' },
  { id: 'vote-76', type: 'detail', label: 'Nay · Amdt. 299, support for Ukraine', sublabel: 'Feb 21, 2025 · roll call 76', icon: 'Vote' },
  { id: 'vote-154', type: 'detail', label: 'Yea · H.R. 815 motion to concur', sublabel: 'Apr 23, 2024 · roll call 154', icon: 'Vote' },
  { id: 'vote-48', type: 'detail', label: 'Yea · H.R. 815 Senate passage', sublabel: 'Feb 13, 2024 · roll call 48', icon: 'Vote' },
  { id: 'vote-200', type: 'detail', label: 'Yea · Amdt. 1055, Ukraine inspector general', sublabel: 'Jul 26, 2023 · roll call 200', icon: 'Vote' },
  { id: 'vote-195', type: 'detail', label: 'Nay · Amdt. 376, limit on Ukraine funds', sublabel: 'Jul 20, 2023 · roll call 195', icon: 'Vote' },
  { id: 'trip-munich-2025', type: 'detail', label: 'Munich Security Conference 2025', sublabel: 'February 2025', icon: 'Plane' },
  { id: 'contact-ua-0609', type: 'detail', label: 'Ukraine · NDAA discussion', sublabel: 'Jun 9, 2024 · in person', icon: 'Handshake' },
  { id: 'stmt-w-0806', type: 'detail', label: 'Statement on escalation against NATO allies', sublabel: 'Aug 6, 2026', icon: 'Newspaper' },
  { id: 'stmt-w-0807', type: 'detail', label: 'Statement on sanctions bill passage', sublabel: 'Aug 7, 2026', icon: 'Newspaper' },
  { id: 'stmt-w-0928', type: 'detail', label: 'Weekly report on the sanctions law', sublabel: 'Sep 28, 2026', icon: 'MessageSquareQuote' },
  { id: 'other-s1241', type: 'detail', label: 'Cosponsor · S. 1241, 2025', sublabel: 'Apr 1, 2025', icon: 'FileText' },

  // H.R. 5334, step by step (bill status record and roll calls).
  { id: 'step-s212', type: 'detail', label: 'Senate cloture 86-12', sublabel: 'Jul 28, 2026 · roll call 212', icon: 'Vote' },
  { id: 'step-s224', type: 'detail', label: 'Senate passed 86-11', sublabel: 'Aug 7, 2026 · roll call 224', icon: 'Vote' },
  { id: 'step-h308', type: 'detail', label: 'House agreed 262-159', sublabel: 'Sep 16, 2026 · roll call 308', icon: 'Vote' },
  { id: 'step-law', type: 'detail', label: 'Signed · P.L. 119-111', sublabel: 'Sep 18, 2026', icon: 'ScrollText' },

  // Moran Global Strategies' other Ukraine-principal contacts (FARA supplemental statement, pages 20 to 22):
  // House members (party and state from the House Clerk's member data), a former senator, staff, and press.
  rep('mccollum', 'Betty McCollum', 'D-MN', 'BM'),
  rep('scott', 'Bobby Scott', 'D-VA', 'BS'),
  rep('turner', 'Mike Turner', 'R-OH', 'MT'),
  rep('case', 'Ed Case', 'D-HI', 'EC'),
  rep('kaptur', 'Marcy Kaptur', 'D-OH', 'MK'),
  rep('beyer', 'Don Beyer', 'D-VA', 'DB'),
  rep('mcgovern', 'Jim McGovern', 'D-MA', 'JM'),
  rep('keating', 'Bill Keating', 'D-MA', 'BK'),
  rep('cole', 'Tom Cole', 'R-OK', 'TC'),
  rep('amo', 'Gabe Amo', 'D-RI', 'GA'),
  rep('hoyer', 'Steny Hoyer', 'D-MD', 'SH'),
  rep('obernolte', 'Jay Obernolte', 'R-CA', 'JO'),
  rep('calvert', 'Ken Calvert', 'R-CA', 'KC'),
  rep('bacon', 'Don Bacon', 'R-NE', 'DB'),
  { id: 'casey', type: 'person', label: 'Bob Casey', sublabel: 'D-PA · Senator, 2024', initials: 'BC', group: 'senate' },
  named('peterson', 'Ben Peterson', 'Defense Appropriations & Foreign Policy Director · Rep. Betty McCollum', 'BP', 'staff'),
  named('keightley', 'Rebecca Keightley', 'Chief of Staff · Rep. Ken Calvert', 'RK', 'staff'),
  named('dreiling', 'Mark Dreiling', 'Chief of Staff · Rep. Don Bacon', 'MD', 'staff'),
  named('donovan', 'Garrett Donovan', 'Chief of Staff · Rep. Bill Keating', 'GD', 'staff'),
  named('bravender', 'Robin Bravender', 'Business Insider', 'RB', 'press'),

  // Political contributions by James P. Moran that the same filing lists (Item 15(c)), to people in that contact list.
  ...MORAN_CONTRIBUTIONS.map(([id, , date, amount, recipient]): Entity => ({
    id,
    type: 'detail',
    label: `Contribution listed · ${money(amount)}`,
    sublabel: `${shortDate(date)} · ${recipient}`,
    icon: 'BadgeDollarSign',
  })),

  // The firm's shared contact dates: one record per date, joined to each person the filing lists on it.
  ...MORAN_UA_SHARED_DATES.map(([date, people]): Entity => ({
    id: uaDayId(date),
    type: 'detail',
    label: `FARA contacts · ${shortDate(date)}`,
    sublabel: `Moran Global Strategies · ${people.length} people`,
    icon: 'CalendarDays',
  })),

  // Other delegations and RTX PAC transfers, for members who share them with Wicker.
  { id: 'trip-munich-2024', type: 'detail', label: 'Munich Security Conference 2024', sublabel: 'Feb 16 to 18, 2024', icon: 'Plane' },
  { id: 'trip-munich-2026', type: 'detail', label: 'Munich Security Conference 2026', sublabel: 'Feb 13 to 15, 2026', icon: 'Plane' },
  { id: 'trip-vilnius-2023', type: 'detail', label: '2023 NATO Summit, Vilnius', sublabel: 'July 2023', icon: 'Plane' },
  { id: 'contrib-rtx-blumenthal', type: 'detail', label: 'RTX PAC · $2,000, 2023-24', sublabel: 'Oct 25, 2024', icon: 'BadgeDollarSign' },
  { id: 'contrib-rtx-coons', type: 'detail', label: 'RTX PAC · $4,000, 2023-24', sublabel: 'Aug 14, 2024', icon: 'BadgeDollarSign' },
  { id: 'contrib-rtx-durbin', type: 'detail', label: 'RTX PAC · $5,000, 2023-24', sublabel: 'Oct 25, 2024', icon: 'BadgeDollarSign' },
  { id: 'contrib-rtx-ernst', type: 'detail', label: 'RTX PAC · $2,000, 2023-24', sublabel: 'Aug 3, 2023', icon: 'BadgeDollarSign' },
  { id: 'contrib-rtx-kaine', type: 'detail', label: 'RTX PAC · $6,000, 2023-24', sublabel: 'Oct 25, 2024', icon: 'BadgeDollarSign' },
  { id: 'contrib-rtx-sullivan', type: 'detail', label: 'RTX PAC · $3,000, 2023-24', sublabel: 'Sep 19, 2024', icon: 'BadgeDollarSign' },
  { id: 'contrib-rtx-tillis', type: 'detail', label: 'RTX PAC · $2,000, 2023-24', sublabel: 'Aug 14, 2024', icon: 'BadgeDollarSign' },
  { id: 'contrib-rtx-van-hollen', type: 'detail', label: 'RTX PAC · $2,000, 2023-24', sublabel: 'Oct 25, 2024', icon: 'BadgeDollarSign' },
  { id: 'contrib-rtx-warner', type: 'detail', label: 'RTX PAC · $3,000, 2023-24', sublabel: 'Jun 24, 2024', icon: 'BadgeDollarSign' },
];

/** S. 5025's original cosponsors in this cast (bill status XML; all dated 2026-07-16). */
export const S5025_COSPONSORS = ['blumenthal', 'wicker', 'shaheen', 'coons', 'durbin', 'king', 'ernst', 'kaine', 'sullivan', 'van-hollen', 'tillis', 'heinrich', 'barrasso', 'fischer', 'cramer', 'murkowski', 'daines'];
/**
 * How each member of Congress the firm lists for its Ukraine principal voted on H.R. 5334:
 * senators on Senate roll call 224 (Aug 7, 2026), House members on House roll call 308
 * (Sep 16, 2026). Staff and the reporter cast no votes. Sen. Casey left the Senate before
 * 2026 and is not on roll call 224. Checked against the roll call XML by scripts/check-real-records.ts.
 */
export const HR5334_VOTES: Record<string, 'yes' | 'no'> = {
  durbin: 'yes', blumenthal: 'yes', markey: 'no', warner: 'yes', wicker: 'yes', kaine: 'yes', 'van-hollen': 'yes',
  mccollum: 'no', scott: 'no', turner: 'yes', case: 'yes', kaptur: 'yes', beyer: 'no', mcgovern: 'no', keating: 'yes', cole: 'yes', amo: 'no', hoyer: 'yes', obernolte: 'yes',
};
/** The roll call date of each chamber's H.R. 5334 vote above. */
export const HR5334_VOTE_DATE = { senate: '2026-08-07', house: '2026-09-16' } as const;
/** The cast members on the Munich Security Conference 2025 delegation list, other than Wicker. */
export const MUNICH_2025_OTHERS = ['blumenthal', 'coons', 'ernst', 'sullivan', 'tillis', 'van-hollen', 'warner'];
/** Cast members on the other delegation lists, in the order each release names them (leaders first). */
const OTHER_TRIPS: [trip: string, source: string, date: string, members: string[]][] = [
  ['trip-munich-2024', 'travel-munich-2024', '2024-02-15', ['sullivan', 'warner', 'coons', 'blumenthal', 'van-hollen']],
  ['trip-munich-2026', 'travel-munich-2026', '2026-02-12', ['murkowski', 'warner', 'coons', 'blumenthal', 'daines']],
  ['trip-vilnius-2023', 'travel-vilnius-2023', '2023-07-12', ['tillis', 'shaheen', 'durbin', 'sullivan', 'king']],
];
/** RTX PAC transfers, 2023-24: [member, last transfer date]. */
const RTX_TRANSFERS: [string, string][] = [
  ['blumenthal', '2024-10-25'],
  ['coons', '2024-08-14'],
  ['durbin', '2024-10-25'],
  ['ernst', '2023-08-03'],
  ['kaine', '2024-10-25'],
  ['sullivan', '2024-09-19'],
  ['tillis', '2024-08-14'],
  ['van-hollen', '2024-10-25'],
  ['warner', '2024-06-24'],
];

export const edges: Edge[] = [
  { id: 'ukraine-hr815', source: 'ukraine', target: 'hr815', label: 'legislation on', date: '2024-04-24', sourceIds: ['bill-hr815'] },
  { id: 'ukraine-s5025', source: 'ukraine', target: 's5025', label: 'legislation on', date: '2026-07-16', sourceIds: ['bill-s5025'] },
  { id: 'ukraine-hr5334', source: 'ukraine', target: 'hr5334', label: 'legislation on', date: '2026-09-18', sourceIds: ['bill-hr5334'] },
  ...S5025_COSPONSORS.map((id): Edge => ({ id: `s5025-${id}`, source: 's5025', target: id, label: 'original cosponsor', date: '2026-07-16', sourceIds: ['bill-s5025'] })),

  { id: 'wicker-cat-votes', source: 'wicker', target: 'cat-votes', label: 'record', sourceIds: ['roll-s224'] },
  { id: 'wicker-cat-trips', source: 'wicker', target: 'cat-trips', label: 'travel', sourceIds: ['travel-munich-2025'] },
  { id: 'wicker-cat-contacts', source: 'wicker', target: 'cat-contacts', label: 'FARA contacts', sourceIds: ['fara-moran-supplemental'] },
  { id: 'wicker-cat-contributions', source: 'wicker', target: 'cat-contributions', label: 'receipts', sourceIds: ['fec-wicker-2024'] },
  { id: 'wicker-cat-statements', source: 'wicker', target: 'cat-statements', label: 'statements', sourceIds: ['stmt-wicker-0807'] },
  { id: 'wicker-cat-others', source: 'wicker', target: 'cat-others', label: 'other records', sourceIds: ['bill-s1241'] },

  { id: 'cat-votes-vote-224', source: 'cat-votes', target: 'vote-224', label: 'recorded vote', date: '2026-08-07', sourceIds: ['roll-s224'] },
  { id: 'cat-votes-vote-212', source: 'cat-votes', target: 'vote-212', label: 'recorded vote', date: '2026-07-28', sourceIds: ['roll-s212'] },
  { id: 'cat-votes-vote-178', source: 'cat-votes', target: 'vote-178', label: 'recorded vote', date: '2025-04-04', sourceIds: ['roll-s178'] },
  { id: 'cat-votes-vote-76', source: 'cat-votes', target: 'vote-76', label: 'recorded vote', date: '2025-02-21', sourceIds: ['roll-s76'] },
  { id: 'cat-votes-vote-154', source: 'cat-votes', target: 'vote-154', label: 'recorded vote', date: '2024-04-23', sourceIds: ['roll-s154'] },
  { id: 'cat-votes-vote-48', source: 'cat-votes', target: 'vote-48', label: 'recorded vote', date: '2024-02-13', sourceIds: ['roll-s48'] },
  { id: 'cat-votes-vote-200', source: 'cat-votes', target: 'vote-200', label: 'recorded vote', date: '2023-07-26', sourceIds: ['roll-s200'] },
  { id: 'cat-votes-vote-195', source: 'cat-votes', target: 'vote-195', label: 'recorded vote', date: '2023-07-20', sourceIds: ['roll-s195'] },
  { id: 'cat-trips-trip-munich-2025', source: 'cat-trips', target: 'trip-munich-2025', label: 'listed on delegation', date: '2025-02-13', sourceIds: ['travel-munich-2025'] },
  { id: 'cat-contacts-contact-ua-0609', source: 'cat-contacts', target: 'contact-ua-0609', label: 'FARA contact', date: '2024-06-09', sourceIds: ['fara-wicker-ua-0609'] },
  { id: 'pac-boeing-cat-contributions', source: 'pac-boeing', target: 'cat-contributions', label: 'contributed $10,000, 2023-24', date: '2023-01-31', sourceIds: ['fec-wicker-2024'] },
  { id: 'pac-gd-cat-contributions', source: 'pac-gd', target: 'cat-contributions', label: 'contributed $10,000, 2023-24', date: '2024-09-24', sourceIds: ['fec-wicker-2024'] },
  { id: 'pac-lockheed-cat-contributions', source: 'pac-lockheed', target: 'cat-contributions', label: 'contributed $8,000, 2023-24', date: '2024-03-27', sourceIds: ['fec-wicker-2024'] },
  { id: 'pac-northrop-cat-contributions', source: 'pac-northrop', target: 'cat-contributions', label: 'contributed $10,000, 2023-24', date: '2024-06-28', sourceIds: ['fec-wicker-2024'] },
  { id: 'pac-rtx-cat-contributions', source: 'pac-rtx', target: 'cat-contributions', label: 'contributed $5,500, 2023-24', date: '2024-04-29', sourceIds: ['fec-wicker-2024'] },
  { id: 'cat-statements-stmt-w-0806', source: 'cat-statements', target: 'stmt-w-0806', label: 'said', date: '2026-08-06', sourceIds: ['stmt-wicker-0806'] },
  { id: 'cat-statements-stmt-w-0807', source: 'cat-statements', target: 'stmt-w-0807', label: 'said', date: '2026-08-07', sourceIds: ['stmt-wicker-0807'] },
  { id: 'cat-statements-stmt-w-0928', source: 'cat-statements', target: 'stmt-w-0928', label: 'said', date: '2026-09-28', sourceIds: ['stmt-wicker-0928'] },
  { id: 'cat-others-other-s1241', source: 'cat-others', target: 'other-s1241', label: 'cosponsored', date: '2025-04-01', sourceIds: ['bill-s1241'] },

  // The FARA registrant and its principal.
  { id: 'contact-ua-0609-moran', source: 'contact-ua-0609', target: 'moran', label: 'reported by registrant', date: '2024-06-09', sourceIds: ['fara-wicker-ua-0609'] },
  { id: 'moran-ua-ministry', source: 'moran', target: 'ua-ministry', label: 'registered foreign principal', date: '2023-09-24', sourceIds: ['fara-principal-ukraine'] },
  // Every Ukraine-principal contact: the firm to the person, dated at the first contact, citing every row.
  ...MORAN_UA_NETWORK.map(([person, dates]): Edge => ({
    id: `moran-${person}`,
    source: 'moran',
    target: person,
    // One label for every contact (the edge cites each row): a ring of them reads as one relationship.
    label: 'listed contact',
    date: dates[0],
    sourceIds: dates.map(d => uaContactSource(person, d)),
    explicit: true,
  })),
  // Staff to the member the filing names as employer.
  ...Object.entries(MORAN_UA_STAFF).map(([staff, member]): Edge => {
    const dates = MORAN_UA_NETWORK.find(([p]) => p === staff)![1];
    return { id: `${staff}-staff-of-${member}`, source: staff, target: member, label: 'staff of', date: dates[0], sourceIds: dates.map(d => uaContactSource(staff, d)), explicit: true };
  }),
  // Contributions listed in the same filing: each record to its recipient member.
  ...MORAN_CONTRIBUTIONS.map(([detail, member, date, , , src]): Edge => ({ id: `${detail}-${member}`, source: detail, target: member, label: 'listed recipient', date, sourceIds: [src], explicit: true })),

  // Shared contact dates: each date record to every person the filing lists on that date, citing that row.
  // Not explicit: once a turn puts a date on the graph, it joins the people on it who are already there.
  ...MORAN_UA_SHARED_DATES.flatMap(([date, people]) =>
    people.map((person): Edge => ({ id: `${uaDayId(date)}-${person}`, source: uaDayId(date), target: person, label: 'listed on this date', date, sourceIds: [uaContactSource(person, date)] })),
  ),

  // H.R. 5334's path to law.
  { id: 'hr5334-step-s212', source: 'hr5334', target: 'step-s212', label: 'Senate vote', date: '2026-07-28', sourceIds: ['roll-s212'] },
  { id: 'hr5334-step-s224', source: 'hr5334', target: 'step-s224', label: 'Senate vote', date: '2026-08-07', sourceIds: ['roll-s224'] },
  { id: 'hr5334-step-h308', source: 'hr5334', target: 'step-h308', label: 'House vote', date: '2026-09-16', sourceIds: ['roll-h308'] },
  { id: 'hr5334-step-law', source: 'hr5334', target: 'step-law', label: 'became law', date: '2026-09-18', sourceIds: ['bill-hr5334'] },

  // Records in common: H.R. 5334 to each of the firm's listed contacts who voted yes on it (explicit:
  // only the records-in-common turn puts them on the graph).
  ...Object.entries(HR5334_VOTES)
    .filter(([, v]) => v === 'yes')
    .map(([person]): Edge => {
      const senate = entities.find(e => e.id === person)?.label.startsWith('Sen.') ?? false;
      return {
        id: `hr5334-yes-${person}`,
        source: 'hr5334',
        target: person,
        label: 'voted yes',
        date: senate ? HR5334_VOTE_DATE.senate : HR5334_VOTE_DATE.house,
        sourceIds: [senate ? 'roll-s224' : 'roll-h308'],
        explicit: true,
      };
    }),

  // Delegations: Munich 2025 (with Wicker), and the other trips among the cast.
  ...MUNICH_2025_OTHERS.map((id): Edge => ({ id: `${id}-trip-munich-2025`, source: id, target: 'trip-munich-2025', label: 'listed on delegation', date: '2025-02-13', sourceIds: ['travel-munich-2025'] })),
  ...OTHER_TRIPS.flatMap(([trip, src, date, members]) =>
    members.map((id): Edge => ({ id: `${id}-${trip}`, source: id, target: trip, label: 'listed on delegation', date, sourceIds: [src] })),
  ),

  // RTX PAC transfers to the members who share it with Wicker (people network).
  ...RTX_TRANSFERS.flatMap(([member, date]): Edge[] => [
    { id: `pac-rtx-contrib-rtx-${member}`, source: 'pac-rtx', target: `contrib-rtx-${member}`, label: 'contribution', date, sourceIds: [`fec-${member}-2024`] },
    { id: `${member}-contrib-rtx-${member}`, source: member, target: `contrib-rtx-${member}`, label: 'received', date, sourceIds: [`fec-${member}-2024`] },
  ]),
];

/** The other delegations, in the order the releases name the cast members. */
export const OTHER_TRIP_MEMBERS: Record<string, string[]> = Object.fromEntries(OTHER_TRIPS.map(([trip, , , members]) => [trip, members]));
