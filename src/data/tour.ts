/**
 * Presenter mode steps (PRESENTER-MODE.md section 3). Card text and notes are
 * copied from the spec. Each step declares its settled `end` state (what ← puts
 * in place before the next step plays) and `play`, its visible action.
 */
import { dismissToast } from '@/components/ui/Toast';
import * as home from '@/features/dashboard/home-controller';
import {
  ask,
  closeSource,
  moveTimeWindow,
  openSource,
  pressNode,
  pressSave,
  pressSend,
  resetExploration,
  typeDraft,
  type MonthWindow,
} from '@/features/explore/controller';
import { entities } from './entities';
import { CLEAN, HOME_START, type StepState } from '@/features/presenter/state';
import { clearSavedCheckpoints } from '@/lib/checkpoints';
import { nextEvent } from '@/lib/events';
import { whenGraphAtRest } from '@/lib/graph-motion';
import { MOTION, prefersReducedMotion } from '@/lib/motion';
import type { TurnHandle } from '@/lib/script-engine';
import { changePage, sleep, spotlight, untilAbort, type TourStep } from '@/lib/tour';
import { ATTENDEE_QUESTION, ATTENDEE_TURN, FIRST_QUESTION, FOLLOW_UP, RECORDS_QUESTION } from './tour-story';
import { PEOPLE_STORY, script } from './script';

/** The cutout's glide to a new target (Spotlight). */
const SPOT_GLIDE_MS = 300;
/** A short beat on Save (already in the cutout) before it is pressed. */
const SAVE_BEAT_BEFORE_MS = 200;
const FOLLOW_UP_TYPE_MS = 250;
const FIRST_TYPE_MS = 450;
/** The cutout's glide to the ask bar, then a short beat on it before the typing starts. */
const TYPE_AFTER_GLIDE_MS = SPOT_GLIDE_MS + 150;

/* Home as each step leaves it. */
const STATE_CARD = { ...HOME_START, stateCard: 'MS' };
const LIVE = { ...HOME_START, liveRecord: true };
const MONEY = { ...LIVE, topic: 1 };

const onHome = (h: StepState['home']): StepState => ({ route: '/', home: h, search: '', checkpoint: false });
const onExplore = (turnId: string, sourceOpen?: string, window?: MonthWindow): StepState => ({
  route: '/explore',
  explore: { turnId, sourceOpen, window },
  checkpoint: false,
});
/**
 * The Time Window step's window: the months of the firm's Ukraine contacts (41 of
 * its 43 contact rows for that principal fall in May to August 2024, FARA 7255).
 */
