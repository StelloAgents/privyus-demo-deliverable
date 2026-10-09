/**
 * Presenter mode steps (PRESENTER-MODE.md section 3). Card text and notes are
 * copied from the spec. Each step declares its settled `end` state (what ← puts
 * in place before the next step plays) and `play`, its visible action.
 */
import { dismissToast } from '@/components/ui/Toast';
import * as home from '@/features/dashboard/home-controller';
import {
  closeSource,
  openSource,
  pressNode,
  pressSave,
  pressSend,
  resetExploration,
  typeDraft,
} from '@/features/explore/controller';
import { CLEAN, HOME_START, type StepState } from '@/features/presenter/state';
import { setSearchText } from '@/features/search/search-store';
import { clearSavedCheckpoints } from '@/lib/checkpoints';
import { nextEvent } from '@/lib/events';
import { whenGraphAtRest } from '@/lib/graph-motion';
import { MOTION, prefersReducedMotion } from '@/lib/motion';
import type { TurnHandle } from '@/lib/script-engine';
import { changePage, sleep, spotlight, typeInto, untilAbort, type TourStep } from '@/lib/tour';
import { FIRST_QUESTION, FOLLOW_UP } from './tour-story';

/** The cutout's glide to a new target (Spotlight). */
const SPOT_GLIDE_MS = 300;
/** A short beat on Save (already in the cutout) before it is pressed. */
const SAVE_BEAT_BEFORE_MS = 200;
const FOLLOW_UP_TYPE_MS = 250;
const FIRST_TYPE_MS = 450;
/** The curtain's fade-out (240ms, Spotlight), then a short beat on the spotlighted chat field. */
const TYPE_AFTER_CURTAIN_MS = 240 + 150;
const SEARCH_TYPE_MS = 280;

/* Home as each step leaves it. */
const STATE_CARD = { ...HOME_START, stateCard: 'OH' };
const LIVE = { ...HOME_START, liveRecord: true };
const MONEY = { ...LIVE, topic: 1 };

const onHome = (h: StepState['home']): StepState => ({ route: '/', home: h, search: '', checkpoint: false });
const onExplore = (turnId: string, sourceOpen?: string): StepState => ({
  route: '/explore',
  explore: { turnId, sourceOpen },
  checkpoint: false,
});
/** Explore, clean, with the first question typed into the chat field and not sent. */
const ASK_TYPED: StepState = { route: '/explore', explore: { turnId: null, draft: FIRST_QUESTION }, checkpoint: false };
/** After the save: Home with the one new checkpoint (of the whole story). */
const SAVED_HOME: StepState = {
  route: '/',
  home: LIVE,
  explore: { turnId: 'defense-contractor-contributions' },
  search: '',
  checkpoint: true,
};

/**
 * Plays an Explore turn: resolves when its answer has finished and the graph
 * has come to rest (with 'graph': as soon as its graph changes have applied, for
 * a click that leads to the next click). On abort the turn stops where it is.
 */
async function playTurn(h: TurnHandle | undefined, signal: AbortSignal, until: 'done' | 'graph' = 'done'): Promise<void> {
  if (!h || signal.aborted) return h?.cancel();
  const stop = () => h.cancel();
  signal.addEventListener('abort', stop, { once: true });
  await untilAbort(until === 'graph' ? h.graphBuilt : h.done, signal);
  signal.removeEventListener('abort', stop);
  if (until === 'done') await whenGraphAtRest(signal);
}

