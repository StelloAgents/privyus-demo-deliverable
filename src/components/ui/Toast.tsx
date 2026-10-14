"use client";

import { Check, Info } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { create } from "zustand";
import { emit } from "@/lib/events";

type ToastTone = "success" | "info";
type ToastApi = { show: (message: string, opts?: { tone?: ToastTone }) => void };

const useToastStore = create<{ toast: { id: number; message: string; tone: ToastTone } | null }>(() => ({ toast: null }));
let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 0;

/** Shows a toast for 2.6s (replaces the one on screen). */
export function showToast(message: string, opts?: { tone?: ToastTone }): void {
  if (timer) clearTimeout(timer);
  useToastStore.setState({ toast: { id: ++nextId, message, tone: opts?.tone ?? "success" } });
  timer = setTimeout(() => useToastStore.setState({ toast: null }), 2600);
}

/** Hides any toast now (presenter mode: no toast follows a page change). */
export function dismissToast(): void {
  if (timer) clearTimeout(timer);
  if (useToastStore.getState().toast) useToastStore.setState({ toast: null });
}

const api: ToastApi = { show: showToast };

/** `const toast = useToast(); toast.show("Exploration saved")` */
export function useToast(): ToastApi {
  return api;
}

function ToastView({ id, message, tone }: { id: number; message: string; tone: ToastTone }) {
  // Presenter mode waits for the toast to be on screen.
  useEffect(() => emit("toast-shown", String(id)), [id]);
  return (
    <div
      className="flex items-center gap-2 rounded-overlay border border-line-strong bg-surface-3 px-4 py-2.5 text-[14px] leading-5 font-medium text-fg-1"
      style={{ animation: "privy-fade-rise 180ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
    >
      {tone === "info" ? (
        <Info size={16} strokeWidth={1.75} className="text-fg-2" aria-hidden="true" />
      ) : (
        <Check size={16} strokeWidth={2} className="text-teal" aria-hidden="true" />
      )}
      {message}
    </div>
  );
}

/** Toast host: bottom center, surface-3. Mounted once in the root layout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = useToastStore((s) => s.toast);
  return (
    <>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex justify-center">
        {toast ? <ToastView key={toast.id} {...toast} /> : null}
      </div>
    </>
  );
}
