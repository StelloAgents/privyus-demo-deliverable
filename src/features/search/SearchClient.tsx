"use client";

import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SourceDrawer } from "@/components/ui";
import { emit } from "@/lib/events";
import { usePageReady } from "@/lib/page-ready";
import { useTourActive } from "@/lib/tour";
import type { SourceDoc } from "@/lib/types";
import { Home } from "./Home";
import { Results, type Option } from "./Results";
import { askHref, search } from "./search-index";
import { setSearchText, useSearchField } from "./search-store";

const DEBOUNCE_MS = 120;

/** The Search page: scope tabs, the search field, record-type filters, and results or the start content. */
export function SearchClient() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const value = useSearchField((s) => s.value);
  const setValue = setSearchText;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [source, setSource] = useState<SourceDoc | null>(null);
  const presenting = useTourActive();

  const navigate = useCallback((href: string) => router.push(href), [router]);

  // Debounced query for the typeahead.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(value);
      setActive(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  // The field starts empty each time Search opens (as a local field would).
  useEffect(() => () => setSearchText(""), []);

  // "/" focuses the field from anywhere on the page.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim();
  const options: Option[] = useMemo(() => {
    if (!q) return [];
    return [
      ...search(q).map((hit) => ({
        kind: "hit" as const,
        key: hit.kind === "entity" ? hit.entry.id : `filing:${hit.source.id}`,
        hit,
      })),
      { kind: "ask" as const, key: "ask", query: q },
    ];
  }, [q]);
  const activeIndex = Math.max(0, Math.min(active, options.length - 1));
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const choose = (opt: Option | undefined) => {
    if (!opt) return;
    if (opt.kind === "ask") navigate(askHref(opt.query));
    else if (opt.hit.kind === "entity") navigate(opt.hit.entry.href);
    else setSource(opt.hit.source);
  };

  const submit = () => {
    const v = value.trim();
    if (!v) {
      inputRef.current?.focus();
      return;
    }
    // The results may lag the field by the debounce; a fresh query asks.
    if (v !== q) navigate(askHref(v));
    else choose(options[activeIndex]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // "/" is the focus shortcut: in an empty field it is already satisfied, so it never types.
    if (e.key === "/" && !value) {
      e.preventDefault();
      return;
    }
    if (!options.length) {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setValue("");
      setQuery("");
    }
  };

  // The results are on screen (presenter mode waits for them).
  useEffect(() => {
    if (q && options.length) emit("search-results", q);
  }, [q, options]);
  usePageReady("/search");

  const showResults = !!q;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col pt-[12vh] pb-10">
      <h1 className="t-panel-title">Public Record Search</h1>
      <p className="mt-1 text-[14px] leading-5 text-fg-3">
        Find people, bills, organizations, and filings in lobbying, foreign agent, campaign finance, travel, and voting
        records.
      </p>

      <form
        role="search"
        data-tour="search-field"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-5 flex h-16 w-full items-center gap-4 rounded-card border border-line bg-surface-2 pr-3 pl-5 transition-[border-color] duration-[120ms] focus-within:border-line-strong"
      >
        <Search size={22} strokeWidth={1.5} className="shrink-0 text-fg-3" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search people, bills, organizations, or filings"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showResults && options.length ? optionId(activeIndex) : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={!presenting}
          placeholder="Search people, bills, organizations, or filings"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/^\/+/, ""))}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-fg-1 outline-none placeholder:text-fg-3 focus-visible:outline-none"
        />
        <kbd
          aria-hidden="true"
          title="Press / to search"
          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-chip border border-line-strong px-1.5 font-sans text-[12px] font-medium text-fg-3"
        >
          /
        </kbd>
        <button
          type="submit"
          aria-label="Search"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button bg-orange text-[var(--on-orange)] transition-[filter] duration-[120ms] hover:brightness-110"
        >
          <ArrowRight size={20} strokeWidth={2} />
        </button>
      </form>

      <div className="mt-3">
        {showResults ? (
          <Results
            listId={listId}
            options={options}
            activeIndex={activeIndex}
            optionId={optionId}
            onActive={setActive}
            onChoose={choose}
            emptyNote={`No records match ‘${q}’.`}
          />
        ) : (
          <Home onNavigate={navigate} />
        )}
      </div>

      <SourceDrawer source={source} onClose={() => setSource(null)} />
    </div>
  );
}
