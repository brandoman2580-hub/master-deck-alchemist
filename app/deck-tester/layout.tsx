import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Deck Tester",
  description:
    "Test your Yu-Gi-Oh! decks with AI-powered matchup analysis, duel simulations, and strategic insights. Compare your deck against meta decks and optimize for competitive play.",
  keywords: [
    "yugioh deck tester",
    "deck simulation",
    "matchup analysis",
    "yugioh deck testing",
    "competitive deck analysis",
  ],
  openGraph: {
    title: "Deck Tester | Master Deck Alchemist",
    description:
      "Test your Yu-Gi-Oh! decks with AI-powered matchup analysis, duel simulations, and strategic insights.",
  },
};

export default function DeckTesterLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
