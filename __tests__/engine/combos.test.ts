import { readFileSync } from "fs";
import { join } from "path";
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
    expect(line!.nodes.find((n) => n.id === "h1")?.lane).toBe("hand");
    expect(line!.nodes.some((n) => n.cardName === "Ash Blossom & Joyous Spring" && n.lane === "interrupt")).toBe(true);
    expect(line!.edges.every((edge) => edge.relation === "play")).toBe(true);
  });

  it("keeps opponent interruptions when those cards are not in the deck", () => {
    const line = validateComboTemplate(
      {
        ...snakeTemplate,
        killers: [],
        graph: {
          ...snakeTemplate.graph,
          nodes: [
            ...snakeTemplate.graph.nodes,
            {
              id: "ash",
              label: "Ash",
              cardNames: ["Ash Blossom & Joyous Spring"],
              kind: "interruption",
              lane: "interrupt",
              required: false,
            },
          ],
          edges: [
            ...snakeTemplate.graph.edges,
            { from: "ash", to: "s1", relation: "interrupts" as const },
          ],
        },
      },
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
    const ash = line!.nodes.find((node) => node.id === "ash");
    expect(ash?.cardIds).toEqual([]);
    expect(ash?.cardName).toBe("Ash Blossom & Joyous Spring");
    expect(line!.edges.find((edge) => edge.from === "ash")?.relation).toBe("interrupts");
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

describe("Purrely Sleepy Memory migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261028003444_purrely_sleepy_memory_combo_graph.sql"),
    "utf8",
  );

  it("rewrites only the Purrely Sleepy Memory line with lanes and relations", () => {
    expect(sql).toContain("archetype_name = 'Purrely'");
    expect(sql).toContain("name = 'Purrely Sleepy Memory Line'");
    expect(sql).toContain('"lane":"material"');
    expect(sql).toContain('"relation":"interrupts"');
    expect(sql).toContain('"relation":"material"');
    expect(sql).toContain("Purrelyeap!?");
    expect(sql).not.toContain("Snake-Eye");
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
