import type { Metadata } from "next";
import { OrbitLab } from "@/features/lab/orbit/OrbitLab";

export const metadata: Metadata = {
  title: { absolute: "Orbit + Chronos · Graph Lab" },
  robots: { index: false, follow: false },
};

/** Graph lab prototype: Orbit + Chronos. Not linked from the app. */
export default function OrbitLabPage() {
  return <OrbitLab />;
}
