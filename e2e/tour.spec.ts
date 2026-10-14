import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { entities } from "../src/data/entities";
import { PEOPLE_STORY, script } from "../src/data/script";

/**
 * Presenter mode (PRESENTER-MODE.md). Every step's ready screen is a baseline
 * ("step-n"); → , ←, deep links, and rapid presses must all reach the same one.
 * Timings: key press to caption (data-tour-phase="ready"). The spec limit is 5s;
 * steps above the 3s target are listed in the report annotations.
 */
const STEPS = 21;
/*
 * Landmark steps (1-based). Home, ending with the question typed into the Home
 * ask bar, then one continuous Explore graph (the four-link chain: a member acts,
 * who contacted him, who else the firm contacted, records in common; then the
 * deeper layers: the time window, the shared date, money, public statements),
 * the save, then the close.
 */
const ASK_HOME = 7;
const ASK_GRAPH = 8;
const BILL = 9;
const SENATOR = 10;
const MEETING = 11;
const SOURCES = 12;
const WHO_ELSE_MET = 13;
const RECORDS = 14;
const TIME_WINDOW = 15;
const SAME_DATE = 16;
const FOLLOW_UP = 17;
const STATEMENTS = 18;
const SAVE_BUTTON = 19;
const SAVE = 20;
const FIRST_QUESTION = "What is the United States' stance on Ukraine?";
/** The steps after the firm's network, and the chat turn each one leaves last (PEOPLE_STORY.turns). */
const [TURN_RECORDS, TURN_SAME_DATE, TURN_MEMBER] = PEOPLE_STORY.turns;
const LAST_TURN: Record<number, string> = { [RECORDS]: TURN_RECORDS, [TIME_WINDOW]: TURN_RECORDS, [SAME_DATE]: TURN_SAME_DATE, [FOLLOW_UP]: "defense-pac-contributions", [STATEMENTS]: TURN_MEMBER, [SAVE_BUTTON]: TURN_MEMBER };
/** Explore steps whose caption must stay clear of the chat and the graph. */
const EXPLORE_STEPS = [ASK_GRAPH, BILL, SENATOR, MEETING, SOURCES, WHO_ELSE_MET, RECORDS, TIME_WINDOW, SAME_DATE, FOLLOW_UP, STATEMENTS, SAVE_BUTTON];
/** Explore steps with a graph on screen. */
const GRAPH_STEPS = EXPLORE_STEPS;
/** The timeline window label at each graph step: narrowed at the Time Window and Same Date steps, then every month again. */
const FULL_WINDOW = "Jan 2023 to Sep 2026";
const STORY_WINDOW = "May 2024 to Aug 2024";
const windowAt = (n: number) => (n >= TIME_WINDOW && n <= SAME_DATE ? STORY_WINDOW : FULL_WINDOW);
/**
 * The senators the lobbying-network turn puts on its Senators ring (read from the script, so a new
 * cast needs no test change): each one is named at rest. Wicker stays as his June 9 record.
 */
const byId = new Map(entities.map((e) => [e.id, e]));
const ATTENDEE_CONTACTS = (script.find((t) => t.id === "moran-network")?.steps ?? []).flatMap((st) => st.delta.add.entities).filter((id) => byId.get(id)?.type === "person");
const ATTENDEE_SENATORS = ATTENDEE_CONTACTS.filter((id) => id !== "wicker" && (byId.get(id)?.group === "senate" || byId.get(id)?.label.startsWith("Sen.")));
/** Its House members: more than 8 on one ring, so they show initials at rest and names on hover. */
const ATTENDEE_HOUSE = ATTENDEE_CONTACTS.filter((id) => byId.get(id)?.group === "house" && script.find((t) => t.id === "moran-network")!.steps.some((st) => st.delta.add.edges.includes(`moran-${id}`)));
/** Records in common: the firm's senators on a shared bill (Wicker stays as his June 9 record), and the contacts on none. */
const RIC = PEOPLE_STORY.recordsInCommon;
const RIC_SENATORS = ATTENDEE_SENATORS.filter((id) => RIC.yes.includes(id) || RIC.cosponsors.includes(id));
const RIC_NONE = ATTENDEE_CONTACTS.filter((id) => id !== "wicker" && !RIC.yes.includes(id) && !RIC.cosponsors.includes(id) && script.find((t) => t.id === "moran-network")!.steps.some((st) => st.delta.add.edges.includes(`moran-${id}`)));
const CHECKPOINTS = "privyus.demo.checkpoints.v1";
const LIMIT_MS = 5000;
const TARGET_MS = 3000;

