"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { DeckProvider } from "../context/deck-context";
import Navbar from "../components/navbar";
import { useCardStore } from "../store/cardStore";
import { getCardData } from "../lib/api";
import { useSupabaseUserSync } from "../hooks/useSupabaseUserSync";
import { MagneticCursor } from "@/components/mda/magnetic-cursor";
import { AppQueryProvider } from "@/lib/query-client";

function usesMdaShell(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/deck-archives") ||
    pathname.startsWith("/workshop") ||
    pathname.startsWith("/auth/reset-password")
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hideLegacyNavbar = usesMdaShell(pathname);
  const showMagneticCursor = hideLegacyNavbar;
  const setCardList = useCardStore((state) => state.setCardList);
  const setLoading = useCardStore((state) => state.setLoading);
  const cardList = useCardStore((state) => state.cardList);
  useSupabaseUserSync();

  useEffect(() => {
    if (cardList.length > 0) {
      return;
    }

    const fetchAllCards = async (): Promise<void> => {
      setLoading(true);
      try {
        const results = await getCardData({
          name: "",
          sort: "name",
          sortDirection: "asc",
        });
        setCardList(results);
      } catch {
        // Cards remain empty on failure
      } finally {
        setLoading(false);
      }
    };
    void fetchAllCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <DeckProvider>
        <AppQueryProvider>
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
        </AppQueryProvider>
      </DeckProvider>
    </ThemeProvider>
  );
}
