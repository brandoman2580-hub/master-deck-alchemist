"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { DeckProvider } from "../context/deck-context";
import Navbar from "../components/navbar";
import { useCardStore } from "../store/cardStore";
import { getCardData } from "../lib/api";
import { useSupabaseUserSync } from "../hooks/useSupabaseUserSync";

export function Providers({ children }: { children: ReactNode }) {
  const setCardList = useCardStore((state) => state.setCardList);
  const setLoading = useCardStore((state) => state.setLoading);
  const cardList = useCardStore((state) => state.cardList);
  useSupabaseUserSync();

  useEffect(() => {
    // Only fetch cards once, on client, if not already loaded
    if (cardList.length > 0) {
      return; // Cards already loaded
    }

    const fetchAllCards = async () => {
      setLoading(true);
      try {
        const results = await getCardData({
          name: "",
          sort: "name",
          sortDirection: "asc",
        });
        setCardList(results);
      } catch (error) {
        // Silently handle errors - cards will remain empty
      } finally {
        setLoading(false);
      }
    };
    fetchAllCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <DeckProvider>
        <div className="relative z-20 flex flex-col min-h-screen">
          <Navbar />
          <main
            id="main-content"
            className="flex-1"
            tabIndex={-1}
            aria-label="Main content"
            role="main"
          >
            {children}
          </main>
        </div>
      </DeckProvider>
    </ThemeProvider>
  );
}
