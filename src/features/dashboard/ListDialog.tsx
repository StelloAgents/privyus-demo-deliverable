"use client";

import { ArrowRight, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Panel } from "@/components/ui";

/** A centered dialog that lists every item of a dashboard panel ("View all"). */
export function ListDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_72%,transparent)]"
      style={{ animation: "privy-fade-in 180ms ease-out both" }}
      onClick={onClose}
    >
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <Panel
          title={title}
          className="max-h-[80vh] w-[560px]"
          action={
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-button p-1 text-fg-2 hover:bg-surface-2 hover:text-fg-1"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          }
          bodyClassName="overflow-y-auto"
        >
          {children}
        </Panel>
      </div>
    </div>
  );
}

/** The header arrow that opens a panel's full list. It shows the total next to it. */
export function ViewAllLink({ count, noun, onClick }: { count: number; noun: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View all ${count} ${noun}`}
      className="group flex items-center gap-2 rounded-chip py-1 pr-1 pl-2 transition-colors duration-[120ms] hover:bg-surface-2"
    >
      <span className="t-meta tabular-nums">{count}</span>
      <ArrowRight size={18} strokeWidth={1.5} className="text-fg-2 group-hover:text-fg-1" aria-hidden="true" />
    </button>
  );
}
