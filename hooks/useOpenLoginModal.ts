"use client";

import { useLoginModalStore } from "@/store/useLoginModalStore";

/**
 * Opens the global login modal via Zustand (no `lib/` → store coupling).
 */
export function openLoginModal(): void {
  useLoginModalStore.getState().openLoginModal();
}

/**
 * Hook form when a component already needs reactive modal state.
 */
export function useOpenLoginModal(): () => void {
  return useLoginModalStore((s) => s.openLoginModal);
}
