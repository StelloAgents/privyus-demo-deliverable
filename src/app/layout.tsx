import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Inter_Tight } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/ui/AppShell";
import { ViewportScaler } from "@/components/ui/ViewportScaler";
import { INPUT_MODALITY_SCRIPT, THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "@/styles/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const DESCRIPTION =
  "Privyus connects public records on members of Congress, bills, lobbying, foreign agents, travel, and campaign money in one graph. Ask a question and every answer cites its source.";

export const metadata: Metadata = {
  title: { default: "Privyus", template: "%s · Privyus" },
  description: DESCRIPTION,
  applicationName: "Privyus",
  // Confidential demonstration build: keep it out of search engines.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Privyus",
    description: DESCRIPTION,
    siteName: "Privyus",
    type: "website",
  },
  twitter: { card: "summary", title: "Privyus", description: DESCRIPTION },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${interTight.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before the first paint, so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INPUT_MODALITY_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg-1">
        <ViewportScaler />
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
