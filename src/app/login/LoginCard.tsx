"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

export function LoginCard() {
  const router = useRouter();
  const [email, setEmail] = useState("mo@privyus.demo");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    router.push("/");
  };
  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-[400px] flex-col rounded-panel border border-line bg-surface-1 p-8"
      style={{ animation: "privy-fade-rise 180ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
    >
      <div className="mb-8 flex justify-center">
        <Image
          src="/brand/privyus-wordmark-dark.png"
          alt="Privyus, political intelligence"
          width={869}
          height={460}
          priority
          className="theme-dark-only h-16 w-auto"
        />
        <Image
          src="/brand/privyus-logo-color.png"
          alt="Privyus"
          width={600}
          height={269}
          priority
          className="theme-light-only h-14 w-auto"
        />
      </div>
      <h1 className="t-panel-title text-center">Sign In to Privyus</h1>
      <label htmlFor="login-email" className="t-meta mt-8 mb-2 text-fg-2">
        Work email
      </label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 rounded-card border border-line bg-surface-2 px-3.5 text-[15px] text-fg-1 outline-none transition-[border-color] duration-[120ms] placeholder:text-fg-3 focus:border-line-strong"
      />
      <Button type="submit" variant="primary" size="lg" className="mt-5 w-full">
        Continue
      </Button>
      <p className="t-meta mt-6 text-center">Single sign-on available for teams</p>
    </form>
  );
}
