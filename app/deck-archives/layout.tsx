import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Deck Archives",
  description: "Browse, pin, share, and manage your Yu-Gi-Oh! decks.",
};

export default function DeckArchivesLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return children;
}
