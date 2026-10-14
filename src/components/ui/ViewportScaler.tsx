"use client";

import { useEffect } from "react";

const MIN_WIDTH = 1280;

/** Below 1280px wide, scale the same layout down (no mobile layout). */
export function ViewportScaler() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const w = window.innerWidth;
      root.style.setProperty("zoom", w < MIN_WIDTH ? String(w / MIN_WIDTH) : "");
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
  return null;
}
