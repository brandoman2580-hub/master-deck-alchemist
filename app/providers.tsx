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
  useSupabaseUserSync();

  useEffect(() => {
    // Only fetch cards once, on client
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
        console.error("Error fetching cards:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllCards();
  }, [setCardList, setLoading]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <DeckProvider>
        <div className="relative z-20">
          <Navbar />
          <main id="main-content" className="flex-1" tabIndex={-1} aria-label="Main content" role="main">{children}</main>
        </div>
      </DeckProvider>
    </ThemeProvider>
  );
}
