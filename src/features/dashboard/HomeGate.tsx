"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { useHome } from "./homeStore";
import styles from "./gate.module.css";

/** The longest the page waits before it reveals anyway. */
const SAFETY_MS = 2500;

/**
 * Holds the Home reveal until fonts are loaded and the globe drew its first frame
 * (or the safety timeout passes). It runs once per page load: theme and topic changes never re-gate.
 */
export function HomeGate() {
  const globeReady = useHome((s) => s.globeReady);
  const setReady = useHome((s) => s.setReady);

  useEffect(() => {
    if (useHome.getState().ready) return;
    const timer = window.setTimeout(setReady, SAFETY_MS);
    return () => window.clearTimeout(timer);
  }, [setReady]);

  useEffect(() => {
    if (!globeReady) return;
    let cancelled = false;
    const fonts = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
    void fonts.then(() => {
      // One more frame, so the globe frame and the fonts are on screen together.
      if (!cancelled) requestAnimationFrame(() => setReady());
    });
    return () => {
      cancelled = true;
    };
  }, [globeReady, setReady]);

  // Measure: navigation start to reveal, kept on window for the visual check.
  useEffect(
    () =>
      useHome.subscribe((s, prev) => {
        if (s.ready && !prev.ready) (window as unknown as { __homeRevealMs?: number }).__homeRevealMs = Math.round(performance.now());
      }),
    [],
  );
  return null;
}

type Shape = "radar" | "map" | "list";

const B = ({ className }: { className: string }) => <div className={cx(styles.block, className)} />;

/** Skeleton blocks in the shape of the panel's content. Sizes match, so nothing shifts. */
function Placeholder({ shape }: { shape: Shape }) {
  if (shape === "map") {
    return (
      <div className="relative h-full overflow-hidden" aria-hidden="true">
        {/* A soft rectangle where the map will be (neutral for the world and US views). */}
        <div className={cx(styles.block, "absolute inset-x-[6%] top-[4%] bottom-[14%] opacity-70")} />
        <div className={cx(styles.block, "absolute bottom-0 left-0 h-3.5 w-2/5")} />
      </div>
    );
  }
  if (shape === "radar") {
    return (
      <div className="flex h-full flex-col" aria-hidden="true">
        <div className="flex items-center justify-between">
          <B className="h-4 w-28" />
          <B className="h-7 w-40" />
        </div>
        <B className="mt-4 h-10 w-3/4" />
        <B className="mt-3 h-5 w-1/2" />
        <div className="mt-6 grid grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <B className="h-9 w-20" />
              <B className="h-3.5 w-24" />
              <B className="h-3 w-16" />
            </div>
          ))}
        </div>
        <B className="mt-6 min-h-0 flex-1" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 pt-1" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={cx(styles.block, styles.round, "h-10 w-10 shrink-0")} />
          <div className="flex flex-1 flex-col gap-2">
            <B className="h-3.5 w-2/3" />
            <B className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The reveal state machine for one block: "wait" (skeleton only), "fade" (skeleton out and
 * content in, together), "done" (content only). The skeleton unmounts only after its fade ends.
 */
function usePhase(): ["wait" | "fade" | "done", () => void] {
  const ready = useHome((s) => s.ready);
  // Home opened again (the page was already revealed once): no skeleton at all.
  const [faded, setFaded] = useState(() => useHome.getState().ready);
  return [!ready ? "wait" : faded ? "done" : "fade", () => setFaded(true)];
}

/** The map panel's skeleton: a soft rectangle under the header (the same for both map views). */
export function MapSkeleton() {
  const [phase, fadeEnd] = usePhase();
  const end = () => {
    fadeEnd();
    useHome.setState({ revealed: true });
  };
  // Home opened again after the page revealed once (also when it left mid-fade): no skeleton, revealed.
  useEffect(() => {
    if (phase === "done" && !useHome.getState().revealed) useHome.setState({ revealed: true });
  }, [phase]);
  if (phase === "done") return null;
  return (
    <div
      data-skeleton=""
      className={cx("pointer-events-none absolute inset-0 z-[1] px-6 pt-20 pb-6", phase === "fade" && styles.skeletonOut)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) end();
      }}
    >
      <Placeholder shape="map" />
    </div>
  );
}

/**
 * Wraps a panel's content. Before the reveal the content is built but invisible (so the
 * globe and lists are ready) and the skeleton holds its place; then they cross-fade.
 */
export function Reveal({ shape, className, children }: { shape: Shape; className?: string; children: ReactNode }) {
  const [phase, end] = usePhase();
  return (
    <div className={cx("relative", className)}>
      {phase !== "done" ? (
        <div
          data-skeleton=""
          className={cx("pointer-events-none absolute inset-0 z-[1]", phase === "fade" && styles.skeletonOut)}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) end();
          }}
        >
          <Placeholder shape={shape} />
        </div>
      ) : null}
      <div className={cx("h-full", phase === "wait" ? styles.content : styles.revealed)} aria-busy={phase === "wait"}>
        {children}
      </div>
    </div>
  );
}
