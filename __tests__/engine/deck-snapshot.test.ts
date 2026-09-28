/**
 * Live Workshop deck snapshot for Strategist chat.
 */
import {
  buildLiveDeckSnapshot,
  countSectionEntries,
} from "@/lib/engine/deck-snapshot";
import type { DeckCard, DeckType } from "@/types/types";

function card(id: number, name: string): DeckCard {
  return {
    id,
    name,
    type: "Effect Monster",
    desc: "",
    deckInstanceId: `${id}-${Math.random()}`,
  } as DeckCard;
}

describe("buildLiveDeckSnapshot", () => {
  it("collapses Workshop instances into id + count per section", () => {
    const deck = {
      id: "deck-1",
      name: "Test",
      mode: "Master Duel",
      mainDeck: [card(1, "Ash"), card(1, "Ash"), card(2, "Imperm")],
      extraDeck: [card(9, "Accesscode")],
      sideDeck: [card(3, "Nibiru"), card(3, "Nibiru"), card(3, "Nibiru")],
    } as DeckType;

    expect(buildLiveDeckSnapshot(deck)).toEqual({
      main: [
        { id: 1, count: 2 },
        { id: 2, count: 1 },
      ],
      extra: [{ id: 9, count: 1 }],
      side: [{ id: 3, count: 3 }],
    });
  });

  it("skips invalid card ids when counting a section", () => {
    const entries = countSectionEntries([
      card(0, "Bad"),
      card(5, "Good"),
      { ...card(5, "Good"), id: Number.NaN },
    ]);
    expect(entries).toEqual([{ id: 5, count: 1 }]);
  });
});

describe("out-of-bounds user copy", () => {
  it("does not expose internal FactsEnvelope wording to players", async () => {
    const { buildOutOfBoundsCoachResponse } = await import(
      "@/lib/engine/assistant-contract"
    );
    const coach = buildOutOfBoundsCoachResponse({
      oob_reason: "rules_judge",
      confidence: "high",
    });
    expect(coach.answer).not.toMatch(/FactsEnvelope/i);
    expect(coach.limitations.join(" ")).not.toMatch(/FactsEnvelope/i);
  });
});
