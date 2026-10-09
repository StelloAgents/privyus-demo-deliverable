"use client";

import { X } from "lucide-react";
import { animate, motion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { EASE_OUT_EXPO, EASE_OUT_EXPO_ARRAY, useReducedMotion } from "@/lib/motion";
import { exitTour, useTourStore } from "@/lib/tour";
import { LOGO_DARK, LOGO_LIGHT } from "./logo-data";
import { CARD_W, measureTarget, notchFor, placeCaption, sameRects, type Hole, type Placement, type Rect } from "./spotlight-geometry";

/** The cutout's glide to new targets. */
const GLIDE_S = 0.3;
const HINT_MS = 2000;

/**
 * The cutouts around the current targets. Measured when the step, its phase,
 * the curtain, or the in-step targets change; when a target resizes; when the
 * window resizes; and when an animation on a target ends (an entrance that
 * moved it). No per-frame polling.
 */
function useHoles(targets: string, keys: unknown[]): Hole[] {
  const [holes, setHoles] = useState<Hole[]>([]);
  useEffect(() => {
    const ids = targets ? targets.split("|") : [];
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = ids.map(measureTarget).filter((r): r is Hole => !!r);
        setHoles((prev) => (sameRects(prev, next) ? prev : next));
      });
    };
    const selector = ids.map((id) => `[data-tour="${CSS.escape(id)}"]`).join(",");
    const ro = new ResizeObserver(measure);
    if (selector) document.querySelectorAll(selector).forEach((el) => ro.observe(el));
    const onAnimEnd = (e: Event) => {
      const t = e.target as Element | null;
      if (selector && t instanceof Element && (t.closest(selector) || t.querySelector(selector))) measure();
    };
    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("animationend", onAnimEnd, true);
    document.addEventListener("transitionend", onAnimEnd, true);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("animationend", onAnimEnd, true);
      document.removeEventListener("transitionend", onAnimEnd, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, ...keys]);
  return holes;
}

/** The cutouts as drawn: they glide to new targets (cut with reduced motion or under the curtain). */
function useGlide(target: Rect[], cut: boolean): Rect[] {
  const [shown, setShown] = useState<Rect[]>(target);
  const fromRef = useRef<Rect[]>(target);
  useEffect(() => {
    const from = fromRef.current;
    if (cut || from.length !== target.length || target.length === 0) {
      fromRef.current = target;
      const t = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(t);
    }
    const controls = animate(0, 1, {
      duration: GLIDE_S,
      ease: EASE_OUT_EXPO_ARRAY as unknown as [number, number, number, number],
      onUpdate: (k) => {
        const cur = target.map((r, i) => ({
          x: from[i].x + (r.x - from[i].x) * k,
          y: from[i].y + (r.y - from[i].y) * k,
          w: from[i].w + (r.w - from[i].w) * k,
          h: from[i].h + (r.h - from[i].h) * k,
        }));
        fromRef.current = cur;
        setShown(cur);
      },
    });
    return () => controls.stop();
  }, [target, cut]);
  return shown;
}

/** Notch size (px): how far the pointer stands out from the caption edge. */
const NOTCH = 7;

/**
 * The caption's pointer toward the cutout: a small triangle outside the edge.
 * On the left edge it takes the accent color (it continues the teal edge).
 */
function Notch({ side, at }: { side: "left" | "right" | "top" | "bottom"; at: number }) {
  const fill = side === "left" ? "var(--tour-caption-accent)" : "var(--tour-caption-bg)";
  const t = `${NOTCH}px solid transparent`;
  const f = `${NOTCH}px solid ${fill}`;
  const style: CSSProperties =
    side === "left"
      ? { left: -NOTCH - 3, top: at - NOTCH, borderTop: t, borderBottom: t, borderRight: f }
      : side === "right"
        ? { right: -NOTCH, top: at - NOTCH, borderTop: t, borderBottom: t, borderLeft: f }
        : side === "top"
          ? { top: -NOTCH, left: at - NOTCH - 3, borderLeft: t, borderRight: t, borderBottom: f }
          : { bottom: -NOTCH, left: at - NOTCH - 3, borderLeft: t, borderRight: t, borderTop: f };
  return <span aria-hidden="true" data-tour-notch={side} className="absolute h-0 w-0" style={style} />;
}

