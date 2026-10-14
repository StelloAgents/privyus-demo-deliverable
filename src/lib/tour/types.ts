/**
 * One presenter step. `S` is the app's step state (src/features/presenter/state.ts).
 */
export interface TourStep<S = unknown> {
  id: string;
  /** `data-tour` ids to spotlight (one cutout per id). */
  targets: string[];
  /**
   * The settled state at the end of this step, as the forward run leaves it.
   * The next step plays from it: ← (or a jump) to step n+1 puts step n's `end`
   * in place at once, then plays step n+1.
   */
  end: S;
  /**
   * The step's visible action, from the end state of the step before. Resolve
   * when its visible result is in place. On abort, stop at once (the next state
   * overwrites whatever is left).
   */
  play: (signal: AbortSignal) => Promise<void>;
  title: string;
  body: string;
  notes: string;
  /**
   * A full-screen closing slide (title, body, and the logo on a near-solid layer)
   * instead of a spotlight and a caption. The only text slide in the tour.
   */
  slide?: boolean;
}

/** How the engine puts a step state in place. */
export interface TourApp<S> {
  /** The state before step 1 (a clean demo). */
  clean: S;
  /** The route of a state (a pathname, maybe with a query). */
  route: (state: S) => string;
  /** Puts the state in place at once, synchronously and idempotently. Does not navigate. */
  apply: (state: S) => void;
  /** Leaving presenter mode: give the user's own data back. */
  exit: () => void;
  /** Starting presenter mode: keep the user's own data aside. */
  start: () => void;
}
