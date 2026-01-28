import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Saved Decks",
  description:
    "Manage your saved Yu-Gi-Oh! decks. View, edit, and organize your deck collection for Master Duel and TCG formats.",
  keywords: [
    "saved decks",
    "yugioh deck collection",
    "deck management",
    "my decks",
  ],
  openGraph: {
    title: "Saved Decks | Master Deck Alchemist",
    description:
      "Manage your saved Yu-Gi-Oh! decks. View, edit, and organize your deck collection.",
  },
};

export default function SavedDecksLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
