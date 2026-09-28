/**
 * Pure sanitize rebuild — unique IDs vs verified map; duplicate copies via count.
 */
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  rebuildDeckFromVerifiedCards,
  formatUnknownCardsRejection,
} from "../sanitize-snapshot.ts";
import type { Card } from "../types.ts";

function card(id: number, name: string): Card {
  return {
    id,
    name,
    type: "Effect Monster",
    desc: "Test effect",
  };
}

Deno.test("rebuildDeckFromVerifiedCards accepts duplicate counts via unique IDs", () => {
  const verified = new Map<number, Card>([
    [1, card(1, "Ash Blossom")],
    [2, card(2, "Infinite Impermanence")],
  ]);

  const result = rebuildDeckFromVerifiedCards(
    {
      main: [
        { id: 1, count: 3 },
        { id: 2, count: 2 },
      ],
      extra: [],
      side: [],
    },
    verified,
  );

  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.deck.mainDeck.length, 2);
  assertEquals(result.deck.mainDeck[0]?.count, 3);
  assertEquals(result.allCards.length, 2);
});

Deno.test("rebuildDeckFromVerifiedCards rejects unknown ids without length mismatch on copies", () => {
  const verified = new Map<number, Card>([[1, card(1, "Ash Blossom")]]);
  const result = rebuildDeckFromVerifiedCards(
    {
      main: [
        { id: 1, count: 3 },
        { id: 999, count: 1 },
      ],
      extra: [],
      side: [],
    },
    verified,
  );

  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.unknownCardIds.includes(999), true);
});

Deno.test("formatUnknownCardsRejection stays player-facing", () => {
  const msg = formatUnknownCardsRejection([1, 2, 3]);
  assertStringIncludes(msg.toLowerCase(), "card library");
  assertEquals(/\bids?\s*:/i.test(msg), false);
});