test.beforeEach(async ({ page }, info) => {
  const theme = (info.project.metadata as { theme: string }).theme;
  await page.addInitScript((t) => {
    localStorage.setItem("privyus.theme", t);
    // Test probes (no app code): curtain-opaque time, page mounts.
    const w = window as unknown as { __opaqueMax: number; __mounts: Record<string, number> };
    w.__opaqueMax = 0;
    w.__mounts = { home: 0, explore: 0, search: 0 };
    let since = 0;
    const tick = () => {
      const on = document.documentElement.getAttribute("data-tour-curtain") === "on";
      if (on && !since) since = performance.now();
      if (!on && since) {
        w.__opaqueMax = Math.max(w.__opaqueMax, performance.now() - since);
        since = 0;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const seen = new WeakSet<Element>();
    new MutationObserver(() => {
      for (const [k, sel] of [["home", '[data-tour="radar"]'], ["explore", '[data-tour="graph"]'], ["search", '[data-tour="search-field"]']]) {
        const el = document.querySelector(sel);
        if (el && !seen.has(el)) {
          seen.add(el);
          w.__mounts[k]++;
        }
      }
    }).observe(document, { childList: true, subtree: true });
  }, theme);
});

const html = (page: Page, attr: string) => page.evaluate((a) => document.documentElement.getAttribute(a), attr);

async function ready(page: Page, n: number, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    (n) => document.documentElement.getAttribute("data-tour-step") === String(n) && document.documentElement.getAttribute("data-tour-phase") === "ready",
    n,
    { timeout },
  );
}

/** Presses `key` and returns the time until step `n` is ready. */
async function press(page: Page, key: string, n: number): Promise<number> {
  const t0 = Date.now();
  await page.keyboard.press(key);
  await ready(page, n);
  return Date.now() - t0;
}

async function shot(page: Page, n: number): Promise<void> {
  await expect(page).toHaveScreenshot(`step-${n}.png`, {
    // The orbit graph's WebGL canvas (pulses and bloom move every frame) is left out;
    // its DOM overlays (cards, ring labels, edge labels, the timeline) are compared.
    stylePath: path.join(__dirname, "hide-canvas.css"),
    mask: [
      page.locator('[data-tour="network-map"] [role="img"]'), // the globe drifts with time
      page.locator('[data-tour="activity"] .text-live'), // "Just now"
      page.locator('[data-tour="checkpoint-latest"] .text-teal-bright'), // "Saved 11:25 PM"
    ],
  });
}

/**
 * Explore steps (8 to 20): the caption never covers the Exploration Chat panel,
 * and never a graph node or label drawn at full strength (or an edge label).
 * Ghost and dimmed context may sit under a docked caption when nothing clear exists.
 */
async function captionClear(page: Page, n: number): Promise<void> {
  const hits = await page.evaluate(() => {
    const cap = document.querySelector("[data-tour-caption]")!.getBoundingClientRect();
    const hit = (r: DOMRect) => r.width > 0 && r.height > 0 && cap.left < r.right && cap.right > r.left && cap.top < r.bottom && cap.bottom > r.top;
    const out: string[] = [];
    const chat = document.querySelector('[data-tour="explore-chat"]');
    if (chat && hit(chat.getBoundingClientRect())) out.push("chat panel");
    document.querySelectorAll('[data-tour="graph"] .react-flow__node').forEach((node) => {
      const cls = node.firstElementChild?.classList;
      if (!cls || cls.contains("opacity-0") || cls.contains("privy-ghost") || cls.contains("privy-dim")) return;
      const id = node.getAttribute("data-id");
      const circle = node.querySelector(".rounded-full");
      if (circle && hit(circle.getBoundingClientRect())) out.push(`node ${id}`);
      const label = node.querySelector("[data-node-label]");
      if (label && !label.parentElement?.classList.contains("opacity-0") && hit(label.getBoundingClientRect())) out.push(`label ${id}`);
    });
    // The orbit graph: DOM overlays over the WebGL canvas.
    const shown = (el: Element) => getComputedStyle(el).visibility === "visible";
    document.querySelectorAll('[data-tour="graph"] [data-graph-node]').forEach((node) => {
      const state = node.getAttribute("data-state");
      // An unopened record ("hint") counts as dim unless the step's note is about it.
      const unopened = state === "hint" && !node.hasAttribute("data-emphasis");
      if (!shown(node) || state === "ghost" || state === "faint" || state === "dim" || state === "hidden" || unopened) return;
      const id = node.getAttribute("data-node-id");
      const circle = node.querySelector("[data-node-hit]");
      if (circle && hit(circle.getBoundingClientRect())) out.push(`node ${id}`);
      const label = node.querySelector("[data-node-label]");
      if (label && shown(label) && hit(label.getBoundingClientRect())) out.push(`label ${id}`);
    });
    document.querySelectorAll('[data-tour="graph"] [data-ring-label]').forEach((l) => {
      if (shown(l) && hit(l.getBoundingClientRect())) out.push(`ring label ${l.textContent}`);
    });
    document.querySelectorAll("[data-edge-label]").forEach((l) => {
      if (shown(l) && hit(l.getBoundingClientRect())) out.push(`edge label ${l.textContent}`);
    });
    return out;
  });
  expect(hits, `step ${n} caption covers`).toEqual([]);
}

/**
 * What each Explore step shows on the orbit graph (the canvas is not compared
 * in screenshots, so the DOM state proves the step): the focused node, the
 * labels that must be readable, and the nodes on the orange chain.
 */
const PACS = ["pac-boeing", "pac-gd", "pac-lockheed", "pac-northrop", "pac-rtx"];
const GRAPH_STATE: Record<number, { focus: string; labels: string[]; path: string[]; named?: { ids: string[]; atLeast: number } }> = {
  [ASK_GRAPH]: { focus: "ukraine", labels: ["ukraine", "hr815", "s5025", "hr5334"], path: [] },
  // 17 cosponsors: a crowded ring names them on hover only.
  [BILL]: { focus: "s5025", labels: ["s5025", "ukraine"], path: ["ukraine", "s5025"] },
  [SENATOR]: {
    focus: "wicker",
    labels: ["wicker", "s5025", "cat-votes", "cat-trips", "cat-contacts", "cat-contributions", "cat-statements", "cat-others"],
    path: ["ukraine", "s5025", "wicker"],
  },
  [MEETING]: { focus: "contact-ua-0609", labels: ["contact-ua-0609", "moran", "ua-ministry", "wicker"], path: ["wicker", "contact-ua-0609"] },
  [SOURCES]: { focus: "contact-ua-0609", labels: ["contact-ua-0609", "moran", "ua-ministry", "wicker"], path: ["wicker", "contact-ua-0609"] },
  [FOLLOW_UP]: { focus: "cat-contributions", labels: ["wicker", "cat-contributions", ...PACS], path: ["wicker", ...PACS] },
  // Records in common: the firm centered, S. 5025 and H.R. 5334 named as the shared records, and the
  // senators on them named (where cards would cover each other, the weaker one shows on hover).
  [RECORDS]: {
    focus: "moran",
    labels: ["moran", "s5025", "hr5334"],
    named: { ids: RIC_SENATORS, atLeast: RIC_SENATORS.length - 2 },
    path: ["s5025", "blumenthal", "moran"],
  },
  // The window narrowed to May to August 2024: the same graph, the 2026 votes faded.
  [TIME_WINDOW]: { focus: "moran", labels: ["moran", "s5025"], path: ["s5025", "blumenthal", "moran"] },
  // The date in focus: the people it lists, on one ring.
  [SAME_DATE]: { focus: PEOPLE_STORY.wickerDay, labels: [PEOPLE_STORY.wickerDay, "wicker", ...PEOPLE_STORY.wickerDayOthers], path: ["s5025", "wicker", PEOPLE_STORY.wickerDay] },
  [STATEMENTS]: { focus: PEOPLE_STORY.member, labels: [PEOPLE_STORY.member, "s5025", "moran", "trip-munich-2025"], path: ["ukraine", "s5025", PEOPLE_STORY.member] },
  [SAVE_BUTTON]: { focus: PEOPLE_STORY.member, labels: [PEOPLE_STORY.member, "s5025", "moran", "trip-munich-2025"], path: ["ukraine", "s5025", PEOPLE_STORY.member] },
  // Who else the same firm contacted: every contact, one ring per group. The senators carry name
  // cards; where cards would cover each other, the weaker one shows on hover (most show at rest).
  [WHO_ELSE_MET]: {
    focus: "moran",
    labels: ["moran"],
    named: { ids: ATTENDEE_SENATORS, atLeast: ATTENDEE_SENATORS.length - 1 },
    // The root path runs through the shortest chain: S. 5025 and a cosponsor the firm lists.
    path: ["s5025", "blumenthal", "moran"],
  },
};

async function graphState(page: Page, n: number): Promise<void> {
  const want = GRAPH_STATE[n];
  if (!want) return;
  const got = await page.evaluate(() => {
    const g = document.querySelector('[data-tour="graph"]')!;
    const nodes = [...g.querySelectorAll<HTMLElement>("[data-graph-node]")];
    const shown = (el: Element | null) => !!el && getComputedStyle(el).visibility === "visible";
    return {
      focus: nodes.filter((x) => x.hasAttribute("data-focused")).map((x) => x.dataset.nodeId),
      labels: nodes.filter((x) => shown(x.querySelector("[data-node-label]"))).map((x) => x.dataset.nodeId!),
      path: nodes.filter((x) => x.hasAttribute("data-on-path")).map((x) => x.dataset.nodeId!).sort(),
    };
  });
  expect(got.focus, `step ${n} focus`).toEqual([want.focus]);
  for (const id of want.labels) expect(got.labels, `step ${n} label ${id} readable`).toContain(id);
  if (want.named) expect(want.named.ids.filter((id) => got.labels.includes(id)).length, `step ${n} named at rest: ${got.labels.join(", ")}`).toBeGreaterThanOrEqual(want.named.atLeast);
  expect(got.path, `step ${n} orange chain`).toEqual([...want.path].sort());
}

/**
 * The timeline window: its label at every graph step, and at the Time Window step the
 * strip is spotlighted, the June 9 contact and Rep. Turner show, and the H.R. 5334 votes
 * and Van Hollen's October contact (outside the window) do not.
 */
async function windowState(page: Page, n: number): Promise<void> {
  if (!GRAPH_STEPS.includes(n)) return;
  const strip = page.locator('[data-tour="timeline"]');
  await expect(strip.locator("[data-window-label]"), `step ${n} window label`).toHaveText(windowAt(n));
  if (n !== TIME_WINDOW) return;
  const shown = (id: string) =>
    page.locator(`[data-tour="graph"] [data-graph-node][data-node-id="${id}"]`).evaluate((el) => getComputedStyle(el).visibility === "visible");
  await expect.poll(() => shown("contact-ua-0609"), { message: `step ${n} the June 9 contact stays` }).toBe(true);
  await expect.poll(() => shown(PEOPLE_STORY.wickerDayOthers[0]), { message: `step ${n} Rep. Turner stays` }).toBe(true);
  await expect.poll(() => shown("hr5334"), { message: `step ${n} the 2026 votes fade` }).toBe(false);
  await expect.poll(() => shown("van-hollen"), { message: `step ${n} the October contact fades` }).toBe(false);
  // The caption docks in the graph, clear of the strip.
  const over = await page.evaluate(() => {
    const a = document.querySelector("[data-tour-caption]")!.getBoundingClientRect();
    const b = document.querySelector('[data-tour="timeline"]')!.getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  expect(over, `step ${n} caption covers the timeline`).toBe(false);
}

/**
 * A crowded ring (more than 8 records; the bill step: S. 5025's 17 cosponsors) shows its
 * records as nodes with initials, and their name cards on hover only: no card shows
 * at rest. The center's label is never covered.
 */
const CROWDED: Record<number, { count: number; hover: string; text: string }> = {
  [BILL]: { count: 17, hover: "van-hollen", text: "Van Hollen" },
  // The firm's House contacts (hover: the first one that no name card covers), here and on the
  // records-in-common graph (the same rings).
  [WHO_ELSE_MET]: { count: ATTENDEE_HOUSE.length, hover: "", text: "" },
  [RECORDS]: { count: ATTENDEE_HOUSE.length, hover: "", text: "" },
  [TIME_WINDOW]: { count: ATTENDEE_HOUSE.length, hover: "", text: "" },
};

async function crowdedState(page: Page, n: number): Promise<void> {
  const want = CROWDED[n];
  const g = page.locator('[data-tour="graph"]');
  if (!want) {
    if (GRAPH_STEPS.includes(n)) await expect(g.locator("[data-graph-node][data-crowded]"), `step ${n} no crowded ring`).toHaveCount(0);
    return;
  }
  const rest = await page.evaluate(() => {
    const graph = document.querySelector('[data-tour="graph"]')!;
    const shown = (el: Element | null) => !!el && getComputedStyle(el).visibility === "visible" && Number(getComputedStyle(el).opacity) > 0.01;
    const crowded = [...graph.querySelectorAll<HTMLElement>("[data-graph-node][data-crowded]")];
    const center = graph.querySelector('[data-node-label][data-kind="center"]')!.getBoundingClientRect();
    const covers = [...graph.querySelectorAll<HTMLElement>("[data-graph-node]")]
      .map((x) => ({ id: x.dataset.nodeId!, el: x.querySelector('[data-node-label]:not([data-kind="center"])') }))
      .filter(({ el }) => shown(el))
      .filter(({ el }) => {
        const r = el!.getBoundingClientRect();
        return r.left < center.right && r.right > center.left && r.top < center.bottom && r.bottom > center.top;
      })
      .map(({ id }) => id);
    return {
      count: crowded.length,
      named: crowded.filter((x) => shown(x.querySelector("[data-node-label]"))).map((x) => x.dataset.nodeId!),
      initials: crowded.filter((x) => shown(x.querySelector("[data-node-initials]"))).length,
      covers,
    };
  });
  expect(rest.count, `step ${n} crowded ring size`).toBe(want.count);
  expect(rest.named, `step ${n} no name card shows at rest`).toEqual([]);
  expect(rest.initials, `step ${n} initials on the crowded nodes`).toBe(want.count);
  expect(rest.covers, `step ${n} labels covering the center label`).toEqual([]);
  // A hover names the node; the card goes again once the pointer leaves.
  const hover =
    want.hover ||
    (await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>('[data-tour="graph"] [data-graph-node][data-crowded]')];
      const free = nodes.find((x) => {
        const r = x.querySelector("[data-node-hit]")!.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!top && x.contains(top);
      });
      return free?.dataset.nodeId ?? "";
    }));
  expect(hover, `step ${n} a crowded node free to hover`).not.toBe("");
  const text = want.text || (byId.get(hover)?.label.replace(/^(Sen|Rep)\. /, "") ?? "");
  const label = g.locator(`[data-node-id="${hover}"] [data-node-label]`);
  const box = (await g.locator(`[data-node-id="${hover}"] [data-node-hit]`).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => label.evaluate((el) => getComputedStyle(el).visibility === "visible" && Number(getComputedStyle(el).opacity) > 0.99), { message: `step ${n} hover names ${hover}` }).toBe(true);
  await expect(label).toContainText(text);
  await page.mouse.move(0, 0);
  await expect.poll(() => label.evaluate((el) => getComputedStyle(el).visibility === "hidden"), { message: `step ${n} card hides after the hover` }).toBe(true);
}

