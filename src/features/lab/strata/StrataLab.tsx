"use client";

import type { CameraControls } from "@react-three/drei";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NODE_BY_ID } from "./graph";
import s from "./strata.module.css";
import { computeVisual } from "./visual";

/** WebGL runs in the browser only. */
const StrataScene = dynamic(() => import("./StrataScene"), {
  ssr: false,
  loading: () => <div className={s.canvas} aria-hidden="true" />,
});

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

const shortName = (id: string) => {
  const n = NODE_BY_ID.get(id)!;
  return n.kind === "bill" ? n.label.split(" · ")[0] : n.label;
};

export function StrataLab() {
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const controls = useRef<CameraControls | null>(null);
  const visual = useMemo(() => computeVisual(focus), [focus]);

  const onFocus = useCallback((id: string | null) => setFocus(id), []);
  const onHover = useCallback((id: string | null) => setHover(id), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocus(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={s.stage} data-testid="strata-stage">
      <div className={s.canvas}>
        <StrataScene visual={visual} focus={focus} hover={hover} reduced={reduced} onFocus={onFocus} onHover={onHover} controlsRef={controls} />
      </div>

      <div className={s.hudTop}>
        <div>
          <h1 className={s.title}>Strata</h1>
          <p className={s.meta}>Sen. Ellen Hartley · US Stance on Ukraine · four record layers</p>
        </div>
        <button type="button" className={s.reset} onClick={() => setFocus(null)}>
          Reset view
        </button>
      </div>

      <div className={s.hudBottom}>
        <p className={s.hint}>Drag to orbit · Right-drag to pan · Scroll to zoom · Click a node to focus · Esc to clear</p>
        {visual.path.length > 0 && (
          <div className={s.trail} aria-label="Focus path">
            {visual.path.map((id, i) => (
              <span key={id} style={{ display: "contents" }}>
                {i > 0 && <span className={s.trailSep} aria-hidden="true" />}
                <span className={i === visual.path.length - 1 ? s.trailLast : undefined}>{shortName(id)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