const STORY_WINDOW: MonthWindow = ['2024-05', '2024-08'];
/** Home, with the first question typed into the ask bar and not sent. */
const ASK_TYPED = onHome({ ...LIVE, askDraft: FIRST_QUESTION });
/** The full investigation in Explore: the whole story, through the public statements (src/data/tour-story.ts). */
const STORY_END = onExplore(PEOPLE_STORY.turns.at(-1)!);
/** The investigation through the defense PAC question (the window open to every month again). */
const MONEY_END = onExplore('defense-pac-contributions');
/** After the save: Home with the one new checkpoint (of the whole story). */
const SAVED_HOME: StepState = {
  route: '/',
  home: LIVE,
  explore: { turnId: PEOPLE_STORY.turns.at(-1)! },
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

/* ------------------------------------------------------------------ */
/* Card copy from the data                                             */
/* ------------------------------------------------------------------ */
/*
 * Every name, date, and number in the chain and deeper-layer cards comes from
 * the data (PEOPLE_STORY in src/data/script.ts, entities.ts), so a new cast or
 * new records change the copy with them.
 */
const byId = new Map(entities.map((e) => [e.id, e]));
/** Everyone the lobbying-network turn adds, by group (the firm's Ukraine-principal contacts, and members named by their staff). */
const ATTENDEE_STEPS = script.find((t) => t.id === ATTENDEE_TURN)?.steps ?? [];
const ATTENDEE_CONTACTS = (ATTENDEE_STEPS.find((st) => /every contact/i.test(st.label))?.delta.add.entities ?? []).filter((id) => byId.get(id)?.type === 'person');
const groupOf = (id: string) => byId.get(id)?.group ?? (byId.get(id)?.label.startsWith('Sen.') ? 'senate' : 'house');
const groupCount = (g: string) => ATTENDEE_CONTACTS.filter((id) => groupOf(id) === g).length;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fullName = (id: string) => byId.get(id)?.label ?? id;
/** "Wicker" for a member of Congress, the full name for staff and press. */
const name = (id: string) => (/^(Sen|Rep)\. /.test(fullName(id)) ? fullName(id).split(' ').slice(2).join(' ') : fullName(id));
const joinList = (items: string[]) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
const DAY_PEOPLE = PEOPLE_STORY.wickerDayOthers.map(fullName);
const RIC = PEOPLE_STORY.recordsInCommon;
const [, TURN_SAME_DATE, TURN_MEMBER] = PEOPLE_STORY.turns;
export const tourSteps: TourStep<StepState>[] = [
  // Part 1: Home
  {
    id: 'radar',
    targets: ['radar'],
    end: CLEAN,
    play: (signal) => home.setTopic(0, signal),
    title: 'Topic Radar',
    body: 'Radar counts the activity on each tracked topic. Switch tabs to see the Senate vote or the trend over the last 30 days.',
    notes: 'Open: "Privyus is going to be that database for you." "What Bloomberg did to the financial data integrated with Palantir." The problem: "When you\'re looking through each of these silos and each of these databases, it\'s very difficult to connect all of them at once." "We spend hours, if not weeks and months sometimes, to analyze something and try to find connections." Then the radar: "Maybe the top piece of legislation you\'re watching." "And all of this would be able to be customizable."',
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
    body: 'Each seat is one senator on roll call 224, the August 7, 2026 Senate passage of H.R. 5334, 86-11. Color shows the party. A solid seat voted yes and a ring voted no.',
    notes: "No transcript line: the vote is the factual record behind the topic (\"evidence that can tie to a decision made, a piece of legislation put forth\"). Every seat links to the member's profile.",
  },
  {
    id: 'map-vote',
    targets: ['network-map'],
    end: onHome(STATE_CARD),
    play: async (signal) => {
      await home.setMapView('us', signal);
      await home.rollCall(signal);
      if (!signal.aborted) await home.openStateCard('MS');
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
    body: 'A filing appears in the activity feed, and the map draws its connection. This one is an FEC record of defense company PAC transfers to a senator.',
    notes: '"You might have an activity feed over here that\'s tracking some movements on folks that you are tracking, elected officials that you\'re tracking." "Whatever you\'re looking at remains very live, remains very dynamic without being like overly cluttered."',
  },
  {
    id: 'follow-money',
    targets: ['radar', 'network-map'],
    end: onHome(MONEY),
    play: (signal) => home.setTopic(1, signal),
    title: 'Defense PAC Contributions',
    body: "The Defense PAC Giving topic changes the map. Each arc runs from a PAC's filing address to a senator it gave to, from FEC bulk data.",
    notes: '"If I\'m looking into what [a company] has been doing with members of Congress, that is a nod, that is an entity that will be connected suddenly to all these lawmakers." Here the companies are defense contractors.',
  },
  {
    id: 'workspace',
    targets: ['watchlist', 'checkpoints'],
    end: onHome(LIVE),
    play: (signal) => home.setTopic(0, signal),
    title: 'Watchlist and Checkpoints',
    body: 'Follow the members and bills you track. Load a saved investigation to return to the same graph.',
    notes: '"You could have a watchlist over here that kind of shows your top movers, your top shakers, maybe the top piece of legislation you\'re watching." The checkpoints below it come back at the end of the tour, when you save the investigation.',
  },

  // Part 2: Explore. One graph, built step by step: the four-link chain (a member acts, who contacted
  // him, who else the firm contacted, records in common), then the deeper layers.
  {
    id: 'ask-home',
    targets: ['ask-bar'],
    end: ASK_TYPED,
    play: async (signal) => {
      // The cutout glides from the watchlist to the ask bar; the typing starts once it is there.
      await sleep(prefersReducedMotion() ? 150 : TYPE_AFTER_GLIDE_MS, signal);
      // The question stays in the field, unsent: the next step sends it.
      await home.typeAsk(FIRST_QUESTION, FIRST_TYPE_MS, signal);
    },
    title: 'Ask From Home',
    body: 'An investigation starts with a question. Type it in plain English in the ask bar on Home. Privyus answers from public records and cites the filings it used.',
    notes: 'The ask bar: "Obviously, the NLP chat agent model is going to be very prominent because this is maybe where you would start on most days." Let the question sit for a moment and read it out. It is plain English, with no filters and no query syntax. Press → to send it.',
  },
  {
    id: 'ask-graph',
    targets: ['explore-chat', 'graph'],
    end: onExplore('ukraine-stance'),
    play: async (signal) => {
      // The ask bar's send button shows pressed with the cutout still on it.
      spotlight(['ask-bar']);
      const question = (await home.pressAsk(signal)) ?? FIRST_QUESTION;
      if (signal.aborted) return;
      // As the ask bar's submit (/explore?q=): Explore opens clean and asks the question.
      // In presenter mode Explore does not read `?q=`, so the step asks it itself.
      // The cutout moves to the chat and the graph under the curtain.
      await changePage('/explore', signal, () => {
        resetExploration();
        spotlight(null);
      });
      if (signal.aborted) return;
      await playTurn(ask(question), signal);
    },
    title: 'Chat and Graph',
    body: 'Explore opens with the question. Privyus lists each step as it works and builds the graph around the topic. The three bills land at the dates of their latest actions. The cosponsors of S. 5025 show as small dots at the edge.',
    notes: '"The chatbot is one and the same with your visualization model. So the idea would be you can ask the chat a question and it would automatically start to populate your visuals over here." "You have it all in front of you, and the map builds itself." The small dots at the edges: "You have sort of clues... things are visible, but they\'re not distracting so that you know that there\'s something there."',
  },
  {
    id: 'bill',
    targets: ['graph'],
    end: onExplore('s5025-cosponsors'),
    play: async (signal) => playTurn(await pressNode('s5025', signal), signal),
    title: 'Link 1: A Member Acts',
    body: 'The story starts when a member acts. Select S. 5025 to see the 17 senators here who are original cosponsors, all dated July 16, 2026. Sen. Wicker is one of them.',
    notes: '"And so you ask it about a particular bill. So you can see all of these members who have supported it, which tells you, okay, here\'s my guys that I need to be watching." "As you click on this, the chatbot would auto-populate... It would basically describe what you\'re seeing as you\'re seeing it." This is link 1 of 4: a member acts. Max: "Somebody does something, and you want to figure out why."',
  },
  {
    id: 'senator',
    targets: ['graph'],
    end: onExplore('wicker-profile'),
    play: async (signal) => playTurn(await pressNode('wicker', signal), signal),
    title: 'Member Profile',
    body: "Select Sen. Wicker to open his record. It splits into six categories, one ring each. A record's place on its ring is its date.",
    notes: '"So here you might be able to look at what meetings he had." "You\'d be able to see what lobbyists went to meet him. You\'d be able to see maybe what defense companies perhaps gave him contributions."',
  },
  {
    id: 'meeting',
    targets: ['graph'],
    end: onExplore('moran-contact'),
    play: async (signal) => {
      // The story: click "Contacts", then the June 9 Ukraine entry; the registrant and its principal appear.
      await playTurn(await pressNode('cat-contacts', signal), signal, 'graph');
      if (!signal.aborted) await playTurn(await pressNode('contact-ua-0609', signal), signal);
    },
    title: 'Link 2: Who Contacted Him',
    body: 'Why did he act? Start with who contacted him. Open Contacts and select the June 9, 2024 entry. A FARA filing shows that Moran Global Strategies reported a contact with him that day for a Ukrainian ministry.',
    notes: 'Link 2 of 4. Max: "why did she vote the way she did? ... she had this meeting from Aegis and she had these private meetings." "You\'d be able to see, I mean, with the database in there, you\'d be able to see what lobbyists went to meet him." "It will show you links that you might not know." The filing names the registrant and its foreign principal, The Ministry for Strategic Industries of Ukraine.',
  },
  {
    id: 'sources',
    targets: ['sources', 'source-drawer'],
    end: onExplore('moran-contact', 'fara-wicker-ua-0609'),
    play: async (signal) => {
      openSource('fara-wicker-ua-0609');
      // The drawer's entrance (fade and rise).
      await sleep(MOTION.panelMs, signal);
    },
    title: 'Source Records',
    body: 'Each answer cites the public records it comes from. This FARA filing row is the record behind the June 9 contact. Open original goes to the filing itself.',
    notes: '"This platform is built on data that is out there, verified, reported by either the persons themselves or the entities themselves." "This is all verifiable data. They can click and see it totally."',
  },
  {
    id: 'who-else-met',
    targets: ['explore-chat', 'graph'],
    end: onExplore(ATTENDEE_TURN),
    play: async (signal) => {
      // The same graph: the drawer closes and the next question goes into the chat.
      closeSource();
      await typeDraft(ATTENDEE_QUESTION, FOLLOW_UP_TYPE_MS, signal);
      await playTurn(await pressSend(signal), signal);
    },
    title: 'Link 3: Who Else the Firm Contacted',
    body: `Who else did the firm contact? Ask the chat. For the same Ukrainian ministry, the filing lists ${plural(groupCount('senate'), 'senator', 'senators')}, ${plural(groupCount('house'), 'House member', 'House members')}, ${plural(groupCount('staff'), 'staff member', 'staff members')}, and ${plural(groupCount('press'), 'reporter', 'reporters')}, one ring for each group.`,
    notes: 'Link 3 of 4. Max: "I think the next phase that is, like, really important for people to see is who else is with her. And you know how you get to that step? You say, \'Who else did these people meet with?\'" Mo: "they\'ve been visited by the same lobbyist. This is the kind of the hidden connection." The same FARA filing lists every Hill contact for this principal: senators, House members, staff, and one reporter. Staff rows name their members, so Calvert and Bacon appear through their chiefs of staff. The small dots are contributions by James P. Moran that the same filing also lists. Every node opens its filing rows. Press → to go back to the bills.',
  },
  {
    id: 'records-in-common',
    targets: ['explore-chat', 'graph'],
    end: onExplore('records-in-common'),
    play: async (signal) => {
      await typeDraft(RECORDS_QUESTION, FOLLOW_UP_TYPE_MS, signal);
      await playTurn(await pressSend(signal), signal);
    },
    title: 'Link 4: Records in Common',
    body: `Back to the bills. Of the ${RIC.contacts} people the firm lists, ${RIC.cosponsors.length} also cosponsored S. 5025, and ${RIC.yes.length} voted yes on H.R. 5334. Each bill links to the people who share it. These are records in common, not a reason for any vote.`,
    notes: `Link 4 of 4. Max: "Somebody does something, and you want to figure out why. And then you want to figure out who else is going to do the same thing. And the way that you do that in this realm is you figure out, well, who's she talking to and who else did they talk to as well?" Shared votes and co-signed letters alone are "small potatoes. That's something that people can pull off Google and Congress.gov." The value is the chain: the member, the firm, the firm's other contacts, and then the bills. The cosponsors are ${joinList(RIC.cosponsors.map(name))}. The ${RIC.no.length} no votes are ${joinList(RIC.no.map(name))}. Staff and the reporter cast no votes, and ${joinList(RIC.notOnRoll.map(fullName))} is not on the 2026 Senate roll call. Say it plainly: records in common, not a cause. Press → to go deeper, to the dates.`,
  },
  {
    id: 'time-window',
    targets: ['graph', 'timeline'],
    end: onExplore('records-in-common', undefined, STORY_WINDOW),
    play: async (signal) => {
      await moveTimeWindow(STORY_WINDOW, signal);
      // The records outside the window finish fading before the caption is placed.
      await whenGraphAtRest(signal);
    },
    title: 'Go Deeper: Time Window',
    body: 'Now go one layer deeper, to the dates. Each bar counts records by month. Here the window is May to August 2024, when the firm lists most of its Ukraine contacts. Records outside the window fade, such as the 2026 votes on H.R. 5334.',
    notes: 'The strip at the bottom of the graph filters it by date. Of the 43 Ukraine contact rows in the firm\'s filing, 41 fall from May to August 2024. Wicker\'s June 9 contact stays in the window. S. 5025 stays on screen because the orange path back to the topic runs through it. On the deeper layers: "there\'s like three hidden, you know, grayed out circles that like are not obvious." "Show all months" at the right of the strip brings every record back, and Play shows the records in date order. Press → to select the June 9 date.',
  },
  {
    id: 'people-same-date',
    targets: ['graph'],
    end: onExplore(TURN_SAME_DATE, undefined, STORY_WINDOW),
    play: async (signal) => playTurn(await pressNode(PEOPLE_STORY.wickerDay, signal), signal),
    title: 'Hidden Layer: Same Date',
    body: `Select the ${longDate(PEOPLE_STORY.wickerDate)} contact date. The firm lists Wicker and ${joinList(DAY_PEOPLE)} on that date. They share no trip, and ${joinList(PEOPLE_STORY.wickerDayOthers.map(name))} is not an S. 5025 cosponsor. Here the date is the link, and that is all it shows.`,
    notes: 'This is the hidden layer. The user\'s point: "both of these people are documented talking with, um, person C, right, on the same day." Here the date record is person C. Say it plainly: the filing does not say the two were in one room, and the firm reports many of the same visits under other clients too. Both also voted yes on H.R. 5334 (the last step), in different chambers.',
  },
  {
    id: 'follow-up',
    targets: ['explore-chat', 'graph'],
    end: MONEY_END,
    play: async (signal) => {
      // Some PAC transfers are from 2023: the window opens to every month first, as a drag would.
      await moveTimeWindow(null, signal);
      if (signal.aborted) return;
      await typeDraft(FOLLOW_UP, FOLLOW_UP_TYPE_MS, signal);
      await playTurn(await pressSend(signal), signal);
    },
    title: 'One More Thread: Money',
    body: 'One more thread: money. The window opens to all months again. Ask which defense PACs gave to Wicker. The answer adds five corporate PACs with their 2023-24 totals from FEC bulk data.',
    notes: '"If you ask a question on the other side, the right side is also expanding more. It\'s just like, okay, what is the contributions in here and here that links to [him]?" "If I\'m looking into what [a company] has been doing with members of Congress, that is a nod, that is an entity that will be connected suddenly to all these lawmakers." Press → for one member\'s public statements.',
  },
  {
    id: 'public-statements',
    targets: ['graph', 'public-statements'],
    end: onExplore(TURN_MEMBER),
    play: async (signal) => playTurn(await pressNode(PEOPLE_STORY.member, signal), signal),
    title: 'Public Statements',
    body: `Select ${fullName(PEOPLE_STORY.member)}. The firm lists him, and he is an original cosponsor of S. 5025. Under the answer, Public statements shows his quotes from public sources, each with a date, a source, and a tone label. The label is an AI reading of the text, not a forecast of any vote.`,
    notes: "Mo's point: outside channels matter. These are his own words from public sources (floor remarks and a statement, as Roll Call reported them), each with its date and a link to the original. They are not cited records and never change the graph. The tone label reads only the quoted text. Press → to save the investigation.",
  },

  // Part 4: Back to the investigation, and save it.
  {
    id: 'save-button',
    targets: ['save-button'],
    end: STORY_END,
    play: async (signal) => {
      // The same graph: nothing is saved yet (the next step presses Save).
      await sleep(SPOT_GLIDE_MS, signal);
    },
    title: 'Save Button',
    body: 'Save the investigation. Save stores the graph, the view, and the chat as one checkpoint.',
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

  // The close (the last step stays until Esc or the X)
  {
    id: 'close',
    targets: [],
    end: SAVED_HOME,
    play: async () => {},
    slide: true,
    title: 'Thank You',
    body: "",
    notes: 'The closing slide. Hand over to questions. Press Esc or the X at the top right to leave presenter mode and explore freely.',
  },
];
