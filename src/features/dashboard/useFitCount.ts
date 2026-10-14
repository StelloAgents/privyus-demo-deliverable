"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * How many equal-height items fit fully in a container. The container is the
 * measured box; the items are its list children (the first one sets the row height).
 * Before the first measure it returns `total`, so the server markup shows every item.
 */
export function useFitCount<T extends HTMLElement, L extends HTMLElement>(total: number, gap: number, reserve = 0) {
  const boxRef = useRef<T>(null);
  const listRef = useRef<L>(null);
  const [count, setCount] = useState(total);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      // The tallest row sets the row height: a row that is still animating in must not shrink it.
      const children = Array.from(listRef.current?.children ?? []) as HTMLElement[];
      const rowH = Math.max(0, ...children.map((c) => c.offsetHeight));
      if (!rowH) return;
      const avail = box.clientHeight - reserve;
      setCount(Math.max(1, Math.min(total, Math.floor((avail + gap) / (rowH + gap)))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [total, gap, reserve]);

  return { boxRef, listRef, count };
}
