"use client";

import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";

/** Sun icon in dark mode, moon icon in light mode (DESIGN.md section 1b). */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light")}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-9 w-9 items-center justify-center rounded-button text-fg-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1"
    >
      {/* Both icons render; CSS shows the one for the data-theme set before the first paint. */}
      <Sun size={18} strokeWidth={1.5} className="theme-dark-only" aria-hidden="true" />
      <Moon size={18} strokeWidth={1.5} className="theme-light-only" aria-hidden="true" />
    </button>
  );
}