/**
 * The note each Explore step shows on the graph (src/data/graph-notes.ts), with
 * its text: it is visible, inside the graph, and the caption never covers it.
 * Steps not listed show no note.
 */
const NOTES: Record<number, { id: string; text: string }> = {
  [MEETING]: { id: "principal-link", text: "Registered as its principal Sep 24, 2023 to Jan 31, 2025" },
  [SOURCES]: { id: "principal-link", text: "Registered as its principal Sep 24, 2023 to Jan 31, 2025" },
};

async function noteClear(page: Page, n: number): Promise<void> {
  const want = NOTES[n];
  const notes = page.locator('[data-tour="graph"] [data-orbit-note]');
  if (!want) {
    if (n === ASK_GRAPH) await expect(notes).toHaveCount(0);
    return;
  }
  const note = page.locator(`[data-tour="graph"] [data-orbit-note="${want.id}"]`);
  await expect(note).toHaveText(want.text);
  // It fades in once the graph is at rest.
  await expect.poll(() => note.evaluate((el) => getComputedStyle(el).visibility === "visible" && Number(getComputedStyle(el).opacity) > 0.99)).toBe(true);
  const r = await page.evaluate((id) => {
    const box = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
    const el = box(`[data-orbit-note="${id}"]`)!;
    const g = box('[data-tour="graph"]')!;
    const chips = [...document.querySelectorAll("[data-orbit-chip]")].map((c) => c.getBoundingClientRect());
    const hit = (c: DOMRect) => c.width > 0 && el.left < c.right && el.right > c.left && el.top < c.bottom && el.bottom > c.top;
    const caption = document.querySelector("[data-tour-caption]")?.getBoundingClientRect();
    return {
      inside: el.left >= g.left && el.right <= g.right && el.top >= g.top && el.bottom <= g.bottom,
      covered: caption ? hit(caption) : false,
      chips: chips.filter(hit).length,
    };
  }, want.id);
  expect(r.inside, `step ${n} note inside the graph`).toBe(true);
  expect(r.covered, `step ${n} caption covers the note`).toBe(false);
  expect(r.chips, `step ${n} a date chip covers the note`).toBe(0);
}

