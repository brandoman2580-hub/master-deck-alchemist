import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getDeckShare } from "@/lib/api/deckShare";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://masterdeckalchemist.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  try {
    const result = await getDeckShare(token);

    if (result.success && result.deck) {
      const deck = result.deck;
      const deckName = deck.name || "Shared Deck";
      const mainCount = deck.mainDeck?.length || 0;
      const extraCount = deck.extraDeck?.length || 0;
      const sideCount = deck.sideDeck?.length || 0;
      const format = deck.mode || "Master Duel";

      return {
        title: `${deckName} | Shared Deck`,
        description: `View ${deckName} - ${mainCount} main deck cards, ${extraCount} extra deck cards${sideCount > 0 ? `, ${sideCount} side deck cards` : ""}. ${format} format.`,
        openGraph: {
          title: `${deckName} | Shared Deck`,
          description: `View ${deckName} - ${mainCount} main deck cards, ${extraCount} extra deck cards. ${format} format.`,
          url: `${siteUrl}/share/${token}`,
        },
        twitter: {
          card: "summary_large_image",
          title: `${deckName} | Shared Deck`,
          description: `View ${deckName} - ${mainCount} main deck cards, ${extraCount} extra deck cards.`,
        },
      };
    }
  } catch (error) {
    // Fallback metadata if deck fetch fails
    // Error generating metadata for share page
  }

  // Default metadata for share pages
  return {
    title: "Shared Deck",
    description:
      "View a shared Yu-Gi-Oh! deck. Import the deck into your deck builder to start editing.",
    openGraph: {
      title: "Shared Deck | Master Deck Alchemist",
      description:
        "View a shared Yu-Gi-Oh! deck. Import the deck into your deck builder to start editing.",
      url: `${siteUrl}/share/${token}`,
    },
  };
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
