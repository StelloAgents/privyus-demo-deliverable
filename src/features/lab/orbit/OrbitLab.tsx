"use client";

import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { FOCUS_ID, PATH_NODES, nodeById } from "./data";
import { timeStore } from "./time";
import { Timeline } from "./Timeline";

const OrbitScene = dynamic(() => import("./OrbitScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-bg" aria-hidden="true" />,
});

declare global {
  interface Window {
    __orbitLab?: { focus: (id: string) => void; time: typeof timeStore };
  }
}

/** Orbit + Chronos: ring = relationship type, angle = date, and a timeline to replay the records. */
export function OrbitLab() {
  const [focus, setFocus] = useState(FOCUS_ID);
  const [hover, setHover] = useState<string | null>(null);
  const onFocus = useCallback((id: string) => {
    setHover(null);
    setFocus(id);
  }, []);

  useEffect(() => {
    window.__orbitLab = { focus: onFocus, time: timeStore };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFocus(FOCUS_ID);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      delete window.__orbitLab;
    };
  }, [onFocus]);

  const node = nodeById.get(focus)!;
  const chain = PATH_NODES.map((id) => nodeById.get(id)!.label);

  return (
    <div className="flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-panel border border-line bg-bg">
      <div className="relative min-h-0 flex-1">
        <OrbitScene focus={focus} hover={hover} onFocus={onFocus} onHover={setHover} />

        {/* Header: what is centered, and how to read the rings */}
        <div className="pointer-events-none absolute top-5 left-6 flex flex-col gap-1">
          <p className="text-[12px] leading-4 font-medium text-fg-3">Centered on</p>
          <h1 className="font-display text-[20px] leading-[26px] font-semibold tracking-[-0.005em] text-fg-1">{node.label}</h1>
          <p className="text-[12px] leading-4 text-fg-3">{node.sub}</p>
          {focus !== FOCUS_ID && (
            <button
              type="button"
              onClick={() => onFocus(FOCUS_ID)}
              className="pointer-events-auto mt-2 flex h-7 w-fit items-center gap-1.5 rounded-button border border-line bg-surface-1 px-2.5 text-[12px] font-medium text-fg-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1"
            >
              <RotateCcw size={13} strokeWidth={1.75} />
              Back to Sen. Ellen Hartley
            </button>
          )}
        </div>
        <div className="pointer-events-none absolute top-5 right-6 flex w-[260px] flex-col gap-2 text-right">
          <p className="text-[12px] leading-4 text-fg-3">
            <span className="text-fg-2">Ring</span> is the relationship. <span className="text-fg-2">Angle</span> is the date, clockwise from Jan 2025.
          </p>
          <p className="flex items-start justify-end gap-2 text-[12px] leading-4 text-fg-3">
            <span className="mt-[7px] h-[2px] w-4 shrink-0 bg-orange" />
            <span>{chain.join(" → ")}</span>
          </p>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-6 text-[11px] leading-4 text-fg-3">
          Drag to orbit · Right-drag to pan · Scroll to zoom · Click a node to center it · Esc to return
        </p>
      </div>
      <Timeline />
    </div>
  );
}
