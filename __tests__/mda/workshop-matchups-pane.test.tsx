import { fireEvent, render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { WorkshopMatchupsPane } from "@/components/mda/workshop-matchups-pane";
import type { FactsEnvelope } from "@/lib/engine";
import { DECK_SCORE_VERSION } from "@/lib/meta/deck-score";
import type { MetaGateBands } from "@/lib/meta/gate-bands";
import { FACTS_SCHEMA_VERSION, emptyWorkshopGradeAxes } from "@/lib/engine";

expect.extend(toHaveNoViolations);

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
      restrictions: [],
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
        opponentStrategy: "Combo",
        disruptionScore: 0.12,
        consistencyScore: 0.4,
        notes: ["Strong starter access supports proactive lines"],
      },
      {
        opponentArchetype: "Labrynth",
        tier: "2",
        starterAccessDelta: -0.15,
        brickRateDelta: 0.05,
        tagAdvantage: -0.4,
        opponentStrategy: "Control",
        disruptionScore: -0.22,
        consistencyScore: -0.08,
        notes: ["Low hand-trap density vs combo-leaning meta deck"],
      },
    ],
    combos: { lines: [], source: "empty" },
    grade: {
      ...emptyWorkshopGradeAxes(),
      consistency: 78,
      power: 60,
      resilience: 65,
      disruption: 70,
      letter: "B",
      formatRulePack: "masterDuelMaxxC",
    },
  };
}

describe("WorkshopMatchupsPane", () => {
  it("prompts to build a legal main when facts are absent", () => {
    render(<WorkshopMatchupsPane facts={null} loading={false} />);
    expect(screen.getByText(/Build a 40\+ card main deck/i)).toBeInTheDocument();
  });

  it("shows the five-gate score and waits for stored meta scores", () => {
    render(<WorkshopMatchupsPane facts={sampleFacts()} loading={false} />);

    expect(screen.getByRole("columnheader", { name: "Your deck" })).toBeInTheDocument();
    expect(screen.getByText("Consistency")).toBeInTheDocument();
    expect(screen.getByText("Resilience")).toBeInTheDocument();
    expect(screen.getByText("Interaction")).toBeInTheDocument();
    expect(screen.getByText("Ceiling")).toBeInTheDocument();
    expect(screen.getByText("Outing")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getAllByText("50").length).toBeGreaterThan(0);
    expect(screen.getByText(/Stored meta scores are not current/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tearlaments" })).not.toBeInTheDocument();
    expect(screen.queryByText("Win Rate", { exact: true })).not.toBeInTheDocument();
  });

  it("compares one tier at a time against this list", async () => {
    const bands: MetaGateBands = {
      ceiling: { tier1: 2, tier2: 1, tier3: 1 },
      floor: { tier1: 0.6, tier2: 0.5, tier3: 0.4 },
      nonEngine: { tier1: 12, tier2: 9, tier3: 6 },
      sampleIterations: 3000,
      listCounts: { 1: 1, 2: 1, 3: 0 },
      scoreVersion: DECK_SCORE_VERSION,
      decks: [
        {
          name: "Elfnote",
          tier: 1,
          consistency: 100,
          resilience: 100,
          interaction: 55,
          ceiling: 80,
          outing: 20,
          composite: 78,
          ceilingMode: "endboard",
          letter: "B",
        },
        {
          name: "Invoked",
          tier: 2,
          consistency: 90,
          resilience: 70,
          interaction: 40,
          ceiling: 40,
          outing: 10,
          composite: 58,
          ceilingMode: "endboard",
          letter: "C",
        },
      ],
    };
    const { container } = render(
      <WorkshopMatchupsPane
        facts={sampleFacts()}
        loading={false}
        referenceBands={bands}
        userCards={[{ name: "Ash Blossom & Joyous Spring", zone: "main" }]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Elfnote" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Invoked" })).not.toBeInTheDocument();
    expect(screen.queryByText("You")).not.toBeInTheDocument();
    expect(screen.queryByText(/ahead of you/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("20 higher than this list").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Ash Blossom can stop Branded Fusion/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Win Rate", { exact: true })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Tier 2/ }));
    expect(screen.queryByRole("columnheader", { name: "Elfnote" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Invoked" })).toBeInTheDocument();
    expect(screen.getAllByText("10 lower than this list").length).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("scrolls one column when the sheet has keyboard focus", () => {
    const bands: MetaGateBands = {
      ceiling: { tier1: 2, tier2: null, tier3: null },
      floor: { tier1: 0.6, tier2: null, tier3: null },
      nonEngine: { tier1: 12, tier2: null, tier3: null },
      sampleIterations: 3000,
      listCounts: { 1: 1, 2: 0, 3: 0 },
      scoreVersion: DECK_SCORE_VERSION,
      decks: [
        {
          name: "Elfnote",
          tier: 1,
          consistency: 100,
          resilience: 100,
          interaction: 55,
          ceiling: 80,
          outing: 20,
          composite: 78,
          ceilingMode: "endboard",
          letter: "B",
        },
      ],
    };
    const { container } = render(
      <WorkshopMatchupsPane facts={sampleFacts()} loading={false} referenceBands={bands} />,
    );
    const scroller = container.querySelector("[aria-label*='Scroll sideways']");
    expect(scroller).toBeInstanceOf(HTMLElement);
    const scrollBy = jest.fn();
    (scroller as HTMLElement).scrollBy = scrollBy;
    fireEvent.keyDown(scroller as HTMLElement, { key: "ArrowRight" });
    fireEvent.keyDown(scroller as HTMLElement, { key: "ArrowLeft" });
    expect(scrollBy).toHaveBeenNthCalledWith(1, { left: 144 });
    expect(scrollBy).toHaveBeenNthCalledWith(2, { left: -144 });
  });

  it("keeps a failed load distinct from a stale banlist", () => {
    render(
      <WorkshopMatchupsPane
        facts={sampleFacts()}
        loading={false}
        bandsError="Stored meta scores could not be loaded."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i);
    expect(screen.queryByText(/not current/i)).not.toBeInTheDocument();
  });

  it("does not call stored scores stale while they are still loading", () => {
    render(<WorkshopMatchupsPane facts={sampleFacts()} loading={false} bandsLoading />);
    expect(screen.getByText(/Loading stored meta scores/i)).toBeInTheDocument();
    expect(screen.queryByText(/not current/i)).not.toBeInTheDocument();
  });

  it("has no axe violations on the populated sheet", async () => {
    const { container } = render(
      <WorkshopMatchupsPane facts={sampleFacts()} loading={false} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
