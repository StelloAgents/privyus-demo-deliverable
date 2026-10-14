import { prefersReducedMotion } from "@/lib/motion";

/** Resolves after `ms`, or at once when `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted || ms <= 0) return resolve();
    const done = () => {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const t = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}

/** Resolves after `n` animation frames. */
export function frames(n = 1): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });
}

/** Resolves when `p` settles or `signal` aborts, whichever comes first. */
export function untilAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T | undefined> {
  if (signal.aborted) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const onAbort = () => resolve(undefined);
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      () => {
        signal.removeEventListener("abort", onAbort);
        resolve(undefined);
      },
    );
  });
}

/**
 * Types `text` into a field through its setter, over `totalMs` (the text shown
 * follows the clock, however busy the page is). Reduced motion sets it at once.
 * Stops where it is when `signal` aborts.
 */
export async function typeInto(set: (text: string) => void, text: string, totalMs: number, signal?: AbortSignal): Promise<void> {
  if (prefersReducedMotion() || totalMs <= 0) {
    set(text);
    return;
  }
  const start = performance.now();
  for (;;) {
    if (signal?.aborted) return;
    const n = Math.min(text.length, Math.ceil(((performance.now() - start) / totalMs) * text.length));
    set(text.slice(0, n));
    if (n >= text.length) return;
    await sleep(30, signal);
  }
}
