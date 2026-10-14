/**
 * Parser for the FARA supplemental statement of Moran Global Strategies, Inc.
 * (registration No. 7255, received 11/26/2024):
 * https://efile.fara.gov/docs/7255-Supplemental-Statement-20241126-3.pdf
 *
 * Input: the text of the PDF pages from `pdftotext -layout` (one page at a
 * time), kept in src/data/records/fara-7255-pages.txt with "=== Page N ===" markers.
 * Output: every contact row for The Ministry for Strategic Industries of Ukraine
 * (Item 12 appendix, pages 20 to 22) and every political contribution row
 * (Item 15(c) appendix, pages 51 to 53).
 *
 * The parser reads the table columns from each row's first line (the date, the
 * contact, the method, and the subject start at fixed columns) and joins the
 * wrapped lines of each cell. Used by scripts/extract-fara-7255.ts (to write the
 * fact base) and scripts/check-real-records.ts (to check it against the text).
 */

export const FILING_URL = 'https://efile.fara.gov/docs/7255-Supplemental-Statement-20241126-3.pdf';
export const UA_PRINCIPAL = 'The Ministry for Strategic Industries of Ukraine';
/** The pages the demo uses: the Ukraine contact rows, then the political contributions. */
export const CONTACT_PAGES = [20, 21, 22];
export const CONTRIBUTION_PAGES = [51, 52, 53];

export interface PdfPage {
  page: number;
  lines: string[];
}

/** "=== Page 20 ===" blocks -> pages. */
export function splitPages(text: string): PdfPage[] {
  const out: PdfPage[] = [];
  let cur: PdfPage | null = null;
  for (const line of text.split('\n')) {
    const m = /^=== Page (\d+) ===$/.exec(line);
    if (m) {
      cur = { page: Number(m[1]), lines: [] };
      out.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  return out;
}

const FOOTER = /Received by NSD\/FARA Registration Unit/;
/**
 * The text layer splits one word with a space where the PDF shows it whole
 * ("Representat ive"; the page image reads "Representative"). Only this known
 * split is joined; every other character stays as written.
 */
export const fixSplitWords = (s: string) => s.replace(/\bRepresentat ive\b/g, 'Representative');
const clean = (parts: string[]) => fixSplitWords(parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim());

/* ------------------------------------------------------------------ */
/* Contact rows (Item 12)                                              */
/* ------------------------------------------------------------------ */

export interface ContactRow {
  principal: string;
  /** mm/dd/yyyy, as written. */
  date: string;
  contactAsWritten: string;
  method: string;
  subject: string;
  /** The PDF page with the row's first line. */
  page: number;
}

const ROW_START = /^(\S.*?)\s{2,}(\d{2}\/\d{2}\/\d{4})\s{2,}(\S)/;
const METHOD = /\s(In-person|In person|Phone|Telephone|Email)(?=\s|$)/;

/** Every contact row on the pages, in order (all principals). */
export function parseContactRows(pages: PdfPage[]): ContactRow[] {
  const rows: (ContactRow & { principalParts: string[]; contactParts: string[]; subjectParts: string[] })[] = [];
  let cols: { date: number; contact: number; method: number; subject: number } | null = null;
  for (const { page, lines } of pages) {
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim() || FOOTER.test(line)) continue;
      const m = ROW_START.exec(line);
      if (m) {
        const date = line.indexOf(m[2]);
        const contact = line.indexOf(m[3], date + 10);
        const mm = METHOD.exec(line.slice(contact));
        if (!mm) throw new Error(`page ${page}: no method in row "${line}"`);
        const method = contact + mm.index + 1;
        const after = method + mm[1].length;
        const rest = line.slice(after);
        const subject = rest.trim() ? after + rest.search(/\S/) : line.length + 1;
        cols = { date, contact, method, subject };
        rows.push({
          principal: '',
          principalParts: [m[1].trim()],
          date: m[2],
          contactAsWritten: '',
          contactParts: [line.slice(contact, method).trim()],
          method: mm[1],
          subject: '',
          subjectParts: [line.slice(subject).trim()],
          page,
        });
        continue;
      }
      const row = rows.at(-1);
      if (!row || !cols) continue;
      // A wrapped line: each cell continues in its own column.
      row.principalParts.push(line.slice(0, cols.date).trim());
      row.contactParts.push(line.slice(cols.contact, cols.method).trim());
      row.subjectParts.push(line.slice(Math.min(cols.subject, cols.method + 6)).trim());
    }
  }
  return rows.map(({ principalParts, contactParts, subjectParts, ...r }) => ({
    ...r,
    principal: clean(principalParts),
    contactAsWritten: clean(contactParts),
    subject: clean(subjectParts),
  }));
}

