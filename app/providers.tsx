"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { DeckProvider } from "../context/deck-context.tsx";
import Navbar from "../components/navbar.tsx";
import { useCardStore } from "../store/cardStore.ts";
import { getCardData } from "../lib/api.ts";
import { useSupabaseUserSync } from "../hooks/useSupabaseUserSync.ts";

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
          <main className="flex-1">{children}</main>
        </div>
      </DeckProvider>
    </ThemeProvider>
  );
}
