/**
 * Presenter mode (PRESENTER-MODE.md): a keyboard tour over the live app.
 *
 * - Steps (src/data/tour.ts) declare their settled `end` state and a `play`
 *   function that performs the step's visible action through the feature
 *   controllers, honoring an AbortSignal.
 * - The app layer (src/features/presenter/state.ts) puts a state in place:
 *   synchronous and idempotent.
 * - The engine (engine.ts) runs one step at a time: `goTo(n)` aborts the step in
 *   progress, puts step n-1's end state in place when needed (behind the route
 *   curtain only when the page changes), then plays step n.
 *
 * For pages: emit "page-ready" (src/lib/events.ts) with the pathname once the
 * page has drawn; the curtain waits for it. `tourOwnsPage()` is true while a
 * tour runs or is about to start: a page then leaves its state to the tour.
 * `<html>` carries `data-presenting`, `data-tour-step` (1-based),
 * `data-tour-phase` ("running" | "ready"), and `data-tour-curtain="on"` while
 * the curtain is opaque.
 */
export { isTourActive, tourOwnsPage, useTourActive, useTourStore, type TourPhase, type TourState } from "./store";
export { changePage, exitTour, goToStep, nextStep, prevStep, setTourNavigator, spotlight, startTour, toggleNotes } from "./engine";
export { frames, sleep, typeInto, untilAbort } from "./timing";
export type { TourApp, TourStep } from "./types";
