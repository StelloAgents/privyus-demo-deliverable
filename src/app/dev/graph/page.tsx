import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DevGraphClient } from "./DevGraphClient";

export const metadata = { title: "Graph test · Privyus" };

/** Test page for the graph engine: node types, focus path, dimming, ghost hints, replayable build. */
export default function DevGraphPage() {
  // Developer page: not part of the demo build.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <DevGraphClient />
    </Suspense>
  );
}
