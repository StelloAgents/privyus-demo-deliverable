import type { Metadata } from "next";
import { StrataLab } from "@/features/lab/strata/StrataLab";

export const metadata: Metadata = {
  title: { absolute: "Strata · Graph Lab" },
  robots: { index: false, follow: false },
};

/** Graph lab prototype: entity kinds on separate horizontal planes. */
export default function StrataPage() {
  return <StrataLab />;
}
