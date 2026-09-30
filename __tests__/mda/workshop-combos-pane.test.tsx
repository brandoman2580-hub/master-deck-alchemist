import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { WorkshopCombosPane } from "@/components/mda/workshop-combos-pane";
import { FACTS_SCHEMA_VERSION, emptyWorkshopGradeAxes, type FactsEnvelope } from "@/lib/engine";

jest.mock("@/context/deck-context", () => ({
  useDeck: () => ({
    currentDeck: {
      id: "deck-1",
      name: "Snake",
      deckFormat: "Master Duel",
      updated_at: "2026-09-08T00:00:00.000Z",
      mainDeck: [
        {
          id: 1,
          name: "Snake-Eye Ash",
          deckInstanceId: "a",
          type: "Effect Monster",
          desc: "",
          race: "Pyro",
          misc_info: [{ md_rarity: "N" }],
          card_sets: {},
          card_images: [],
          card_prices: [],
        },
      ],
      extraDeck: [
        {
          id: 2,
          name: "Diabellstar the Black Witch",
          deckInstanceId: "b",
          type: "Effect Monster",
          desc: "",
          race: "Spellcaster",
          misc_info: [{ md_rarity: "UR" }],
          card_sets: {},
          card_images: [],
          card_prices: [],
        },
      ],
      sideDeck: [],
    },
  }),
}));

jest.mock("@/lib/api/comboCompiler", () => ({
  explainComboLine: jest.fn(),
}));

function sampleFacts(): FactsEnvelope {
  return {
    schemaVersion: FACTS_SCHEMA_VERSION,
    deckId: "deck-1",
    deckHash: "hash",
    format: "MASTER_DUEL",
    legality: { ok: true, errors: [] },
    diagnostics: {
      collisions: [],
      roleCoverage: {
        starters: 1,
        extenders: 0,
        handTraps: 0,
        boardBreakers: 0,
        endboardPieces: 1,
        locks: 0,
      },
      strategyFit: {
        primaryArchetype: "Snake-Eye",
        primaryStrategy: "Combo",
        secondaryStrategy: null,
        fitScore: 80,
        notes: [],
      },
      bosses: [],
      restrictions: [],
    },
    consistency: {
      n: 0,
      starterAccess: 0,
      brickRate: 0,
      oneInterruptionSurvival: 0,
    },
    matchups: [],
    combos: {
      source: "template",
      lines: [
        {
          id: "line-1",
          name: "Poplar Line",
          killers: ["Ash Blossom & Joyous Spring"],
          endboardSummary: "Diabellstar end",
          nodes: [
            { id: "h1", label: "Hand", cardIds: [1], kind: "hand" },
            { id: "s1", label: "Step", cardIds: [1], kind: "step" },
            { id: "e1", label: "End", cardIds: [2], kind: "endboard" },
          ],
          edges: [
            { from: "h1", to: "s1" },
            { from: "s1", to: "e1" },
          ],
        },
      ],
    },
    grade: {
      ...emptyWorkshopGradeAxes(),
      consistency: 50,
      power: 50,
      resilience: 50,
      disruption: 50,
      letter: "C",
      formatRulePack: "masterDuelMaxxC",
    },
  };
}

describe("facts_brain_phase3 combo seed migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260908020000_facts_brain_phase3_combo_templates.sql",
    ),
    "utf8",
  );

  it("seeds combo_templates for both formats", () => {
    expect(sql).toContain("INSERT INTO combo_templates");
    expect(sql).toContain("Snake-Eye");
    expect(sql).toContain("CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL'))");
  });
});

describe("WorkshopCombosPane", () => {
  it("shows empty guidance when facts are missing", () => {
    render(<WorkshopCombosPane facts={null} loading={false} />);
    expect(
      screen.getByText(/Build a 40\+ card main deck/i),
    ).toBeInTheDocument();
  });

  it("renders validated combo lines from facts", () => {
    render(<WorkshopCombosPane facts={sampleFacts()} loading={false} />);
    expect(screen.getByText("Poplar Line")).toBeInTheDocument();
    expect(screen.getByText("Ash Blossom & Joyous Spring")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Explain selected combo line/i }),
    ).toBeInTheDocument();
  });
});
