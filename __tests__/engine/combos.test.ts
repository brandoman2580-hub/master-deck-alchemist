import {
  compileCombos,
  compileFallbackLine,
  selectTemplatesForArchetype,
  validateComboTemplate,
  type ComboTemplateRow,
  type DeckCardRef,
} from "@/lib/engine/combos";

const snakeTemplate: ComboTemplateRow = {
  id: "tmpl-snake",
  archetypeName: "Snake-Eye",
  format: "MASTER_DUEL",
  name: "Poplar Line",
  bosses: ["Diabellstar the Black Witch"],
  killers: ["Ash Blossom & Joyous Spring"],
  graph: {
    endboardSummary: "Diabellstar end",
    nodes: [
      {
        id: "h1",
        label: "Ash",
        cardNames: ["Snake-Eye Ash"],
        kind: "hand",
        required: true,
      },
      {
        id: "s1",
        label: "Diabellstar",
        cardNames: ["Diabellstar the Black Witch"],
        kind: "step",
        required: true,
      },
      {
        id: "e1",
        label: "Close",
        cardNames: ["Diabellstar the Black Witch"],
        kind: "endboard",
        required: true,
      },
    ],
    edges: [
      { from: "h1", to: "s1" },
      { from: "s1", to: "e1" },
    ],
  },
};

function deckWith(...names: string[]): DeckCardRef[] {
  return names.map((name, i) => ({
    id: 1000 + i,
    name,
    zone: i > 4 ? ("extra" as const) : ("main" as const),
  }));
}

describe("validateComboTemplate", () => {
  it("accepts a line when required cards are present", () => {
    const line = validateComboTemplate(
      snakeTemplate,
      deckWith(
        "Snake-Eye Ash",
        "Filler A",
        "Filler B",
        "Filler C",
        "Filler D",
        "Diabellstar the Black Witch",
      ),
    );
    expect(line).not.toBeNull();
    expect(line!.name).toBe("Poplar Line");
    expect(line!.nodes.find((n) => n.id === "h1")?.cardIds).toEqual([1000]);
  });

  it("rejects a line when a required starter is missing", () => {
    const line = validateComboTemplate(
      snakeTemplate,
      deckWith("Random Card", "Diabellstar the Black Witch"),
    );
    expect(line).toBeNull();
  });
});

describe("selectTemplatesForArchetype", () => {
  it("prefers exact archetype matches", () => {
    const branded: ComboTemplateRow = {
      ...snakeTemplate,
      id: "tmpl-branded",
      archetypeName: "Branded",
      name: "Fusion",
    };
    const selected = selectTemplatesForArchetype(
      [snakeTemplate, branded],
      "Snake-Eye",
      "MASTER_DUEL",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]!.archetypeName).toBe("Snake-Eye");
  });
});

describe("compileCombos", () => {
  it("returns template source when a curated line validates", () => {
    const result = compileCombos({
      format: "MASTER_DUEL",
      archetype: "Snake-Eye",
      deckCards: deckWith(
        "Snake-Eye Ash",
        "A",
        "B",
        "C",
        "D",
        "Diabellstar the Black Witch",
      ),
      templates: [snakeTemplate],
      bosses: [{ cardId: 1005, name: "Diabellstar the Black Witch" }],
    });
    expect(result.source).toBe("template");
    expect(result.lines).toHaveLength(1);
  });

  it("falls back to compiled core line when templates miss", () => {
    const mains = Array.from({ length: 40 }, (_, i) => ({
      id: 2000 + i,
      name: `Main ${i}`,
      zone: "main" as const,
    }));
    const result = compileCombos({
      format: "TCG",
      archetype: "Unknown",
      deckCards: [
        ...mains,
        { id: 9001, name: "Boss Monster", zone: "extra" },
      ],
      templates: [snakeTemplate],
      bosses: [{ cardId: 9001, name: "Boss Monster" }],
      starterNames: ["Main 0"],
    });
    expect(result.source).toBe("compiled");
    expect(result.lines[0]!.id).toBe("compiled-fallback");
  });
});

describe("compileFallbackLine", () => {
  it("returns null when main deck is too small", () => {
    expect(
      compileFallbackLine(
        deckWith("A", "B"),
        [{ cardId: 1, name: "Boss" }],
        [],
      ),
    ).toBeNull();
  });
});
