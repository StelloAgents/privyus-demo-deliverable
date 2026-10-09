/**
 * Graph positions are a function of graph content only.
 *
 *   npx tsx scripts/check-layout.ts      (npm run check:layout)
 *
 * For every scripted turn, the positions after streaming the story up to that
 * turn (each step applied on its own timer, as on screen) must equal the
 * positions after `gotoStoryState(turn)` (all steps applied at once). The same
 * holds for the presenter story path (`replayStory`) against the clicks and
 * questions that play it forward. Exits 1 on any difference.
 */
import { prepareTurn, gotoStoryState, replayStory, resetExploration, ask, clickNode, type StoryEntry } from "../src/features/explore/controller";
import { ROOT_ID, catalog, storyTurns } from "../src/features/explore/catalog";
import { playTurn } from "../src/lib/script-engine";
import { configureGraphLayout, useDemoStore, type GraphLayoutKind } from "../src/lib/store";
import { TOUR_STORY } from "../src/data/tour-story";
import { clearLayoutCache as clearForceCache } from "../src/components/graph/graph-layout";
import { clearOrbitLayoutCache } from "../src/components/graph/orbit-layout";

function clearLayoutCache() {
  clearForceCache();
  clearOrbitLayoutCache();
}

// Steps play on timers; scale them down so the check runs in a few seconds. The
// order of the timers (all that matters for the layout) does not change.
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void, ms?: number) => realSetTimeout(fn, Math.ceil((ms ?? 0) / 100))) as typeof setTimeout;

type Positions = Record<string, { x: number; y: number }>;
const positions = (): Positions => ({ ...useDemoStore.getState().graph.positions });

function diff(a: Positions, b: Positions): string[] {
  const out: string[] = [];
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const p = a[id];
    const q = b[id];
    if (!p || !q) out.push(`${id}: ${p ? "only forward" : "only replay"}`);
    else if (p.x !== q.x || p.y !== q.y) out.push(`${id}: forward ${p.x},${p.y} replay ${q.x},${q.y}`);
  }
  return out;
}

let failures = 0;
function compare(label: string, forward: Positions, replay: Positions, focusF?: string, focusR?: string) {
  const d = diff(forward, replay);
  if (focusF !== focusR) d.push(`focus: forward ${focusF} replay ${focusR}`);
  const n = Object.keys(forward).length;
  if (d.length) {
    failures++;
    console.log(`FAIL ${label} (${n} nodes): ${d.slice(0, 6).join("; ")}${d.length > 6 ? ` (+${d.length - 6})` : ""}`);
  } else console.log(`ok   ${label} (${n} nodes)`);
}

async function run(kind: GraphLayoutKind) {
  configureGraphLayout(catalog, ROOT_ID, kind);
  console.log(`\n${kind === "orbit" ? "Orbit layout (Explore default)" : "Force layout (?graph=2d)"}`);
  // 1. Every scripted turn: the story order streamed, against the deep link.
  for (let k = 0; k < storyTurns.length; k++) {
    clearLayoutCache();
    resetExploration();
    for (let i = 0; i <= k; i++) {
      const h = playTurn(prepareTurn(storyTurns[i]), { stepsTotalMs: 2400 });
      await h.graphBuilt;
      h.finish();
    }
    const fwd = positions();
    const fFocus = useDemoStore.getState().graph.focusId;
    clearLayoutCache();
    const t0 = performance.now();
    gotoStoryState(storyTurns[k].id);
    const ms = performance.now() - t0;
    compare(`turn ${storyTurns[k].id} [replay ${ms.toFixed(0)}ms]`, fwd, positions(), fFocus, useDemoStore.getState().graph.focusId);
  }

  // 2. The presenter story: the clicks and questions of steps 8 to 13, against replayStory.
  for (let k = 1; k <= TOUR_STORY.length; k++) {
    clearLayoutCache();
    resetExploration();
    const path: (StoryEntry & { click?: string })[] = TOUR_STORY.slice(0, k);
    for (const e of path) {
      const h = e.question !== undefined ? ask(e.question) : clickNode(e.click!);
      if (!h) throw new Error(`no turn for ${JSON.stringify(e)}`);
      await h.graphBuilt;
      h.finish();
    }
    const fwd = positions();
    const fFocus = useDemoStore.getState().graph.focusId;
    clearLayoutCache();
    const t0 = performance.now();
    replayStory(path);
    const ms = performance.now() - t0;
    compare(`story ${path.map((p) => p.turnId).join(" > ")} [replay ${ms.toFixed(0)}ms]`, fwd, positions(), fFocus, useDemoStore.getState().graph.focusId);
  }
}

async function main() {
  await run("orbit");
  await run("force");
  if (failures) {
    console.log(`\n${failures} difference(s): graph positions depend on history.`);
    process.exit(1);
  }
  console.log("\nGraph positions match: forward streaming equals the replayed state for every turn.");
  process.exit(0);
}

void main();
