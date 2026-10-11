"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect } from "react";
import type { SourceDoc } from "@/lib/types";
import { DISCLAIMER_TEXT } from "./Disclaimer";
import { SourceChip, sourceKindLabel } from "./SourceChip";

export interface SourceDrawerProps {
  source: SourceDoc | null;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** The drawer that a source chip opens: kind, title, date, the excerpt, and a link to the original record. */
export function SourceDrawer({ source, onClose }: SourceDrawerProps) {
  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, onClose]);

  if (!source) return null;
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Source"
        data-tour="source-drawer"
        onClick={(e) => e.stopPropagation()}
        className="absolute right-4 flex max-h-[calc(100vh-var(--topbar-height)-64px)] w-[400px] max-w-[calc(100vw-32px)] flex-col gap-4 overflow-y-auto rounded-overlay border border-line-strong bg-surface-1 p-6"
        style={{
          top: "calc(var(--topbar-height) + 32px)",
          animation: "privy-fade-rise 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <SourceChip kind={source.kind} label={sourceKindLabel(source.kind)} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close source"
            className="flex h-8 w-8 items-center justify-center rounded-button text-fg-3 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div>
          <h3 className="t-card-title">{source.title}</h3>
          <p className="t-meta mt-1">{formatDate(source.date)}</p>
        </div>
        <blockquote className="t-body rounded-card border border-line bg-surface-2 p-4 break-words text-fg-2">
          {source.excerpt}
        </blockquote>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            data-source-url=""
            className="inline-flex h-9 w-fit items-center gap-2 rounded-button border border-line-strong px-3 text-[13px] leading-none font-semibold text-fg-1 transition-colors duration-[120ms] hover:border-teal-bright hover:bg-surface-2"
          >
            <ExternalLink size={15} strokeWidth={1.75} aria-hidden="true" />
            Open original
            <span className="t-meta max-w-[200px] truncate font-normal">{new URL(source.url).hostname.replace(/^www\./, "")}</span>
          </a>
        ) : null}
        <p className="t-meta">{DISCLAIMER_TEXT}</p>
      </aside>
    </div>
  );
}
