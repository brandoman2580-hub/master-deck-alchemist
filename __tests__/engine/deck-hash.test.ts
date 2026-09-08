import {
  computeDeckHash,
  toEngineFormat,
} from "@/lib/engine/deck-hash";
import type { HashableDeck } from "@/lib/engine/types";

function deck(partial: Partial<HashableDeck> & Pick<HashableDeck, "mode">): HashableDeck {
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
      mode: "Master Duel",
      mainDeck: [{ id: 1 }, { id: 2 }, { id: 1 }],
    });
    const b = deck({
      mode: "Master Duel",
      mainDeck: [{ id: 2 }, { id: 1 }, { id: 1 }],
    });
    expect(computeDeckHash(a)).toBe(computeDeckHash(b));
  });

  it("changes when a card copy count changes", () => {
    const one = deck({
      mode: "TCG",
      mainDeck: [{ id: 10 }, { id: 10 }],
    });
    const two = deck({
      mode: "TCG",
      mainDeck: [{ id: 10 }, { id: 10 }, { id: 10 }],
    });
    expect(computeDeckHash(one)).not.toBe(computeDeckHash(two));
  });

  it("changes when format/mode changes with identical lists", () => {
    const cards = [{ id: 99 }];
    const md = deck({ mode: "Master Duel", mainDeck: cards });
    const tcg = deck({ mode: "TCG", mainDeck: cards });
    expect(computeDeckHash(md)).not.toBe(computeDeckHash(tcg));
  });

  it("treats zone membership as distinct (main vs extra)", () => {
    const inMain = deck({
      mode: "Master Duel",
      mainDeck: [{ id: 7 }],
    });
    const inExtra = deck({
      mode: "Master Duel",
      extraDeck: [{ id: 7 }],
    });
    expect(computeDeckHash(inMain)).not.toBe(computeDeckHash(inExtra));
  });

  it("returns an 8-char lowercase hex string", () => {
    const hash = computeDeckHash(
      deck({ mode: "TCG", mainDeck: [{ id: 1 }] }),
    );
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
