import type { Metadata } from "next";
import { LoginCard } from "./LoginCard";

export const metadata: Metadata = { title: "Sign In", description: "Sign in to your Privyus workspace." };

/** The sign-in screen (no top bar). "Continue" returns to the dashboard. */
export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <LoginCard />
    </div>
  );
}
