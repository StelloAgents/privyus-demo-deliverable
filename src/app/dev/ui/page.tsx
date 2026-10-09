import { notFound } from "next/navigation";
import { DevUiClient } from "./DevUiClient";

export const metadata = { title: "UI primitives · Privyus" };

export default function DevUiPage() {
  // Developer page: not part of the demo build.
  if (process.env.NODE_ENV === "production") notFound();
  return <DevUiClient />;
}
