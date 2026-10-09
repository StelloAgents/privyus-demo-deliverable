/**
 * The Explore part of the presenter story (steps 8 to 14): the question and the
 * clicks that play it, in order. The tour plays them forward; ← puts the state
 * after any prefix in place at once (`replayStory`), with the same positions.
 */
export const FIRST_QUESTION = "What is the United States' stance on Ukraine?";
export const FOLLOW_UP = 'Which defense contractors gave to Hartley?';

export interface TourStoryEntry {
  turnId: string;
  /** A typed question. */
  question?: string;
  /** A click on this node. */
  click?: string;
}

export const TOUR_STORY: TourStoryEntry[] = [
  { turnId: 'ukraine-stance', question: FIRST_QUESTION },
  { turnId: 'defense-support-members', click: 's456' },
  { turnId: 'hartley-profile', click: 'hartley' },
  { turnId: 'hartley-meetings', click: 'cat-meetings' },
  { turnId: 'private-meeting-attendees', click: 'meeting-private' },
  { turnId: 'defense-contractor-contributions', question: FOLLOW_UP },
];
