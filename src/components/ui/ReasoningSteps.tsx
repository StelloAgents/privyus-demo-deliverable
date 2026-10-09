"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { StepStatus } from "@/lib/store";
import { cx } from "./cx";

export interface ReasoningStepsProps {
  steps: { label: string; status: StepStatus }[];
  /** True when every step is done: the list folds into "Thought for Ns". */
  complete: boolean;
  thoughtSeconds: number;
  /** Start expanded even when complete. */
  defaultOpen?: boolean;
  className?: string;
}

function StatusMark({ status }: { status: StepStatus }) {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
      {status === "done" ? (
        <Check size={14} strokeWidth={2} className="text-teal" />
      ) : status === "active" ? (
        <span
          className="block h-3.5 w-3.5 rounded-full border-[1.5px] border-teal-bright border-t-transparent"
          style={{ animation: "privy-spin 800ms linear infinite" }}
        />
      ) : (
        <span className="block h-1.5 w-1.5 rounded-full bg-fg-3" />
      )}
    </span>
  );
}

/** Reasoning steps (2.2): a vertical list that folds into "Thought for 3s" when done. */
export function ReasoningSteps({ steps, complete, thoughtSeconds, defaultOpen, className }: ReasoningStepsProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const expanded = !complete || open;
  return (
    <div className={cx("flex flex-col", className)}>
      {complete ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 self-start rounded-chip py-1 pr-2 text-[13px] leading-[18px] font-medium text-fg-3 transition-colors duration-[120ms] hover:text-fg-2"
        >
          <Check size={14} strokeWidth={2} className="text-teal" aria-hidden="true" />
          Thought for {thoughtSeconds}s
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={cx("transition-transform duration-[120ms]", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      ) : null}
      {expanded ? (
        <ol className={cx("flex flex-col gap-2", complete && "mt-2 border-l border-line pl-3")}>
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-2.5 text-[13px] leading-[18px]"
              style={{ animation: "privy-fade-in 180ms ease-out both" }}
            >
              <StatusMark status={s.status} />
              <span
                className={cx(
                  s.status === "done" && "text-fg-2",
                  s.status === "active" && "text-fg-1",
                  s.status === "pending" && "text-fg-3",
                )}
              >
                {s.label}
              </span>
            </li>
          ))}
          {complete ? (
            <li className="flex items-center gap-2.5 text-[13px] leading-[18px] font-medium text-fg-1">
              <StatusMark status="done" />
              Generation complete
            </li>
          ) : null}
        </ol>
      ) : null}
    </div>
  );
}
