"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import type { Palette } from "./ChronosScene";
import { NODES } from "./data";
import { useChronos } from "./store";
import { Timeline } from "./Timeline";
import "./chronos.css";

const loadScene = () => import("./ChronosScene");
const ChronosScene = dynamic(loadScene, { ssr: false, loading: () => null });

const RECORDS = NODES.filter((n) => n.kind !== "context" && n.date).length;

/** Graph Lab, direction "Chronos": the Hartley neighborhood standing on the US map, driven by a timeline. */
export function ChronosLab() {
  const [palette, setPalette] = useState<Palette | null>(null);
  const [reduced] = useState(() => prefersReducedMotion());
  const depth = useChronos((s) => s.depth);
  const setDepth = useChronos((s) => s.setDepth);
  const reset = useChronos((s) => s.reset);

  useEffect(() => {
    void loadScene().then((m) => setPalette(m.readPalette()));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useChronos.getState().reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="chronos-root">
      <div className="chronos-stage">
        {palette && <ChronosScene palette={palette} reduced={reduced} />}

        <header className="chronos-head">
          <h1 className="chronos-title">Sen. Ellen Hartley</h1>
          <p className="chronos-lede">
            {RECORDS} records, Jan 2025 to Sep 2026, placed where they happened
          </p>
        </header>

        <div className="chronos-controls">
          <div className="chronos-seg" role="group" aria-label="Height">
            <button type="button" aria-pressed={!depth} onClick={() => setDepth(false)}>
              Flat
            </button>
            <button type="button" aria-pressed={depth} onClick={() => setDepth(true)}>
              Time depth
            </button>
          </div>
          <button type="button" className="chronos-btn" onClick={reset}>
            Reset view
          </button>
        </div>

        <div className="chronos-legend" aria-hidden="true">
          <span>
            <i className="chronos-dot chronos-dot-ring" /> Person or organization
          </span>
          <span>
            <i className="chronos-dot chronos-dot-record" /> Record
          </span>
          <span>
            <i className="chronos-dot chronos-dot-faint" /> Other cosponsors
          </span>
          <span className="chronos-hint">Drag to orbit · right-drag to pan · scroll to zoom</span>
        </div>
      </div>
      <Timeline />
    </div>
  );
}
