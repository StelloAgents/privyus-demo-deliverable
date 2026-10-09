/**
 * Page events: a feature says that something visible has finished ("page-ready"
 * with its pathname, "search-results" with its query, "toast-shown", "arc-drawn").
 * A waiter registers before it starts the work, so it never misses the event.
 */
type Listener = (detail?: string) => void;
const listeners = new Map<string, Set<Listener>>();

export function emit(name: string, detail?: string): void {
  listeners.get(name)?.forEach((fn) => fn(detail));
}

export function onEvent(name: string, fn: Listener): () => void {
  const set = listeners.get(name) ?? new Set<Listener>();
  listeners.set(name, set);
  set.add(fn);
  return () => set.delete(fn);
}

/**
 * Resolves true on the next `name` event (whose detail passes `match`), or false
 * on timeout or abort. Never rejects.
 */
export function nextEvent(
  name: string,
  opts: { match?: (detail?: string) => boolean; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    if (opts.signal?.aborted) return resolve(false);
    let off = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (ok: boolean) => {
      off();
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      resolve(ok);
    };
    const onAbort = () => done(false);
    off = onEvent(name, (d) => {
      if (!opts.match || opts.match(d)) done(true);
    });
    if (opts.timeoutMs !== undefined) timer = setTimeout(() => done(false), opts.timeoutMs);
    opts.signal?.addEventListener("abort", onAbort, { once: true });
  });
}
