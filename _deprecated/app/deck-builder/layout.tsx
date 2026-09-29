import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Deck Builder",
  description:
    "Build and optimize your Yu-Gi-Oh! decks with AI-powered recommendations. Drag and drop cards, analyze synergies, and test your deck builds for Master Duel and TCG formats.",
  keywords: [
    "yu-gi-oh deck builder",
    "yugioh deck builder",
    "master duel deck builder",
    "tcg deck builder",
    "deck building tool",
    "yugioh cards",
  ],
  openGraph: {
    title: "Deck Builder | Master Deck Alchemist",
    description:
      "Build and optimize your Yu-Gi-Oh! decks with AI-powered recommendations. Drag and drop cards, analyze synergies, and test your deck builds.",
  },
};

export default function DeckBuilderLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
