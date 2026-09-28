import type { DeckType } from "@/types/types";
import type { FactsEnvelope } from "@/lib/engine/types";
import { emptyWorkshopGradeAxes } from "@/lib/engine/grade";

const mockBuildFactsEnvelope = jest.fn();
const mockLoadStrategyKnowledge = jest.fn();
const mockReadDeckAnalysisCache = jest.fn();
const mockUpsertDeckAnalysisCache = jest.fn();
const mockLoadMetaMatchupTemplates = jest.fn();
const mockLoadComboTemplates = jest.fn();
const mockRunConsistencySimulation = jest.fn();
const mockTagMainDeckForConsistency = jest.fn();
const mockScoreMatchupReadiness = jest.fn();
const mockCompileCombos = jest.fn();

jest.mock("@/lib/engine/build-facts", () => ({
  buildFactsEnvelope: (...args: unknown[]) => mockBuildFactsEnvelope(...args),
}));

jest.mock("@/lib/engine/facts-cache", () => ({
  loadStrategyKnowledge: (...args: unknown[]) =>
    mockLoadStrategyKnowledge(...args),
  readDeckAnalysisCache: (...args: unknown[]) =>
    mockReadDeckAnalysisCache(...args),
  upsertDeckAnalysisCache: (...args: unknown[]) =>
    mockUpsertDeckAnalysisCache(...args),
}));

jest.mock("@/lib/engine/meta-templates", () => ({
  loadMetaMatchupTemplates: (...args: unknown[]) =>
    mockLoadMetaMatchupTemplates(...args),
}));

jest.mock("@/lib/engine/combo-templates", () => ({
  loadComboTemplates: (...args: unknown[]) => mockLoadComboTemplates(...args),
}));

jest.mock("@/lib/engine/worker/client", () => ({
  runConsistencySimulation: (...args: unknown[]) =>
    mockRunConsistencySimulation(...args),
}));

jest.mock("@/lib/engine/tag-main-deck", () => ({
  tagMainDeckForConsistency: (...args: unknown[]) =>
    mockTagMainDeckForConsistency(...args),
}));

jest.mock("@/lib/engine/matchups", () => ({
  scoreMatchupReadiness: (...args: unknown[]) =>
    mockScoreMatchupReadiness(...args),
}));

jest.mock("@/lib/engine/combos", () => ({
  compileCombos: (...args: unknown[]) => mockCompileCombos(...args),
}));

function makeDeck(mainCount: number): DeckType {
  return {
    id: "deck-1",
    name: "Test Deck",
    mode: "Master Duel",
    mainDeck: Array.from({ length: mainCount }, (_, i) => ({
      id: i + 1,
      name: `Card ${i + 1}`,
    })),
    extraDeck: [],
    sideDeck: [],
  } as DeckType;
}

function makeFacts(partial?: Partial<FactsEnvelope>): FactsEnvelope {
  return {
    schemaVersion: "0.2.0",
    deckId: "deck-1",
    deckHash: "hash",
    format: "MASTER_DUEL",
    legality: { ok: true, errors: [] },
    diagnostics: {
      collisions: [],
      roleCoverage: {
        starters: 8,
        extenders: 6,
        handTraps: 6,
        boardBreakers: 3,
        endboardPieces: 3,
        locks: 0,
      },
      strategyFit: {
        primaryArchetype: "Snake-Eye",
        primaryStrategy: "Combo",
        secondaryStrategy: null,
        fitScore: 70,
        notes: [],
      },
      bosses: [],
      restrictions: [],
    },
    consistency: {
      n: 3000,
      starterAccess: 0.8,
      brickRate: 0.15,
      oneInterruptionSurvival: 0.55,
    },
    matchups: [
      {
        opponentArchetype: "Labrynth",
        starterAccessDelta: 0,
        brickRateDelta: 0,
        tagAdvantage: 0.2,
        notes: [],
      },
    ],
    combos: { lines: [], source: "template" },
    grade: {
      ...emptyWorkshopGradeAxes(),
      consistency: 80,
      power: 70,
      resilience: 65,
      disruption: 70,
      letter: "B",
      formatRulePack: "masterDuelMaxxC",
    },
    ...partial,
  };
}