/**
 * The steps after the firm's network (DOM only): every step stays on /explore, on the same graph.
 * Records in common: the verified counts in the chat, the shared bills at full strength, the
 * contacts on no shared bill dim. The member step: the Public statements block, never a source.
 */
const nodeState = (page: Page, id: string) => page.locator(`[data-tour="graph"] [data-graph-node][data-node-id="${id}"]`).getAttribute("data-state");
async function storyState(page: Page, n: number): Promise<void> {
  const turn = LAST_TURN[n];
  if (!turn) return;
  expect(new URL(page.url()).pathname, `step ${n} stays on Explore`).toBe("/explore");
  await expect(page.locator('[data-tour="graph"]'), `step ${n} one graph`).toHaveCount(1);
  const lastTurn = page.locator("[data-turn]").last();
  await expect(lastTurn, `step ${n} chat turn`).toHaveAttribute("data-turn", turn);
  if (n === RECORDS) {
    for (const phrase of [`Of the ${RIC.contacts} people`, `${RIC.cosponsors.length} are original cosponsors of S. 5025`, `${RIC.yes.length} voted yes on H.R. 5334`, "records in common"]) {
      await expect(lastTurn, `step ${n} chat says "${phrase}"`).toContainText(phrase);
    }
    expect([RIC.contacts, RIC.cosponsors.length, RIC.yes.length, RIC.no.length], "verified counts").toEqual([25, 5, 13, 6]);
    for (const id of ["s5025", "hr5334"]) expect(await nodeState(page, id), `step ${n} ${id} is a shared record`).toBe("full");
    for (const id of RIC_SENATORS) expect(await nodeState(page, id), `step ${n} ${id} on a shared bill`).toBe("full");
    for (const id of RIC_NONE) expect(await nodeState(page, id), `step ${n} ${id} on no shared bill`).toBe("dim");
  }
  if (n === SAME_DATE) expect(await nodeState(page, PEOPLE_STORY.wickerDayOthers[0]), `step ${n} Rep. Turner in focus`).toBe("full");
  if (n === STATEMENTS || n === SAVE_BUTTON) {
    expect(await nodeState(page, PEOPLE_STORY.member), `step ${n} member centered`).toBe("center");
    const block = page.locator('[data-tour="public-statements"]');
    await expect(block).toBeVisible();
    await expect(block).toContainText("Public statements");
    await expect(block).toContainText("Pulled from public sources");
    await expect(block).toContainText("Tone on Ukraine: supportive (2 of 2 statements)");
    await expect(block).toContainText("Sentiment is an AI reading of the statement text. It does not predict votes.");
    expect(await block.locator("[data-statement]").count(), "statements show").toBe(2);
    await expect(block.locator("[data-sentiment]").first()).toHaveText("Supports Ukraine");
    await expect(page.getByText("Linked by you")).toHaveCount(0);
    await expect(page.getByText("not part of the public record")).toHaveCount(0);
    // Never a source: the statements sit apart from the Sources chips.
    await expect(lastTurn.locator('[data-tour="sources"] [data-statement]')).toHaveCount(0);
  }
}

