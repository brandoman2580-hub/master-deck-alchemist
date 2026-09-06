"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { DeckProvider } from "../context/deck-context";
import Navbar from "../components/navbar";
import { useCardStore } from "../store/cardStore";
import { getCardData } from "../lib/api";
import {
  readCardLibraryCache,
  writeCardLibraryCache,
} from "../lib/card-library-cache";
import { useSupabaseUserSync } from "../hooks/useSupabaseUserSync";
import { MagneticCursor } from "@/components/mda/magnetic-cursor";
import { AppQueryProvider } from "@/lib/query-client";
import { supabase } from "@/lib/supabaseClient";
import type { Card } from "@/types/card";

function usesMdaShell(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/deck-archives") ||
    pathname.startsWith("/workshop") ||
    pathname.startsWith("/auth/reset-password")
  );
}

/** Deduplicate concurrent network loads across mount + auth events. */
let cardLibraryLoadPromise: Promise<Card[]> | null = null;

async function fetchAndCacheCardLibrary(): Promise<Card[]> {
  if (cardLibraryLoadPromise) return cardLibraryLoadPromise;

  cardLibraryLoadPromise = (async (): Promise<Card[]> => {
    const results = await getCardData({
      name: "",
      sort: "name",
      sortDirection: "asc",
    });
    if (results.length > 0) {
      await writeCardLibraryCache(results);
    }
    return results;
  })().finally(() => {
    cardLibraryLoadPromise = null;
  });

  return cardLibraryLoadPromise;
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hideLegacyNavbar = usesMdaShell(pathname);
  const showMagneticCursor = hideLegacyNavbar;
  const setCardList = useCardStore((state) => state.setCardList);
  const setLoading = useCardStore((state) => state.setLoading);
  useSupabaseUserSync();

  useEffect(() => {
    let cancelled = false;

    const hydrateCardLibrary = async (): Promise<void> => {
      const existing = useCardStore.getState().cardList;
      if (existing.length > 0) return;

      setLoading(true);
      try {
        const cached = await readCardLibraryCache();
        if (cancelled) return;

        if (cached && cached.length > 0) {
          setCardList(cached);
          setLoading(false);
          return;
        }

        const results = await fetchAndCacheCardLibrary();
        if (cancelled) return;
        setCardList(results);
      } catch {
        // Cards remain empty on failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void hydrateCardLibrary();

    // Warm / refresh the library when the user signs in so Workshop is ready.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "SIGNED_IN" || !session?.user) return;

        void (async (): Promise<void> => {
          const existing = useCardStore.getState().cardList;
          if (existing.length > 0) return;

          const cached = await readCardLibraryCache();
          if (cached && cached.length > 0) {
            setCardList(cached);
            return;
          }

          setLoading(true);
          try {
            const results = await fetchAndCacheCardLibrary();
            setCardList(results);
          } catch {
            // Keep empty on failure
          } finally {
            setLoading(false);
          }
        })();
      },
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [setCardList, setLoading]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <AppQueryProvider>
        <DeckProvider>
          <div className="relative z-20 flex h-dvh max-h-dvh flex-col overflow-hidden">
            {hideLegacyNavbar ? null : <Navbar />}
            {showMagneticCursor ? <MagneticCursor /> : null}
            <main
              id="main-content"
              className="min-h-0 flex-1 overflow-y-auto scroll-smooth"
              tabIndex={-1}
              aria-label="Main content"
              role="main"
            >
              {children}
            </main>
          </div>
        </DeckProvider>
      </AppQueryProvider>
    </ThemeProvider>
  );
}
