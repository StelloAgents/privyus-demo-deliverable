"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { tourSteps } from "@/data/tour";
import { presenterApp } from "@/features/presenter/state";
import { exitTour, goToStep, nextStep, prevStep, setTourNavigator, startTour, toggleNotes, useTourStore } from "@/lib/tour";
import { Spotlight } from "./Spotlight";

function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/** Starts presenter mode with the demo steps (top bar "Present", the P key, `?present=1&step=<n>`). */
export function startPresenting(step = 0, hint = false): void {
  startTour(tourSteps, presenterApp, step, { hint });
}

/**
 * Presenter mode host: binds navigation, the keyboard, and the URL, and draws
 * the spotlight while presenting. Mounted once in the app shell.
 */
export function TourProvider() {
  const router = useRouter();
  const active = useTourStore((s) => s.active);

  useEffect(() => {
    setTourNavigator({ replace: (to) => router.replace(to, { scroll: false }), prefetch: (to) => router.prefetch(to) });
    return () => setTourNavigator(null);
  }, [router]);

  // `?present=1&step=<n>` (1-based) opens presenter mode at that step.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // `#present=<n>` (written while presenting): a reload reopens that step.
    const hash = window.location.hash.match(/^#present=(\d+)$/);
    if (q.get("present") !== "1" && !hash) return;
    const n = Number(hash ? hash[1] : (q.get("step") ?? "1"));
    startPresenting(Number.isFinite(n) ? n - 1 : 0);
  }, []);

  useEffect(() => {
    // A text field the presenter clicked into during the tour. Typing works
    // there; a field focused by a tour action never swallows the tour keys.
    let userField: EventTarget | null = null;
    const onPointer = (e: PointerEvent) => {
      userField = useTourStore.getState().active && typingIn(e.target) ? e.target : null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const { active: on } = useTourStore.getState();
      if (!on) {
        if ((e.key === "p" || e.key === "P") && !typingIn(e.target)) {
          e.preventDefault();
          startPresenting(0, true);
        }
        return;
      }
      // Keys only (a slide deck): clickers send PageUp/PageDown.
      const NEXT = ["ArrowRight", " ", "PageDown", "Enter"];
      const PREV = ["ArrowLeft", "PageUp", "Backspace"];
      const tourKey = [...NEXT, ...PREV, "Escape", "n", "N", "Home", "End"].includes(e.key);
      if (!tourKey) return;
      if (typingIn(e.target) && e.target === userField && e.key !== "Escape") {
        // The presenter clicked into a field and is typing: only an arrow or a
        // page key on an empty field drives the tour.
        const value = (e.target as HTMLInputElement).value ?? "";
        const nav = ["ArrowRight", "ArrowLeft", "PageUp", "PageDown"].includes(e.key);
        if (!(nav && value.length === 0)) return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (NEXT.includes(e.key)) nextStep();
      else if (PREV.includes(e.key)) prevStep();
      else if (e.key === "n" || e.key === "N") toggleNotes();
      else if (e.key === "Home") goToStep(0);
      else if (e.key === "End") goToStep(useTourStore.getState().steps.length - 1);
      else exitTour();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  return active ? <Spotlight /> : null;
}