/** The Home ask step: Home, with the first question in the ask bar, unsent. */
async function askOnHome(page: Page): Promise<void> {
  expect(new URL(page.url()).pathname, "the ask step stays on Home").toBe("/");
  await expect(page.locator('[data-tour="ask-bar"] input')).toHaveValue(FIRST_QUESTION);
}

const checkpoints = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]").length as number, CHECKPOINTS);

function report(info: ReturnType<typeof test.info>, label: string, times: Record<number, number>) {
  const slow = Object.entries(times).filter(([, ms]) => ms > TARGET_MS);
  info.annotations.push({ type: label, description: Object.entries(times).map(([n, ms]) => `${n}: ${ms}ms`).join(", ") });
  if (slow.length) info.annotations.push({ type: `${label} above ${TARGET_MS}ms`, description: slow.map(([n, ms]) => `${n}: ${ms}ms`).join(", ") });
}

test("1. forward golden run", async ({ page }) => {
  const times: Record<number, number> = {};
  await page.goto("/?present=1");
  await ready(page, 1, 30_000);
  await shot(page, 1);
  for (let n = 2; n <= STEPS; n++) {
    times[n] = await press(page, "ArrowRight", n);
    expect(times[n], `step ${n} ready`).toBeLessThan(LIMIT_MS);
    await shot(page, n);
    if (EXPLORE_STEPS.includes(n)) await captionClear(page, n);
    await graphState(page, n);
    await windowState(page, n);
    await crowdedState(page, n);
    if (GRAPH_STEPS.includes(n)) await noteClear(page, n);
    await storyState(page, n);
    if (n === ASK_HOME) await askOnHome(page);
  }
  // The close: one full-screen slide, the progress line full.
  const slide = page.locator("[data-tour-slide]");
  await expect(slide.getByRole("heading", { name: "Thank You" })).toBeVisible();
  await expect(page.locator("[data-tour-caption]")).toHaveCount(0);
  // The slide follows the app theme: the page color and text color of the current theme.
  const theme = (test.info().project.metadata as { theme: string }).theme;
  expect(await html(page, "data-theme")).toBe(theme);
  const colors = await slide.evaluate((el) => ({
    slide: getComputedStyle(el).backgroundColor,
    page: getComputedStyle(document.body).backgroundColor,
    title: getComputedStyle(el.querySelector("h2")!).color,
    text: getComputedStyle(document.body).color,
  }));
  expect(colors.slide, "slide background equals the page color").toBe(colors.page);
  expect(colors.title, "slide title equals the page text color").toBe(colors.text);
  expect(colors.page).toBe(theme === "light" ? "rgb(238, 241, 243)" : "rgb(16, 20, 24)");
  report(test.info(), "→ key to caption", times);
  test.info().annotations.push({ type: "max curtain opaque", description: `${Math.round(await page.evaluate(() => (window as unknown as { __opaqueMax: number }).__opaqueMax))}ms` });
});