/** The Ukraine-principal contact rows (pages 20 to 22). */
export function parseUkraineContacts(pages: PdfPage[]): ContactRow[] {
  return parseContactRows(pages.filter(p => CONTACT_PAGES.includes(p.page))).filter(r => r.principal === UA_PRINCIPAL);
}

/* ------------------------------------------------------------------ */
/* Political contributions (Item 15(c))                                */
/* ------------------------------------------------------------------ */

export interface ContributionRow {
  date: string;
  donor: string;
  /** "Political Organization/Candidate", as written. */
  recipientAsWritten: string;
  method: string;
  /** "1,000.00", as written after the "$". */
  amountAsWritten: string;
  amount: number;
  page: number;
}

const CONTRIB_START = /^(\d{2}\/\d{2}\/\d{4})\s+(\S.*?)\s+(check|Check|online|Online|in-kind)\s+\$\s+([\d, ]+\.\d{2})\s*$/;

export function parseContributions(pages: PdfPage[]): ContributionRow[] {
  const rows: (ContributionRow & { donorParts: string[]; recipientParts: string[] })[] = [];
  for (const { page, lines } of pages.filter(p => CONTRIBUTION_PAGES.includes(p.page))) {
    // Columns from the first row on the page (the table is set again on each page).
    let cols: { donor: number; recipient: number; method: number } | null = null;
    const body = lines.map(l => l.replace(/\s+$/, '')).filter(l => l.trim() && !FOOTER.test(l));
    const firstRow = body.find(l => CONTRIB_START.test(l));
    const colsOf = (line: string) => {
      const m = CONTRIB_START.exec(line)!;
      const donor = line.indexOf(m[2], m[1].length);
      const middle = m[2];
      const split = /\s{2,}/.exec(middle);
      const recipient = split ? donor + split.index + split[0].length : donor;
      const method = line.lastIndexOf(m[3], line.indexOf('$'));
      return { donor, recipient, method };
    };
    if (firstRow) cols = colsOf(firstRow);
    let inTable = false;
    for (const line of body) {
      const m = CONTRIB_START.exec(line);
      if (m) {
        inTable = true;
        cols = colsOf(line);
        rows.push({
          date: m[1],
          donor: '',
          donorParts: [line.slice(cols.donor, cols.recipient).trim()],
          recipientAsWritten: '',
          recipientParts: [line.slice(cols.recipient, cols.method).trim()],
          method: m[3],
          amountAsWritten: m[4].replace(/\s+/g, ''),
          amount: Number(m[4].replace(/[\s,]/g, '')),
          page,
        });
        continue;
      }
      if (!cols || /^\S/.test(line) || /Appendix|Item 15|Date\s+Donor|Organization\/Candidate/.test(line)) {
        if (inTable && /^\S/.test(line)) inTable = false;
        continue;
      }
      const row = rows.at(-1);
      if (!row) continue;
      row.donorParts.push(line.slice(cols.donor, cols.recipient).trim());
      row.recipientParts.push(line.slice(cols.recipient, cols.method).trim());
    }
  }
  return rows.map(({ donorParts, recipientParts, ...r }) => ({ ...r, donor: clean(donorParts), recipientAsWritten: clean(recipientParts) }));
}

/* ------------------------------------------------------------------ */
/* Who each row names                                                  */
/* ------------------------------------------------------------------ */

export type ContactGroup = 'senate' | 'house' | 'staff' | 'press';

export interface ContactPerson {
  /** The last name used as `castMember` (its slug is the entity id). */
  castMember: string;
  group: ContactGroup;
  /** How the filing writes the person (a contact row matches when it starts with one of these). */
  written: RegExp;
  /** Staff: the member the filing names as employer (castMember of that member). */
  staffOf?: string;
  /** Staff: the role and employer, as written. */
  role?: string;
  /** Press: the employer, as written. */
  employer?: string;
}

