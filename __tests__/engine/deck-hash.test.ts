import {
  computeDeckHash,
  toEngineFormat,
} from "@/lib/engine/deck-hash";
import type { HashableDeck } from "@/lib/engine/types";

function deck(
  partial: Partial<HashableDeck> & Pick<HashableDeck, "deckFormat">,
): HashableDeck {
  return {
    mainDeck: [],
    extraDeck: [],
    sideDeck: [],
    ...partial,
  };
}

describe("toEngineFormat", () => {
  it("maps TCG mode to TCG", () => {
    expect(toEngineFormat("TCG")).toBe("TCG");
  });

  it("maps Master Duel and unknown modes to MASTER_DUEL", () => {
    expect(toEngineFormat("Master Duel")).toBe("MASTER_DUEL");
    expect(toEngineFormat("custom")).toBe("MASTER_DUEL");
  });
});

describe("computeDeckHash", () => {
  it("is stable for the same multiset regardless of card order", () => {
    const a = deck({
      deckFormat: "Master Duel",
      mainDeck: [{ id: 1 }, { id: 2 }, { id: 1 }],
    });
    const b = deck({
      deckFormat: "Master Duel",
      mainDeck: [{ id: 2 }, { id: 1 }, { id: 1 }],
    });
    expect(computeDeckHash(a)).toBe(computeDeckHash(b));
  });

  it("changes when a card copy count changes", () => {
    const one = deck({
      deckFormat: "TCG",
      mainDeck: [{ id: 10 }, { id: 10 }],
    });
    const two = deck({
      deckFormat: "TCG",
      mainDeck: [{ id: 10 }, { id: 10 }, { id: 10 }],
    });
    expect(computeDeckHash(one)).not.toBe(computeDeckHash(two));
  });

  it("changes when format/mode changes with identical lists", () => {
    const cards = [{ id: 99 }];
    const md = deck({ deckFormat: "Master Duel", mainDeck: cards });
    const tcg = deck({ deckFormat: "TCG", mainDeck: cards });
    expect(computeDeckHash(md)).not.toBe(computeDeckHash(tcg));
  });

  it("treats zone membership as distinct (main vs extra)", () => {
    const inMain = deck({
      deckFormat: "Master Duel",
      mainDeck: [{ id: 7 }],
    });
    const inExtra = deck({
      deckFormat: "Master Duel",
      extraDeck: [{ id: 7 }],
    });
    expect(computeDeckHash(inMain)).not.toBe(computeDeckHash(inExtra));
  });

  it("returns an 8-char lowercase hex string", () => {
    const hash = computeDeckHash(
      deck({ deckFormat: "TCG", mainDeck: [{ id: 1 }] }),
    );
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