test("2. ← and deep links equal →", async ({ page }) => {
  test.setTimeout(600_000);
  const times: Record<number, number> = {};
  for (let n = 1; n < STEPS; n++) {
    await page.goto(`/?present=1&step=${n + 1}`);
    await ready(page, n + 1, 30_000);
    times[n] = await press(page, "ArrowLeft", n);
    expect(times[n], `← to step ${n}`).toBeLessThan(LIMIT_MS);
    await shot(page, n);
    await windowState(page, n);
    await page.goto(`/?present=1&step=${n}`);
    await ready(page, n, 30_000);
    await shot(page, n);
    await windowState(page, n);
  }
  report(test.info(), "← key to caption", times);
});

test("3. rapid presses end on the last step pressed", async ({ page }) => {
  await page.goto("/?present=1");
  await ready(page, 1, 30_000);
  let seed = 20261003;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const problems: string[] = [];
  const poll = setInterval(async () => {
    const r = await page
      .evaluate(() => ({
        text: (document.querySelector("main")?.textContent ?? "").trim().length,
        curtain: document.documentElement.hasAttribute("data-tour-curtain"),
        skeleton: !!document.querySelector("[data-skeleton]"),
      }))
      .catch(() => null);
    if (r && r.text < 20) problems.push("blank main");
    if (r && r.skeleton && !r.curtain) problems.push("skeleton after the curtain lifted");
  }, 100);
  let step = 1;
  for (let i = 0; i < 30; i++) {
    const fwd = rnd() < 0.6;
    await page.keyboard.press(fwd ? "ArrowRight" : "ArrowLeft");
    step = Math.max(1, Math.min(STEPS, step + (fwd ? 1 : -1)));
    await page.waitForTimeout(40 + rnd() * 80);
  }
  await ready(page, step);
  clearInterval(poll);
  expect(problems).toEqual([]);
  await shot(page, step);
});

