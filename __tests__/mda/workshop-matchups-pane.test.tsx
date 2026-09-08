import { render, screen } from "@testing-library/react";
import { WorkshopMatchupsPane } from "@/components/mda/workshop-matchups-pane";
import type { FactsEnvelope } from "@/lib/engine";
import { FACTS_SCHEMA_VERSION } from "@/lib/engine";

function sampleFacts(): FactsEnvelope {
  return {
    schemaVersion: FACTS_SCHEMA_VERSION,
    deckId: "11111111-1111-1111-1111-111111111111",
    deckHash: "abcd1234",
    format: "MASTER_DUEL",
    legality: { ok: true, errors: [] },
    diagnostics: {
      collisions: [],
      roleCoverage: {
        starters: 10,
        extenders: 6,
        handTraps: 9,
        boardBreakers: 3,
        endboardPieces: 2,
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
    },
    consistency: {
      n: 3000,
      starterAccess: 0.8,
      brickRate: 0.1,
      oneInterruptionSurvival: 0.5,
    },
    matchups: [
      {
        opponentArchetype: "Tearlaments",
        tier: "1",
        starterAccessDelta: 0.2,
        brickRateDelta: 0.1,
        tagAdvantage: 0.25,
        notes: ["Strong starter access supports proactive lines"],
      },
      {
        opponentArchetype: "Labrynth",
        tier: "2",
        starterAccessDelta: 0.1,
        brickRateDelta: 0,
        tagAdvantage: -0.1,
        notes: [],
      },
    ],
    combos: { lines: [], source: "empty" },
    grade: {
      consistency: 78,
      power: 60,
      resilience: 65,
      disruption: 70,
      letter: "B",
    },
  };
}

describe("WorkshopMatchupsPane", () => {
  it("prompts to build a legal main when facts are absent", () => {
    render(
      <WorkshopMatchupsPane facts={null} loading={false} />,
    );
    expect(
      screen.getByText(/Build a 40\+ card main deck/i),
    ).toBeInTheDocument();
  });

  it("renders consistency metrics and matchup readiness from facts", () => {
    render(
      <WorkshopMatchupsPane facts={sampleFacts()} loading={false} />,
    );
    expect(screen.getByText("Starter Access")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("Tearlaments")).toBeInTheDocument();
    expect(screen.getByText("Avg Readiness")).toBeInTheDocument();
    expect(screen.getByLabelText("Show Tier 1")).toBeInTheDocument();
  });
});
