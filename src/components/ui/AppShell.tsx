"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Disclaimer } from "./Disclaimer";
import { TopBar } from "./TopBar";
import { TourProvider } from "./TourProvider";

/** Routes without the top bar (the sign-in screen). */
const BARE_ROUTES = ["/login"];

/** The app frame: 16px gutter, the top bar, and the work area. /login shows the page alone. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  if (BARE_ROUTES.includes(pathname)) {
    return (
      <div className="flex min-h-dvh flex-col px-4">
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <Disclaimer />
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col px-4 pt-4">
      <TopBar />
      <main className="mt-4 flex min-h-0 flex-1 flex-col">{children}</main>
      <Disclaimer />
      <TourProvider />
    </div>
  );
}
