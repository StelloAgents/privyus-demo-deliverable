import type { Metadata } from "next";
import { ChronosLab } from "@/features/lab/chronos/ChronosLab";

export const metadata: Metadata = {
  title: { absolute: "Chronos · Graph Lab" },
  robots: { index: false, follow: false },
};

/** Graph Lab prototype: the map-anchored, time-driven graph direction. */
export default function ChronosPage() {
  return <ChronosLab />;
}