/**
 * The people in the Ukraine-principal rows. `written` matches the start of the
 * contact cell; every row must match exactly one entry (the extract script and
 * the checker both fail otherwise).
 */
export const UA_CONTACT_PEOPLE: ContactPerson[] = [
  { castMember: 'Durbin', group: 'senate', written: /^Senator Dick Durbin$/ },
  { castMember: 'Blumenthal', group: 'senate', written: /^Senator Richard Blumenthal$/ },
  { castMember: 'Markey', group: 'senate', written: /^Senator Ed Markey$/ },
  { castMember: 'Warner', group: 'senate', written: /^Senator Mark [Ww]arner$/ },
  { castMember: 'Wicker', group: 'senate', written: /^Senator Roger Wicker$/ },
  { castMember: 'Casey', group: 'senate', written: /^Senator Bob Casey$/ },
  { castMember: 'Kaine', group: 'senate', written: /^Senator Tim Kaine$/ },
  { castMember: 'Van Hollen', group: 'senate', written: /^Senator Chris Van Hollen$/ },
  { castMember: 'McCollum', group: 'house', written: /^Representative Betty McCollum$/ },
  { castMember: 'Scott', group: 'house', written: /^Representative Bobby [Ss]cott$/ },
  { castMember: 'Turner', group: 'house', written: /^Representative Mike Turner$/ },
  { castMember: 'Case', group: 'house', written: /^Representative Ed Case$/ },
  { castMember: 'Kaptur', group: 'house', written: /^Representative Marcy Kaptur$/ },
  { castMember: 'Beyer', group: 'house', written: /^Representative Don Beyer$/ },
  { castMember: 'McGovern', group: 'house', written: /^Representative Jim McGovern$/ },
  { castMember: 'Keating', group: 'house', written: /^Representative Bill Keating$/ },
  { castMember: 'Cole', group: 'house', written: /^Representative Tom Cole$/ },
  { castMember: 'Amo', group: 'house', written: /^Representative Gabe Amo$/ },
  { castMember: 'Hoyer', group: 'house', written: /^Representative Steny Hoyer$/ },
  // The filing spells the name "Obernotle"; the House member record spells it "Obernolte".
  { castMember: 'Obernolte', group: 'house', written: /^Representative Jay Obernotle$/ },
  { castMember: 'Peterson', group: 'staff', written: /^Ben Peterson \(/, staffOf: 'McCollum', role: 'Defense Appropriations & Foreign Policy Director, Rep. Betty McCollum' },
  { castMember: 'Keightley', group: 'staff', written: /^Rebecca Keightley \(/, staffOf: 'Calvert', role: 'Chief of Staff, Rep. Ken Calvert' },
  { castMember: 'Dreiling', group: 'staff', written: /^Mark Dreiling \(/, staffOf: 'Bacon', role: 'Chief of Staff, Rep. Don Bacon' },
  { castMember: 'Donovan', group: 'staff', written: /^Garrett Donovan \(/, staffOf: 'Keating', role: 'Chief of Staff, Rep. Bill Keating' },
  { castMember: 'Bravender', group: 'press', written: /^Robin Bravender, Business Insider$/, employer: 'Business Insider' },
];

/** The House members named only as a staffer's employer. */
export const EMPLOYERS_ONLY = ['Calvert', 'Bacon'];

export function personOfRow(contactAsWritten: string): ContactPerson {
  const hits = UA_CONTACT_PEOPLE.filter(p => p.written.test(contactAsWritten));
  if (hits.length !== 1) throw new Error(`contact "${contactAsWritten}" matches ${hits.length} people`);
  const p = hits[0];
  if (p.role && !contactAsWritten.endsWith(`(${p.role})`)) throw new Error(`contact "${contactAsWritten}": role differs from "${p.role}"`);
  return p;
}

/** A contribution's recipient names a person in the contact list (a surname as a whole word). */
export function contactOfRecipient(recipientAsWritten: string): string | undefined {
  const members = UA_CONTACT_PEOPLE.filter(p => p.group === 'senate' || p.group === 'house');
  const hits = members.filter(p => new RegExp(`\\b${p.castMember}\\b`).test(recipientAsWritten));
  return hits.length === 1 ? hits[0].castMember : undefined;
}

export const slug = (castMember: string) => castMember.toLowerCase().replace(/\s+/g, '-');