test("4. Explore steps stay in place; pages mount as expected", async ({ page }) => {
  await page.goto("/?present=1");
  await ready(page, 1, 30_000);
  const url = () => new URL(page.url());
  for (let n = 2; n <= ASK_HOME; n++) await press(page, "ArrowRight", n);
  // The Ask step types the question into the Home ask bar and stops: it is in the field, not sent.
  await askOnHome(page);
  // Send opens Explore with the question as the user's message in the chat.
  await press(page, "ArrowRight", ASK_GRAPH);
  const atAsk = url().pathname + url().search;
  expect(atAsk.startsWith("/explore")).toBe(true);
  await expect(page.locator('[data-tour="explore-chat"]').getByText(FIRST_QUESTION, { exact: true })).toBeVisible();
  // One graph from the question through the deeper layers to the Save button: no page change, no reload.
  for (let n = BILL; n <= SAVE_BUTTON; n++) {
    await page.keyboard.press("ArrowRight");
    while ((await html(page, "data-tour-phase")) !== "ready" || (await html(page, "data-tour-step")) !== String(n)) {
      expect(url().pathname + url().search).toBe(atAsk);
      await page.waitForTimeout(50);
    }
  }
  for (let n = SAVE_BUTTON + 1; n <= STEPS; n++) {
    await press(page, "ArrowRight", n);
    expect(url().search).not.toContain("turn=");
  }
  const mounts = await page.evaluate(() => (window as unknown as { __mounts: Record<string, number> }).__mounts);
  // Explore once (no Search, no other page for the deeper layers); Home again for the saved checkpoint.
  expect(mounts).toEqual({ home: 2, explore: 1, search: 0 });
});

