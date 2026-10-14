"use client";

import { create } from "zustand";

/** The text in the search field (a store, so presenter mode can type into it). */
export const useSearchField = create<{ value: string }>(() => ({ value: "" }));

export function setSearchText(value: string): void {
  useSearchField.setState({ value });
}
