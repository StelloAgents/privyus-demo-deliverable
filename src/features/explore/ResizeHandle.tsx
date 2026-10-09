"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { cx } from "@/components/ui";

export const CHAT_DEFAULT_WIDTH = 420;
export const CHAT_MIN_WIDTH = 320;
const CHAT_MAX_WIDTH = 720;
const KEY_STEP = 24;
const STORAGE_KEY = "privyus.explore.chatWidth";

/** The largest chat width for a workspace: half of it, and never more than 720px. */
export function maxChatWidth(workspaceWidth: number): number {
  return Math.max(CHAT_MIN_WIDTH, Math.min(CHAT_MAX_WIDTH, Math.floor(workspaceWidth / 2)));
}

export function readStoredChatWidth(): number | null {
  try {
    const v = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v >= CHAT_MIN_WIDTH ? v : null;
  } catch {
    return null;
  }
}

function storeChatWidth(w: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(w)));
  } catch {
    // Storage can fail (private mode); the width then lasts for this page only.
  }
}

export interface ResizeHandleProps {
  /** The workspace row; its left edge is where the chat starts. */
  containerRef: RefObject<HTMLDivElement | null>;
  width: number;
  /** Live width while dragging (the parent writes it to a CSS variable; no React render). */
  onPreview: (w: number) => void;
  /** Final width after a drag, a key press, or a reset. */
  onCommit: (w: number) => void;
}

/**
 * A vertical separator in the 16px gap between the chat and the graph.
 * Drag, arrow keys (24px), Home/End, and double-click (reset) change the chat width.
 */
export function ResizeHandle({ containerRef, width, onPreview, onCommit }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const live = useRef(width);
  const [max, setMax] = useState(CHAT_MAX_WIDTH);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setMax(maxChatWidth(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const clamp = useCallback((w: number) => Math.max(CHAT_MIN_WIDTH, Math.min(max, Math.round(w))), [max]);

  const commit = (w: number) => {
    const c = clamp(w);
    storeChatWidth(c);
    onCommit(c);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = width;
    setDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const left = containerRef.current?.getBoundingClientRect().left ?? 0;
    // The handle sits in the middle of the 16px gap.
    live.current = clamp(e.clientX - left - 8);
    onPreview(live.current);
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    commit(live.current);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === "ArrowLeft"
        ? width - KEY_STEP
        : e.key === "ArrowRight"
          ? width + KEY_STEP
          : e.key === "Home"
            ? CHAT_MIN_WIDTH
            : e.key === "End"
              ? max
              : null;
    if (next === null) return;
    e.preventDefault();
    commit(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the chat panel"
      aria-valuenow={Math.round(width)}
      aria-valuemin={CHAT_MIN_WIDTH}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => commit(CHAT_DEFAULT_WIDTH)}
      onKeyDown={onKeyDown}
      className="group relative flex w-4 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none"
    >
      <span
        aria-hidden="true"
        className={cx(
          "h-full w-px transition-colors duration-[120ms]",
          dragging ? "bg-line-strong" : "bg-transparent group-hover:bg-line-strong group-focus-visible:bg-teal-bright",
        )}
      />
      <span
        aria-hidden="true"
        className={cx(
          "absolute top-1/2 flex h-8 w-2 -translate-y-1/2 flex-col items-center justify-center gap-[3px] rounded-chip border bg-surface-1 transition-[opacity,border-color] duration-[120ms]",
          dragging
            ? "border-line-strong opacity-100"
            : "border-line opacity-0 group-hover:border-line-strong group-hover:opacity-100 group-focus-visible:border-teal-bright group-focus-visible:opacity-100",
        )}
      >
        <span className="h-[2px] w-[2px] rounded-full bg-fg-3" />
        <span className="h-[2px] w-[2px] rounded-full bg-fg-3" />
        <span className="h-[2px] w-[2px] rounded-full bg-fg-3" />
      </span>
    </div>
  );
}
