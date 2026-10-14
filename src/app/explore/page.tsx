import { Suspense } from "react";
import { ExploreClient } from "@/features/explore/ExploreClient";

export const metadata = {
  title: "Explore",
  description: "Ask a question in plain words and watch the graph of people, bills, meetings, and money build around it.",
};

/** Exploration Mode (Screen 2). The page logic lives in src/features/explore/. */
export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreClient />
    </Suspense>
  );
}