export const tourSteps: TourStep<StepState>[] = [
  // Part 1: Home
  {
    id: 'ask',
    targets: ['ask-bar'],
    end: CLEAN,
    play: async () => {},
    title: 'Ask Bar',
    body: 'Ask a question in plain English. Privyus searches every source and answers with the connections and the records behind them.',
    notes: 'Open: "Privyus is going to be that database for you." "What Bloomberg did to the financial data integrated with Palantir." The problem: "When you\'re looking through each of these silos and each of these databases, it\'s very difficult to connect all of them at once." "We spend hours, if not weeks and months sometimes, to analyze something and try to find connections." Then the ask bar: "Obviously, the NLP chat agent model is going to be very prominent because this is maybe where you would start on most days."',
  },
  {
    id: 'radar',
    targets: ['radar'],
    end: CLEAN,
    play: (signal) => home.setTopic(0, signal),
    title: 'Topic Radar',
    body: 'Radar counts the activity on each tracked topic. Switch tabs to see the Senate vote or the trend over the last 30 days.',
    notes: '"Maybe the top piece of legislation you\'re watching." "And all of this would be able to be customizable."',
  },
  {
    id: 'seat-chart',
    targets: ['seat-chart'],
    end: CLEAN,
    play: async (signal) => {
      await home.setRadarTab('vote', signal);
      await home.rollCall(signal);
    },
    title: 'Senate Roll Call',
    body: 'Each seat is one senator in the cloture vote on S. 456. Color shows the party. A solid seat voted yes and a ring voted no.',
    notes: "No transcript line: the vote is the factual record behind the topic (\"evidence that can tie to a decision made, a piece of legislation put forth\"). Every seat links to the member's profile.",
  },
  {
    id: 'map-vote',
    targets: ['network-map'],
    end: onHome(STATE_CARD),
    play: async (signal) => {
      await home.setMapView('us', signal);
      await home.rollCall(signal);
      if (!signal.aborted) await home.openStateCard('OH');
    },
    title: 'Vote by State',
    body: 'The map shows the same vote by state. Select a state to see how its senators voted and open one of them in Explore.',
    notes: '"A brief intro to your visualization model in that you can kind of see things moving." Point out that the chart and the map are linked: hovering a seat highlights its state.',
  },
  {
    id: 'live',
    targets: ['activity', 'network-map'],
    end: onHome(LIVE),
    play: async (signal) => {
      home.closeStateCard();
      await home.triggerLiveRecord(signal);
    },
    title: 'Live Records',
    body: 'A new filing appears in the activity feed, and the map draws its connection. This one is a contribution from a defense contractor to a senator.',
    notes: '"You might have an activity feed over here that\'s tracking some movements on folks that you are tracking, elected officials that you\'re tracking." "Whatever you\'re looking at remains very live, remains very dynamic without being like overly cluttered."',
  },
  {
    id: 'follow-money',
    targets: ['radar', 'network-map'],
    end: onHome(MONEY),
    play: (signal) => home.setTopic(1, signal),
    title: 'Contractor Money and Lobbying',
    body: "The Defense Industrial Base topic changes the map. Each arc runs from a contractor's home state to a member it gave money to or lobbied.",
    notes: '"If I\'m looking into what [a company] has been doing with members of Congress, that is a nod, that is an entity that will be connected suddenly to all these lawmakers." Here the companies are defense contractors.',
  },
  {
    id: 'workspace',
    targets: ['watchlist', 'checkpoints'],
    end: onHome(LIVE),
    play: (signal) => home.setTopic(0, signal),
    title: 'Watchlist and Checkpoints',
    body: 'Follow the members and bills you track. Load a saved investigation to return to the same graph.',
    notes: '"You could have a watchlist over here that kind of shows your top movers, your top shakers, maybe the top piece of legislation you\'re watching." The checkpoints below it come back on the save step.',
  },

  // Part 2: Explore
  {
    id: 'ask-chat',
    targets: ['explore-chat'],
    end: ASK_TYPED,
    play: async (signal) => {
      // Explore opens clean under the curtain, with the cutout on the chat.
      await changePage('/explore', signal, resetExploration);
      // The typing starts once the curtain has fully lifted and the field is in the cutout.
      await sleep(prefersReducedMotion() ? 150 : TYPE_AFTER_CURTAIN_MS, signal);
      // The question stays in the field, unsent: the next step sends it.
      await typeDraft(FIRST_QUESTION, FIRST_TYPE_MS, signal);
    },
    title: 'Question in the Chat',
    body: 'An investigation starts with a question in the chat. Privyus answers from public records and cites the filings it used.',
    notes: 'Let the question sit for a moment and read it out. It is plain English, with no filters and no query syntax. Press → to send it.',
  },
  {
    id: 'ask-graph',
    targets: ['explore-chat', 'graph'],
    end: onExplore('ukraine-stance'),
    play: async (signal) => {
      // The send button shows pressed with the cutout still on the chat.
      spotlight(['explore-chat']);
      const turn = await pressSend(signal);
      // The cutout widens to the chat and the graph as the graph builds.
      if (!signal.aborted) spotlight(null);
      await playTurn(turn, signal);
    },
    title: 'Chat and Graph',
    body: 'Privyus lists each step as it works and builds the graph around the topic. The two bills land at their introduction dates. Their members show as faint nodes at the edge.',
    notes: '"The chatbot is one and the same with your visualization model. So the idea would be you can ask the chat a question and it would automatically start to populate your visuals over here." "You have it all in front of you, and the map builds itself." The faint nodes at the edges: "You have sort of clues... things are visible, but they\'re not distracting so that you know that there\'s something there."',
  },
  {
    id: 'bill',
    targets: ['graph'],
    end: onExplore('defense-support-members'),
    play: async (signal) => playTurn(await pressNode('s456', signal), signal),
    title: 'Bill Sponsors',
    body: 'Select S. 456 to see its sponsor and six cosponsors, each at the date they joined. The chat describes each change to the graph.',
    notes: '"And so you ask it about a particular bill. So you can see all of these members who have supported it, which tells you, okay, here\'s my guys that I need to be watching." "As you click on this, the chatbot would auto-populate... It would basically describe what you\'re seeing as you\'re seeing it."',
  },
  {
    id: 'senator',
    targets: ['graph'],
    end: onExplore('hartley-profile'),
    play: async (signal) => playTurn(await pressNode('hartley', signal), signal),
    title: 'Member Profile',
    body: "Sen. Hartley's record splits into six categories, one ring each. A record's place on its ring is its date, so her busiest months stand out.",
    notes: '"So here you might be able to look at what meetings he had." "You\'d be able to see what lobbyists went to meet him. You\'d be able to see maybe what defense companies perhaps gave him contributions." "Maybe he traveled to Ukraine with several others of these members. Maybe in the past he has a record of voting for aid."',
  },
  {
    id: 'meeting',
    targets: ['graph'],
    end: onExplore('private-meeting-attendees'),
    play: async (signal) => {
      // The story: click "Meetings", then "Private meeting"; the attendees appear.
      await playTurn(await pressNode('cat-meetings', signal), signal, 'graph');
      if (!signal.aborted) await playTurn(await pressNode('meeting-private', signal), signal);
    },
    title: 'Private Meeting Attendees',
    body: 'Open Meetings and select the June 17 private meeting. The visitor log lists three attendees. One represents Aegis Systems, which also appears in her contributions.',
    notes: '"You\'d be able to see, I mean, with the database in there, you\'d be able to see what lobbyists went to meet him." "It will show you links that you might not know."',
  },
  {
    id: 'sources',
    targets: ['sources', 'source-drawer'],
    end: onExplore('private-meeting-attendees', 'disc-private'),
    play: async (signal) => {
      openSource('disc-private');
      // The drawer's entrance (fade and rise).
      await sleep(MOTION.panelMs, signal);
    },
    title: 'Source Records',
    body: 'Each answer cites the public records it comes from. This visitor log is the filing behind the attendee list.',
    notes: '"This platform is built on data that is out there, verified, reported by either the persons themselves or the entities themselves." "This is all verifiable data. They can click and see it totally."',
  },
  {
    id: 'follow-up',
    targets: ['explore-chat', 'graph'],
    end: onExplore('defense-contractor-contributions'),
    play: async (signal) => {
      closeSource();
      await typeDraft(FOLLOW_UP, FOLLOW_UP_TYPE_MS, signal);
      await playTurn(await pressSend(signal), signal);
    },
    title: 'Follow-Up Question',
    body: 'Ask which defense contractors gave to Hartley. The answer adds their three PACs. The marker dates the Aegis contribution, her S. 456 vote, and the private meeting.',
    notes: '"If you ask a question on the other side, the right side is also expanding more. It\'s just like, okay, what is the contributions in here and here that links to [him]?"',
  },
  {
    id: 'save-button',
    targets: ['save-button'],
    end: onExplore('defense-contractor-contributions'),
    // The cutout moves to Save; nothing is saved yet (the next step presses it).
    play: (signal) => sleep(SPOT_GLIDE_MS, signal),
    title: 'Save Button',
    body: 'Save stores the graph, the view, and the chat together as one checkpoint.',
    notes: '"And then at some point you might want to just save your progress and that will allow you to return exactly to this position at a later date." Press → to save.',
  },
  {
    id: 'save',
    targets: ['checkpoint-latest'],
    end: SAVED_HOME,
    play: async (signal) => {
      // The audience sees the save: Save shows pressed, turns to "Saved" with the
      // toast, a short beat, then Home fades in fully drawn with the new
      // checkpoint spotlighted. A save replaces this run's earlier one.
      spotlight(['save-button']);
      await sleep(SAVE_BEAT_BEFORE_MS, signal);
      if (signal.aborted) return;
      const shown = nextEvent('toast-shown', { signal, timeoutMs: 1000 });
      clearSavedCheckpoints();
      if (!(await pressSave(signal))) return;
      await shown;
      await sleep(900, signal);
      await changePage('/', signal, () => {
        dismissToast();
        spotlight(null);
      });
    },
    title: 'Saved Checkpoint',
    body: 'The new checkpoint appears on Home. Load it later to continue from the same point.',
    notes: '"Kind of like a video game, you can come back right to this spot and kind of continue from there."',
  },

  // Part 3: Search
  {
    id: 'search',
    targets: ['search-field', 'search-results'],
    end: { ...SAVED_HOME, route: '/search', search: 'hart' },
    play: async (signal) => {
      await changePage('/search', signal);
      if (signal.aborted) return;
      const results = nextEvent('search-results', { match: (q) => q === 'hart', signal, timeoutMs: 2000 });
      await typeInto(setSearchText, 'hart', SEARCH_TYPE_MS, signal);
      await results;
    },
    title: 'Record Search',
    body: 'Search finds people, bills, organizations, and filings by name. Choose Ask to send the same text to Privyus as a question.',
    notes: 'No transcript line (search was added after the walkthrough). Show that filings are found by the people they concern, not only by title. Ties to "all of these public records exist on a whole slew of different databases". Press → for the closing slide.',
  },

  // The close (the last step stays until Esc or the X)
  {
    id: 'close',
    targets: [],
    end: { ...SAVED_HOME, route: '/search', search: 'hart' },
    play: async () => {},
    slide: true,
    title: 'Thank You',
    body: "",
    notes: 'The closing slide. Hand over to questions. Press Esc or the X at the top right to leave presenter mode and explore freely.',
  },
];