describe("getFacts shared pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadStrategyKnowledge.mockResolvedValue({
      strategyWeights: [],
      archetypeStrategies: [],
    });
    mockReadDeckAnalysisCache.mockResolvedValue(null);
    mockUpsertDeckAnalysisCache.mockResolvedValue(undefined);
    mockTagMainDeckForConsistency.mockReturnValue([]);
    mockRunConsistencySimulation.mockResolvedValue({
      n: 3000,
      starterAccess: 0.8,
      brickRate: 0.15,
      oneInterruptionSurvival: 0.55,
    });
    mockLoadMetaMatchupTemplates.mockResolvedValue([]);
    mockScoreMatchupReadiness.mockReturnValue([]);
    mockLoadComboTemplates.mockResolvedValue([]);
    mockCompileCombos.mockReturnValue({ lines: [], source: "empty" });
  });

  it("returns null when main deck is under 40 cards", async () => {
    const { getFacts } = await import("@/lib/engine/get-facts");
    await expect(getFacts(makeDeck(20))).resolves.toBeNull();
    expect(mockBuildFactsEnvelope).not.toHaveBeenCalled();
  });

  it("returns cached envelope when consistency and combos are present", async () => {
    const cached = makeFacts();
    mockReadDeckAnalysisCache.mockResolvedValue(cached);
    const { getFacts } = await import("@/lib/engine/get-facts");
    const result = await getFacts(makeDeck(40), { readCache: true });
    expect(result).toBe(cached);
    expect(mockRunConsistencySimulation).not.toHaveBeenCalled();
  });

  it("ignores stale 0.1.0 cache missing grade breakdown", async () => {
    const stale = makeFacts({
      schemaVersion: "0.1.0",
      grade: {
        consistency: 80,
        power: 70,
        resilience: 65,
        disruption: 70,
        letter: "B",
      } as ReturnType<typeof makeFacts>["grade"],
    });
    mockReadDeckAnalysisCache.mockResolvedValue(stale);
    const full = makeFacts();
    mockBuildFactsEnvelope
      .mockReturnValueOnce(
        makeFacts({
          consistency: {
            n: 0,
            starterAccess: 0,
            brickRate: 0,
            oneInterruptionSurvival: 0,
          },
        }),
      )
      .mockReturnValueOnce(full);

    const { getFacts } = await import("@/lib/engine/get-facts");
    const result = await getFacts(makeDeck(40), {
      readCache: true,
      writeCache: true,
    });
    expect(result).toBe(full);
    expect(mockRunConsistencySimulation).toHaveBeenCalled();
  });

  it("runs consistency → matchups → combos and writes cache on miss", async () => {
    const base = makeFacts({
      consistency: {
        n: 0,
        starterAccess: 0,
        brickRate: 0,
        oneInterruptionSurvival: 0,
      },
      matchups: [],
      combos: { lines: [], source: "empty" },
    });
    const full = makeFacts();
    mockBuildFactsEnvelope
      .mockReturnValueOnce(base)
      .mockReturnValueOnce(full);

    const { getFacts } = await import("@/lib/engine/get-facts");
    const result = await getFacts(makeDeck(40), {
      writeCache: true,
      readCache: true,
    });

    expect(result).toBe(full);
    expect(mockRunConsistencySimulation).toHaveBeenCalled();
    expect(mockScoreMatchupReadiness).toHaveBeenCalled();
    expect(mockCompileCombos).toHaveBeenCalled();
    expect(mockUpsertDeckAnalysisCache).toHaveBeenCalledWith(full);
  });
});
