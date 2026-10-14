"use client";

import { ArrowRight, Search } from "lucide-react";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { cx } from "./cx";

export interface AskBarProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  /** Controlled value. Omit for an uncontrolled field. */
  value?: string;
  onChange?: (text: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Clear the field after submit (uncontrolled only). Default true. */
  clearOnSubmit?: boolean;
  /** Shows the submit button pressed (presenter mode presses it on screen). */
  submitPressed?: boolean;
  /**
   * Wraps long text onto more lines (up to 4) instead of scrolling it sideways,
   * so a whole question stays readable in a narrow panel. Enter still submits.
   */
  multiline?: boolean;
  className?: string;
}

/** Multiline field: 22px lines with 9px padding, so one line is as high as the 40px submit button. */
const LINE_PX = 22;
const MAX_LINES = 4;

/** Ask bar: surface-2, radius 12, 56px high (multiline: grows with its text), search icon, orange submit. */
export function AskBar({
  onSubmit,
  placeholder = "Ask anything",
  value,
  onChange,
  autoFocus,
  disabled,
  clearOnSubmit = true,
  submitPressed,
  multiline,
  className,
}: AskBarProps) {
  const [inner, setInner] = useState("");
  const text = value ?? inner;
  // Text set from outside (presenter typing) keeps its end in view, as typing would.
  const inputRef = useRef<HTMLInputElement>(null);
  // The multiline field grows with its text.
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement !== el) el.scrollLeft = el.scrollWidth;
    const area = areaRef.current;
    if (area) {
      area.style.height = "auto";
      area.style.height = `${Math.min(area.scrollHeight, LINE_PX * MAX_LINES + 18)}px`;
    }
  }, [text]);
  const setText = (t: string) => {
    if (value === undefined) setInner(t);
    onChange?.(t);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || disabled) return;
    onSubmit(q);
    if (clearOnSubmit && value === undefined) setInner("");
  };
  const fieldClass =
    "min-w-0 flex-1 bg-transparent text-[15px] text-fg-1 outline-none placeholder:text-fg-3 focus-visible:outline-none";
  return (
    <form
      onSubmit={submit}
      className={cx(
        "flex w-full items-center gap-3 rounded-card border border-line bg-surface-2 pr-2 pl-4 transition-[border-color] duration-[120ms] focus-within:border-line-strong",
        multiline ? "min-h-14 py-[7px]" : "h-14",
        className,
      )}
    >
      <Search size={20} strokeWidth={1.5} className="shrink-0 text-fg-3" aria-hidden="true" />
      {multiline ? (
        <textarea
          ref={areaRef}
          rows={1}
          value={text}
          // A question is one line of text: line breaks are not kept.
          onChange={(e) => setText(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={placeholder}
          className={cx(fieldClass, "resize-none py-[9px] leading-[22px]")}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={placeholder}
          className={cx(fieldClass, "h-full")}
        />
      )}
      <button
        type="submit"
        aria-label="Ask"
        disabled={disabled}
        data-pressed={submitPressed || undefined}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-orange text-[var(--on-orange)] transition-[filter,transform] duration-[120ms] hover:brightness-110 active:scale-[0.94] active:brightness-90 disabled:opacity-50 data-[pressed]:scale-[0.94] data-[pressed]:brightness-90"
      >
        <ArrowRight size={20} strokeWidth={2} />
      </button>
    </form>
  );
}