test("5. checkpoints: one per run, none before the save, the user's own come back", async ({ page }) => {
  await page.goto("/");
  const mine = JSON.stringify([{ id: "cp-user", title: "Mine", createdAt: "2026-09-01T10:00:00.000Z", central: "Ukraine", counts: { members: 1, bills: 0, orgs: 0, travels: 0 }, graph: { entityIds: [], edgeIds: [], expanded: [], positions: {} }, chat: [] }]);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [CHECKPOINTS, mine]);
  for (let run = 0; run < 2; run++) {
    // P works once the page has hydrated: press until presenter mode starts.
    await expect(async () => {
      await page.keyboard.press("p");
      await expect(page.locator("html")).toHaveAttribute("data-presenting", "", { timeout: 200 });
    }).toPass({ timeout: 15_000 });
    await ready(page, 1, 30_000);
    await press(page, "End", STEPS);
    expect(await checkpoints(page), `run ${run + 1}`).toBe(1);
    await press(page, "ArrowLeft", SAVE);
    expect(await checkpoints(page), "back on the save step").toBe(1);
    await press(page, "ArrowLeft", SAVE_BUTTON);
    expect(await checkpoints(page), "on the Save button step").toBe(0);
    expect(new URL(page.url()).pathname).toBe("/explore");
    await expect(page.getByRole("button", { name: "Save exploration" })).toHaveText("Save");
    // The public statements step comes before the save: no checkpoint yet.
    await press(page, "ArrowLeft", STATEMENTS);
    expect(await checkpoints(page), "on the public statements step").toBe(0);
    await press(page, "ArrowRight", SAVE_BUTTON);
    await press(page, "ArrowRight", SAVE);
    expect(await checkpoints(page), "after the save step").toBe(1);
    for (let n = SAVE + 1; n <= STEPS; n++) await press(page, "ArrowRight", n);
    expect(new URL(page.url()).pathname, "the close stays on Home").toBe("/");
    expect(await checkpoints(page), "on the last step").toBe(1);
    await page.keyboard.press("Escape");
    expect(await page.evaluate((k) => localStorage.getItem(k), CHECKPOINTS)).toBe(mine);
    await page.goto("/");
  }
});

test("6. Esc and X leave presenter mode; the app works after", async ({ page }) => {
  // A click on a node of the orbit graph plays its turn. Centered on Wicker, his Trips ring
  // label is a node; centered on the June 9 contact (the meeting step), the registrant is.
  const graphClickWorks = async (step: number) => {
    const [id, text] = step === MEETING ? ["moran", "You opened Moran Global Strategies, Inc."] : ["cat-trips", "You opened Trips"];
    await page.locator(`[data-tour="graph"] [data-node-id="${id}"] [data-node-label]`).click();
    await expect(page.locator('[data-tour="explore-chat"]').getByText(text)).toBeVisible();
  };
  for (const [step, how] of [[SENATOR, "Escape"], [STEPS, "X"], [MEETING, "X"], [STEPS, "Escape"]] as const) {
    await page.goto(`/?present=1&step=${step}`);
    await ready(page, step, 30_000);
    if (how === "X") await page.getByRole("button", { name: "Exit presenter mode" }).click();
    else await page.keyboard.press("Escape");
    await expect(page.locator("html")).not.toHaveAttribute("data-presenting");
    await expect(page.locator("html")).not.toHaveAttribute("data-tour-curtain");
    if (step === STEPS) {
      await page.goto("/explore?turn=wicker-profile");
      await page.locator('[data-tour="graph"] [data-node-id="cat-trips"] [data-node-label]').waitFor();
    }
    await graphClickWorks(step);
  }
});