/** Presenter mode overlay: the route curtain, the dim layer with cutouts, the caption, the progress line, the hint, and the speaker notes. */
export function Spotlight() {
  const steps = useTourStore((s) => s.steps);
  const index = useTourStore((s) => s.index);
  const phase = useTourStore((s) => s.phase);
  const notes = useTourStore((s) => s.notes);
  const curtain = useTourStore((s) => s.curtain);
  const spot = useTourStore((s) => s.spot);
  const hintPending = useTourStore((s) => s.hintPending);
  const hintUntil = useTourStore((s) => s.hintUntil);
  const step = steps[index];
  const reduced = useReducedMotion();
  const maskId = useId().replace(/:/g, "");
  const targets = (spot ?? step?.targets ?? []).join("|");
  const holes = useHoles(targets, [index, phase, curtain]);
  const shown = useGlide(holes, reduced || curtain);
  const ready = phase === "ready";

  // The caption: placed once when its step is ready, then it fades in. It is placed again only when
  // the window resizes or a cutout moves (sub-pixel re-measures do not move it).
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<(Placement & { index: number; h: number }) | null>(null);
  const placedFor = useRef<{ index: number; W: number; H: number; holes: Rect[] } | null>(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !ready || steps[index]?.slide) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const prev = placedFor.current;
    if (prev && prev.index === index && prev.W === W && prev.H === H && sameRects(prev.holes, holes, 2)) return;
    const heightAt = (w: number) => {
      el.style.width = `${w}px`;
      return el.offsetHeight;
    };
    const pos = placeCaption(holes, heightAt);
    const h = heightAt(pos.w);
    placedFor.current = { index, W, H, holes };
    setCard((old) =>
      old && old.index === index && old.w === pos.w && Math.abs(old.x - pos.x) < 1 && Math.abs(old.y - pos.y) < 1 && Math.abs(old.h - h) < 1 ? old : { ...pos, index, h },
    );
  }, [ready, holes, index, steps]);
  const placed = ready && card?.index === index;
  // Beside a small target, a notch points from the caption to the cutout.
  const notch = placed && !card!.docked ? notchFor(card!, holes) : null;

  // The start hint: once per presenter session, on step 1, for 2s from the moment its caption shows.
  useEffect(() => {
    if (hintPending && placed && index === 0) useTourStore.setState({ hintPending: false, hintUntil: performance.now() + HINT_MS });
  }, [hintPending, placed, index]);
  const [, rerender] = useState(0);
  useEffect(() => {
    const left = hintUntil - performance.now();
    if (left <= 0) return;
    const t = setTimeout(() => rerender((n) => n + 1), left);
    return () => clearTimeout(t);
  }, [hintUntil]);
  // eslint-disable-next-line react-hooks/purity
  const hint = index === 0 && hintUntil > performance.now();

  if (!step) return null;
  const total = steps.length;

  return (
    <>
      {/* Route curtain: the page area (between the top bar and the footer) fades to the page color while
          the next page loads, and fades back once it has fully drawn. It sits under the dim layer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 z-[79] bg-bg"
        style={{
          top: "calc(var(--topbar-height) + 16px)",
          bottom: "var(--footer-height)",
          opacity: curtain ? 1 : 0,
          transition: reduced ? undefined : `opacity ${curtain ? 180 : 240}ms ease`,
        }}
      />

      {/* Dim layer with rounded cutouts. It does not catch clicks: the presenter can use the live product. */}
      <svg className="pointer-events-none fixed inset-0 z-[80] h-full w-full" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {shown.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={4} ry={4} fill="black" />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="var(--tour-dim)" mask={`url(#${maskId})`} />
      </svg>

      {/* The closing slide: the one text slide of the tour, on a near-solid layer in the caption's
          inverted surface. The disclaimer footer and the progress line stay visible. */}
      {step.slide ? <ClosingSlide title={step.title} body={step.body} index={index} total={total} reduced={reduced} /> : null}

      {/* Caption: presenter guidance next to the spotlight. An inverted surface (the other theme's
          tokens) with a teal edge, so it never reads as another app card. */}
      {step.slide ? null : (
      <motion.div
        ref={cardRef}
        key={`cap-${index}-${placed ? "shown" : "wait"}`}
        role="region"
        aria-live="polite"
        aria-label={`Step ${index + 1} of ${total}: ${step.title}`}
        data-tour-caption={placed ? (card!.docked ? "docked" : "beside") : undefined}
        className="pointer-events-none fixed z-[81] flex flex-col gap-2.5 rounded-overlay py-5 pr-6 pl-[21px]"
        style={{
          width: card?.w ?? CARD_W,
          left: placed ? card!.x : -9999,
          top: placed ? card!.y : -9999,
          visibility: placed ? "visible" : "hidden",
          transition: reduced ? undefined : `left 200ms ${EASE_OUT_EXPO}, top 200ms ${EASE_OUT_EXPO}`,
          background: "var(--tour-caption-bg)",
          borderLeft: "3px solid var(--tour-caption-accent)",
          boxShadow: "var(--tour-caption-shadow)",
        }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
      >
        {notch ? <Notch side={notch.side} at={notch.at} /> : null}
        <h2 className="font-display text-[22px] leading-[28px] font-semibold" style={{ color: "var(--tour-caption-title)" }}>
          {step.title}
        </h2>
        <p className="max-w-[44ch] text-[16px] leading-[24px]" style={{ color: "var(--tour-caption-text)" }}>
          {step.body}
        </p>
      </motion.div>
      )}

      {/* The only on-screen control: leave presenter mode (same as Esc). Above every layer. */}
      <button
        type="button"
        aria-label="Exit presenter mode"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.currentTarget.blur();
          exitTour();
        }}
        className="fixed top-1 right-1 z-[85] flex h-7 w-7 items-center justify-center rounded-chip bg-[var(--tour-caption-bg)] text-[var(--tour-caption-text)] shadow-[var(--tour-caption-shadow)] transition-colors duration-[120ms] hover:text-[var(--tour-caption-title)]"
      >
        <X size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {/* Progress: a thin line above the disclaimer footer, filled by step. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 z-[83] h-0.5"
        style={{
          bottom: "var(--footer-height)",
          // On the closing slide (the inverted surface) the line takes the caption's colors.
          background: step.slide ? "color-mix(in srgb, var(--tour-caption-text) 30%, transparent)" : "color-mix(in srgb, var(--text-3) 35%, transparent)",
        }}
      >
        <div
          className="h-full"
          style={{
            background: step.slide ? "var(--tour-caption-title)" : "var(--text-1)",
            width: `${((index + 1) / total) * 100}%`,
            transition: reduced ? undefined : `width 300ms ${EASE_OUT_EXPO}`,
          }}
        />
      </div>

      <div
        aria-hidden="true"
        className="t-meta pointer-events-none fixed left-1/2 z-[83] -translate-x-1/2 rounded-overlay px-3 py-1.5"
        style={{
          background: "var(--tour-caption-bg)",
          color: "var(--tour-caption-text)",
          borderLeft: "3px solid var(--tour-caption-accent)",
          boxShadow: "var(--tour-caption-shadow)",
          bottom: "calc(var(--footer-height) + 16px)",
          opacity: hint ? 1 : 0,
          transition: reduced ? undefined : "opacity 400ms ease",
        }}
      >
        ← → to navigate · Esc to exit
      </div>

      {notes ? (
        <aside
          aria-label="Speaker notes"
          className="fixed bottom-14 left-1/2 z-[82] flex w-[min(760px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-1.5 rounded-overlay border border-line-strong bg-surface-2 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="t-meta">Speaker notes · step {index + 1} of {total}</span>
            <span className="t-meta">N to hide</span>
          </div>
          <p className="text-[14px] leading-[20px] text-fg-1">{step.notes}</p>
        </aside>
      ) : null}
    </>
  );
}

/** The closing slide: the logo, the title, and one line, centered over the whole page area. */
function ClosingSlide({ title, body, index, total, reduced }: { title: string; body: string; index: number; total: number; reduced: boolean }) {
  return (
    <motion.div
      key={`slide-${index}`}
      role="region"
      aria-live="polite"
      aria-label={`Step ${index + 1} of ${total}: ${title}`}
      data-tour-slide=""
      className="pointer-events-none fixed inset-x-0 top-0 z-[82] flex flex-col items-center justify-center gap-5 text-center"
      style={{ bottom: "var(--footer-height)", background: "var(--tour-caption-bg)" }}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.24, ease: "easeOut" }}
    >
      {/* The surface is inverted, so the logo is the other theme's. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_LIGHT.src} alt="Privyus" width={LOGO_LIGHT.width} height={LOGO_LIGHT.height} decoding="sync" className="theme-dark-only h-[34px] w-auto" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_DARK.src} alt="Privyus" width={LOGO_DARK.width} height={LOGO_DARK.height} decoding="sync" className="theme-light-only h-[34px] w-auto" />
      <h2 className="mt-3 font-display text-[44px] leading-[52px] font-semibold" style={{ color: "var(--tour-caption-title)" }}>
        {title}
      </h2>
      {body ? (
        <p className="text-[18px] leading-[28px]" style={{ color: "var(--tour-caption-text)" }}>
          {body}
        </p>
      ) : null}
    </motion.div>
  );
}
