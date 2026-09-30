import { useLiveDeckStore } from "@/store/liveDeckStore";
import type { Card } from "@/types/card";

function sampleCard(id: number, name: string): Card {
  return {
    id,
    name,
    type: "Effect Monster",
    desc: "",
    race: "Warrior",
    misc_info: [{ md_rarity: "N" }],
    card_sets: {
      set_name: "",
      set_code: "",
      set_rarity: "",
      set_rarity_code: "",
      set_price: "",
    },
    card_images: [],
    card_prices: [],
  } as Card;
}

describe("useLiveDeckStore", () => {
  beforeEach(() => {
    useLiveDeckStore.getState().clearDeck("Master Duel");
    useLiveDeckStore.getState().setBanlist({});
    useLiveDeckStore.getState().setError(null);
  });

  it("adds and removes cards and marks dirty", () => {
    const store = useLiveDeckStore.getState();
    expect(store.isDirty).toBe(false);

    store.addCardToDeck(sampleCard(1, "Ash Blossom & Joyous Spring"), "mainDeck");
    expect(useLiveDeckStore.getState().currentDeck.mainDeck).toHaveLength(1);
    expect(useLiveDeckStore.getState().isDirty).toBe(true);

    const instanceId =
      useLiveDeckStore.getState().currentDeck.mainDeck[0]!.deckInstanceId;
    store.removeCardFromDeck(instanceId, "mainDeck");
    expect(useLiveDeckStore.getState().currentDeck.mainDeck).toHaveLength(0);
  });

  it("enforces banlist copy limits across sections", () => {
    useLiveDeckStore.getState().setBanlist({
      "Ash Blossom & Joyous Spring": "Limited",
    });
    const card = sampleCard(1, "Ash Blossom & Joyous Spring");
    useLiveDeckStore.getState().addCardToDeck(card, "mainDeck");
    useLiveDeckStore.getState().addCardToDeck(card, "sideDeck");
    expect(useLiveDeckStore.getState().currentDeck.mainDeck).toHaveLength(1);
    expect(useLiveDeckStore.getState().currentDeck.sideDeck).toHaveLength(0);
  });

  it("updates deckFormat on the live SSoT", () => {
    useLiveDeckStore.getState().updateDeckFormat("TCG");
    expect(useLiveDeckStore.getState().currentDeck.deckFormat).toBe("TCG");
  });

  it("clears dirty via markClean / applyMergeAfterSave", () => {
    useLiveDeckStore.getState().renameDeck("Branded");
    expect(useLiveDeckStore.getState().isDirty).toBe(true);
    const generation = useLiveDeckStore.getState().editGeneration;
    useLiveDeckStore.getState().applyMergeAfterSave(
      {
        id: useLiveDeckStore.getState().currentDeck.id,
        name: "Branded",
        deckFormat: "Master Duel",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      generation,
    );
    expect(useLiveDeckStore.getState().isDirty).toBe(false);
    expect(useLiveDeckStore.getState().currentDeck.updated_at).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("keeps dirty when edits land during an in-flight save generation", () => {
    useLiveDeckStore.getState().renameDeck("Branded");
    const generationAtSaveStart = useLiveDeckStore.getState().editGeneration;
    useLiveDeckStore
      .getState()
      .addCardToDeck(sampleCard(2, "Effect Veiler"), "mainDeck");
    expect(useLiveDeckStore.getState().editGeneration).toBeGreaterThan(
      generationAtSaveStart,
    );

    useLiveDeckStore.getState().applyMergeAfterSave(
      {
        id: useLiveDeckStore.getState().currentDeck.id,
        name: "Branded",
        deckFormat: "Master Duel",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      generationAtSaveStart,
    );

    expect(useLiveDeckStore.getState().isDirty).toBe(true);
    expect(useLiveDeckStore.getState().currentDeck.mainDeck).toHaveLength(1);
  });
});
