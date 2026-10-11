/**
 * The Explore part of the presenter story (steps 8 to 19): the question, typed
 * into the Home ask bar, and the clicks and questions that play it, in order,
 * on one continuous graph. The main story is a four-link chain: a member acts
 * (S. 5025), who contacted him (the firm's June 9 entry), who else the firm
 * contacted, and which of them share records on the same bills. The deeper
 * layers follow: a shared date, money, and public statements. The tour plays
 * them forward; ← puts the state after any prefix in place at once
 * (`replayStory`), with the same positions. The save step saves the full story.
 */
import { PEOPLE_STORY, RECORDS_IN_COMMON_QUESTION, script } from './script';

export const FIRST_QUESTION = "What is the United States' stance on Ukraine?";
export const FOLLOW_UP = 'Which defense PACs gave to Wicker?';
export const RECORDS_QUESTION = RECORDS_IN_COMMON_QUESTION;

/** The lobbying-firm network turn: the script's own wording for its question. */
export const ATTENDEE_TURN = 'moran-network';
export const ATTENDEE_QUESTION = script.find((t) => t.id === ATTENDEE_TURN)?.trigger.question ?? 'Who else did Moran Global Strategies contact for Ukraine?';

export interface TourStoryEntry {
  turnId: string;
  /** A typed question. */
  question?: string;
  /** A click on this node. */
  click?: string;
}

export const TOUR_STORY: TourStoryEntry[] = [
  // Link 1: a member acts. Link 2: who contacted him.
  { turnId: 'ukraine-stance', question: FIRST_QUESTION },
  { turnId: 's5025-cosponsors', click: 's5025' },
  { turnId: 'wicker-profile', click: 'wicker' },
  { turnId: 'wicker-contacts', click: 'cat-contacts' },
  { turnId: 'moran-contact', click: 'contact-ua-0609' },
  // Link 3: who else the firm contacted. Link 4: their records in common on the same bills.
  { turnId: ATTENDEE_TURN, question: ATTENDEE_QUESTION },
  { turnId: 'records-in-common', question: RECORDS_QUESTION },
  // Deeper: the shared date (after the time window), money, and one member's public statements.
  { turnId: 'same-date-wicker', click: PEOPLE_STORY.wickerDay },
  { turnId: 'defense-pac-contributions', question: FOLLOW_UP },
  { turnId: 'member-shared-records', click: PEOPLE_STORY.member },
];
