"use client";

import { Check, ChevronDown, LogOut, Moon, Settings, UserRound, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { setTheme, useTheme } from "@/lib/theme";
import { Avatar } from "./Avatar";
import { Menu, MenuItem, MenuSeparator, MenuSwitch } from "./Menu";
import { useToast } from "./Toast";
import { cx } from "./cx";

const NOT_IN_DEMO = "Available in the full product";

/** "Workspace" in the top bar: the current workspace and an invite action. */
export function WorkspaceMenu() {
  const toast = useToast();
  return (
    <Menu
      label="Workspace"
      width={264}
      trigger={(props, open) => (
        <button
          type="button"
          {...props}
          className={cx(
            "flex h-9 items-center gap-1.5 rounded-button px-2.5 text-[15px] leading-5 font-medium transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1",
            open ? "bg-surface-2 text-fg-1" : "text-fg-2",
          )}
        >
          Workspace
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className={cx("transition-transform duration-[120ms]", open && "rotate-180")}
          />
        </button>
      )}
      header={
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip border border-line bg-surface-2 font-display text-[15px] font-bold text-fg-1">
            M
          </span>
          <div className="min-w-0 flex-1">
            <div className="t-card-title truncate">Mo&apos;s workspace</div>
            <div className="t-meta">3 seats · Pro</div>
          </div>
          <Check size={16} strokeWidth={2} className="shrink-0 text-teal" aria-label="Current workspace" />
        </div>
      }
    >
      <MenuSeparator />
      <MenuItem icon={<UserPlus size={16} strokeWidth={1.5} />} onSelect={() => toast.show(NOT_IN_DEMO, { tone: "info" })}>
        Invite teammates
      </MenuItem>
    </Menu>
  );
}

/** The "MB" avatar in the top bar: profile, settings, appearance, log out. */
export function AccountMenu() {
  const toast = useToast();
  const router = useRouter();
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <Menu
      label="Account"
      width={256}
      trigger={(props, open) => (
        <button
          type="button"
          {...props}
          aria-label="Account menu for Mo Barakat"
          className={cx(
            "flex rounded-full transition-[box-shadow] duration-[120ms] hover:shadow-[0_0_0_3px_var(--surface-3)]",
            open && "shadow-[0_0_0_3px_var(--surface-3)]",
          )}
        >
          <Avatar initials="MB" size={36} />
        </button>
      )}
      header={
        <div className="flex items-center gap-3">
          <Avatar initials="MB" size={40} />
          <div className="min-w-0">
            <div className="t-card-title truncate">Mo Barakat</div>
            <div className="t-meta">Workspace owner</div>
          </div>
        </div>
      }
    >
      <MenuSeparator />
      <MenuItem icon={<UserRound size={16} strokeWidth={1.5} />} onSelect={() => toast.show(NOT_IN_DEMO, { tone: "info" })}>
        Profile
      </MenuItem>
      <MenuItem icon={<Settings size={16} strokeWidth={1.5} />} onSelect={() => toast.show(NOT_IN_DEMO, { tone: "info" })}>
        Settings
      </MenuItem>
      <MenuItem
        icon={<Moon size={16} strokeWidth={1.5} />}
        checked={dark}
        keepOpen
        onSelect={() => setTheme(dark ? "light" : "dark")}
        trailing={
          <span className="flex items-center gap-2">
            <span className="t-meta">{dark ? "Dark" : "Light"}</span>
            <MenuSwitch on={dark} />
          </span>
        }
      >
        Appearance
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<LogOut size={16} strokeWidth={1.5} />} onSelect={() => router.push("/login")}>
        Log out
      </MenuItem>
    </Menu>
  );
}
