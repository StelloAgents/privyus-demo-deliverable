import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Presenter mode (PRESENTER-MODE.md). Every step's ready screen is a baseline
 * ("step-n"); → , ←, deep links, and rapid presses must all reach the same one.
 * Timings: key press to caption (data-tour-phase="ready"). The spec limit is 5s;
 * steps above the 3s target are listed in the report annotations.
 */
const STEPS = 18;
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
 * Explore steps (8 to 15): the caption never covers the Exploration Chat panel,
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
const GRAPH_STATE: Record<number, { focus: string; labels: string[]; path: string[] }> = {
  9: { focus: "ukraine", labels: ["ukraine", "s456", "hr123"], path: [] },
  10: { focus: "s456", labels: ["s456", "hartley", "marquez", "bellamy", "okafor", "whitcomb", "sato", "price", "ukraine"], path: ["ukraine", "s456"] },
  11: {
    focus: "hartley",
    labels: ["hartley", "s456", "cat-votes", "cat-trips", "cat-meetings", "cat-contributions", "cat-opinions", "cat-others"],
    path: ["ukraine", "s456", "hartley"],
  },
  12: { focus: "meeting-private", labels: ["meeting-private", "attendee-meridian", "attendee-aegis", "attendee-atlantic", "hartley", "aegis"], path: ["hartley", "meeting-private"] },
  13: { focus: "meeting-private", labels: ["meeting-private", "attendee-meridian", "attendee-aegis", "attendee-atlantic", "hartley"], path: ["hartley", "meeting-private"] },
  14: { focus: "cat-contributions", labels: ["hartley", "cat-contributions", "aegis", "boreal", "redwood"], path: ["hartley", "aegis", "boreal", "redwood"] },
  15: { focus: "cat-contributions", labels: ["hartley", "cat-contributions", "aegis", "boreal", "redwood"], path: ["hartley", "aegis", "boreal", "redwood"] },
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
  expect(got.path, `step ${n} orange chain`).toEqual([...want.path].sort());
}

/**
 * The note each Explore step shows on the graph (src/data/graph-notes.ts), with
 * its text: it is visible, inside the graph, and the caption never covers it.
 * Steps not listed show no note.
 */
const NOTES: Record<number, { id: string; text: string }> = {
  10: { id: "cosponsor-span", text: "Cosponsors joined between March and June 2025" },
  11: { id: "busiest-stretch", text: "8 of 23 records fall between April and June 2026" },
  12: { id: "aegis-link", text: "Aegis Systems also appears in her contributions" },
  14: { id: "contribution-vote-meeting", text: "Contribution, vote, and meeting within 10 weeks" },
  15: { id: "contribution-vote-meeting", text: "Contribution, vote, and meeting within 10 weeks" },
};

async function noteClear(page: Page, n: number): Promise<void> {
  const want = NOTES[n];
  const notes = page.locator('[data-tour="graph"] [data-orbit-note]');
  if (!want) {
    if (n === 9) await expect(notes).toHaveCount(0);
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
  if (n === 14 || n === 15) {
    await expect(page.locator('[data-tour="graph"] [data-orbit-chip]')).toHaveText(["Apr 8, 2026", "S. 456 vote · May 21, 2026", "Private meeting · Jun 17, 2026"]);
  }
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
    if (n >= 8 && n <= 15) await captionClear(page, n);
    await graphState(page, n);
    if (n >= 9 && n <= 15) await noteClear(page, n);
  }
  // The close: one full-screen slide, the progress line full.
  const slide = page.locator("[data-tour-slide]");
  await expect(slide.getByRole("heading", { name: "Thank You" })).toBeVisible();
  await expect(page.locator("[data-tour-caption]")).toHaveCount(0);
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
    await page.goto(`/?present=1&step=${n}`);
    await ready(page, n, 30_000);
    await shot(page, n);
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
  for (let n = 2; n <= 8; n++) await press(page, "ArrowRight", n);
  const url = () => new URL(page.url());
  const at8 = url().pathname + url().search;
  expect(at8.startsWith("/explore")).toBe(true);
  // Step 8 types the question and stops: it is in the field, not sent.
  const field = page.locator('[data-tour="explore-chat"] textarea');
  await expect(field).toHaveValue("What is the United States' stance on Ukraine?");
  await expect(page.locator('[data-tour="explore-chat"]').getByText("Set root node")).toHaveCount(0);
  for (let n = 9; n <= 15; n++) {
    await page.keyboard.press("ArrowRight");
    while ((await html(page, "data-tour-phase")) !== "ready" || (await html(page, "data-tour-step")) !== String(n)) {
      expect(url().pathname + url().search).toBe(at8);
      await page.waitForTimeout(50);
    }
  }
  for (let n = 16; n <= STEPS; n++) {
    await press(page, "ArrowRight", n);
    expect(url().search).not.toContain("turn=");
  }
  const mounts = await page.evaluate(() => (window as unknown as { __mounts: Record<string, number> }).__mounts);
  expect(mounts).toEqual({ home: 2, explore: 1, search: 1 });
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
    await press(page, "ArrowLeft", 17);
    await press(page, "ArrowLeft", 16);
    expect(await checkpoints(page), "back on the save step").toBe(1);
    await press(page, "ArrowLeft", 15);
    expect(await checkpoints(page), "on the Save button step").toBe(0);
    expect(new URL(page.url()).pathname).toBe("/explore");
    await expect(page.getByRole("button", { name: "Save exploration" })).toHaveText("Save");
    await press(page, "ArrowRight", 16);
    expect(await checkpoints(page), "after the save step").toBe(1);
    await press(page, "ArrowRight", 17);
    await press(page, "ArrowRight", STEPS);
    expect(await checkpoints(page), "on the last step").toBe(1);
    await page.keyboard.press("Escape");
    expect(await page.evaluate((k) => localStorage.getItem(k), CHECKPOINTS)).toBe(mine);
    await page.goto("/");
  }
});

test("6. Esc and X leave presenter mode; the app works after", async ({ page }) => {
  // A click on a node of the orbit graph plays its turn. Centered on Hartley, her Trips ring
  // label is a node; centered on the private meeting (step 12), an attendee is.
  const graphClickWorks = async (step: number) => {
    const [id, text] = step === 12 ? ["attendee-meridian", "You opened Clara Voss"] : ["cat-trips", "You opened Trips"];
    await page.locator(`[data-tour="graph"] [data-node-id="${id}"] [data-node-label]`).click();
    await expect(page.locator('[data-tour="explore-chat"]').getByText(text)).toBeVisible();
  };
  for (const [step, how] of [[11, "Escape"], [STEPS, "X"], [12, "X"], [STEPS, "Escape"]] as const) {
    await page.goto(`/?present=1&step=${step}`);
    await ready(page, step, 30_000);
    if (how === "X") await page.getByRole("button", { name: "Exit presenter mode" }).click();
    else await page.keyboard.press("Escape");
    await expect(page.locator("html")).not.toHaveAttribute("data-presenting");
    await expect(page.locator("html")).not.toHaveAttribute("data-tour-curtain");
    if (step === STEPS) {
      await page.goto("/explore?turn=hartley-profile");
      await page.locator('[data-tour="graph"] [data-node-id="cat-trips"] [data-node-label]').waitFor();
    }
    await graphClickWorks(step);
  }
});
