import type { DeckType } from "@/types/deck";
import { buildFactsEnvelope } from "@/lib/engine/build-facts";
import {
  evaluateAssistantEligibility,
  isDeckPersisted,
} from "@/lib/engine/legality";

function sampleDeck(overrides: Partial<DeckType> = {}): DeckType {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test Snake-Eye",
    deckFormat: "Master Duel",
    mainDeck: [],
    extraDeck: [],
    sideDeck: [],
    ...overrides,
  };
}

function padMain(count: number): DeckType["mainDeck"] {
  return Array.from({ length: count }, (_, i) => ({
    id: 1000 + (i % 30),
    deckInstanceId: `inst-${i}`,
    name: `Card ${1000 + (i % 30)}`,
    type: "Effect Monster",
    desc: "Add 1 card from your Deck to your hand.",
    race: "Warrior",
    misc_info: [{ md_rarity: "N" }],
    card_sets: {
      set_name: "x",
      set_code: "x",
      set_rarity: "x",
      set_rarity_code: "x",
      set_price: "0",
    },
    card_images: [],
    card_prices: [],
  })) as DeckType["mainDeck"];
}

describe("evaluateAssistantEligibility", () => {
  it("rejects unsaved incomplete New Deck workspaces", () => {
    const result = evaluateAssistantEligibility(
      sampleDeck({ name: "New Deck", mainDeck: padMain(10) }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /saved/i.test(e))).toBe(true);
    expect(result.errors.some((e) => /Rename/i.test(e))).toBe(true);
  });

  it("rejects persisted decks under 40 main cards", () => {
    const result = evaluateAssistantEligibility(
      sampleDeck({
        name: "Legal Name",
        updated_at: "2026-09-08T00:00:00.000Z",
        mainDeck: padMain(20),
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /at least 40/i.test(e))).toBe(true);
  });

  it("accepts a persisted 40-card deck with no banlist conflicts", () => {
    const result = evaluateAssistantEligibility(
      sampleDeck({
        name: "Snake-Eye Core",
        updated_at: "2026-09-08T00:00:00.000Z",
        mainDeck: padMain(40),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("treats membership in savedDeckIds as persisted", () => {
    const deck = sampleDeck({
      name: "Saved Via Archives",
      mainDeck: padMain(40),
    });
    expect(isDeckPersisted(deck)).toBe(false);
    expect(isDeckPersisted(deck, new Set([deck.id]))).toBe(true);
  });
});

describe("buildFactsEnvelope diagnostics", () => {
  it("surfaces starter-density collision for legal-size low-role decks", () => {
    const facts = buildFactsEnvelope(
      sampleDeck({
        name: "Sparse Roles",
        updated_at: "2026-09-08T00:00:00.000Z",
        mainDeck: padMain(40).map((c) => ({
          ...c,
          desc: "A vanilla body with no tutoring effects.",
        })),
      }),
      { requirePersisted: true, savedDeckIds: new Set(["11111111-1111-1111-1111-111111111111"]) },
    );

    expect(facts.legality.ok).toBe(true);
    expect(facts.diagnostics.roleCoverage.starters).toBe(0);
    expect(
      facts.diagnostics.collisions.some((c) => c.code === "LOW_STARTER_DENSITY"),
    ).toBe(true);
  });

  it("counts search-text cards as starters in role coverage", () => {
    const facts = buildFactsEnvelope(
      sampleDeck({
        name: "Starter Heavy",
        updated_at: "2026-09-08T00:00:00.000Z",
        mainDeck: padMain(40),
      }),
    );
    expect(facts.diagnostics.roleCoverage.starters).toBeGreaterThan(0);
  });
});
