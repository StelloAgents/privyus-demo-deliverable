"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "./cx";

type MenuCtx = { close: (focusTrigger?: boolean) => void };
const MenuContext = createContext<MenuCtx>({ close: () => {} });

export interface MenuTriggerProps {
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

export interface MenuProps {
  /** Accessible name of the menu, for example "Account". */
  label: string;
  /** Renders the trigger button. Spread the props on a <button>. */
  trigger: (props: MenuTriggerProps, open: boolean) => ReactNode;
  /** Content above the items (not focusable), for example the user name. */
  header?: ReactNode;
  /** Menu width in px. Default 248. */
  width?: number;
  /** Which edge of the trigger the popover aligns to. Default "end". */
  align?: "start" | "end";
  children: ReactNode;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"])';

/**
 * A popover menu anchored to its trigger. Closes on outside click, Escape,
 * Tab, and item select. Focuses the first item on open; arrow keys, Home,
 * and End move between items.
 */
export function Menu({ label, trigger, header, width = 248, align = "end", children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusFirst, setFocusFirst] = useState<"first" | "last">("first");
  const baseId = useId();
  const menuId = `${baseId}-menu`;
  const triggerId = `${baseId}-trigger`;

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) document.getElementById(triggerId)?.focus();
  }, [triggerId]);

  // Focus the first (or last) item when the menu opens.
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    if (!items?.length) return;
    (focusFirst === "last" ? items[items.length - 1] : items[0]).focus();
  }, [open, focusFirst]);

  // Outside click closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      // Let Tab move on in the page; the menu closes behind it.
      close(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const triggerProps: MenuTriggerProps = {
    id: triggerId,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": menuId,
    onClick: () => {
      setFocusFirst("first");
      setOpen((o) => !o);
    },
    onKeyDown: (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusFirst(e.key === "ArrowUp" ? "last" : "first");
        setOpen(true);
      }
    },
  };

  return (
    <MenuContext.Provider value={{ close }}>
      <div ref={wrapRef} className="relative flex">
        {trigger(triggerProps, open)}
        {open ? (
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className={cx(
              "absolute top-[calc(100%+10px)] z-50 flex flex-col rounded-overlay border border-line-strong bg-surface-1 p-1.5",
              align === "end" ? "right-0" : "left-0",
            )}
            style={{ width, animation: "privy-fade-in 120ms ease-out both" }}
          >
            {header ? <div className="px-2.5 pt-2 pb-2.5">{header}</div> : null}
            {children}
          </div>
        ) : null}
      </div>
    </MenuContext.Provider>
  );
}

export interface MenuItemProps {
  icon?: ReactNode;
  /** Runs on click or Enter/Space, then the menu closes (unless `keepOpen`). */
  onSelect: () => void;
  /** Content on the right (a shortcut, a switch). */
  trailing?: ReactNode;
  /** A switch item (role="menuitemcheckbox"). */
  checked?: boolean;
  /** Keep the menu open after select (for switches). */
  keepOpen?: boolean;
  children: ReactNode;
}

export function MenuItem({ icon, onSelect, trailing, checked, keepOpen, children }: MenuItemProps) {
  const { close } = useContext(MenuContext);
  const isSwitch = checked !== undefined;
  return (
    <button
      type="button"
      role={isSwitch ? "menuitemcheckbox" : "menuitem"}
      aria-checked={isSwitch ? checked : undefined}
      tabIndex={-1}
      onClick={() => {
        onSelect();
        if (!keepOpen) close(true);
      }}
      className="flex h-9 w-full items-center gap-2.5 rounded-chip px-2.5 text-left text-[14px] leading-5 text-fg-1 outline-none transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
    >
      {icon ? <span className="flex w-4 shrink-0 items-center justify-center text-fg-2">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="mx-1 my-1.5 h-px bg-line" />;
}

/** A small on/off switch for a menu item. Visual only; the item carries the state. */
export function MenuSwitch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-chip border transition-colors duration-[120ms]",
        on ? "border-teal bg-teal" : "border-line-strong bg-surface-3",
      )}
    >
      <span
        className={cx(
          "absolute h-3 w-3 rounded-[2px] bg-surface-1 transition-[left] duration-[120ms]",
          on ? "left-[15px]" : "left-[2px]",
        )}
      />
    </span>
  );
}
