import type { Metadata } from "next";
import { TechnicalPage } from "@/features/technical/TechnicalPage";

/** The Technical tab: how the production system would be built. */
export const metadata: Metadata = {
  title: "Technical Architecture",
  description: "How Privyus collects, resolves, stores, and serves the public record, from source filings to cited answers for people and AI agents.",
};

export default function Page() {
  return <TechnicalPage />;
}
