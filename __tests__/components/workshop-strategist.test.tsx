/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { EvidenceDisclosure } from "@/components/mda/workshop-strategist/EvidenceDisclosure";
import { TuningActionRow } from "@/components/mda/workshop-strategist/TuningActionRow";
import { RecommendationCard } from "@/components/mda/workshop-strategist/RecommendationCard";
import { StrategistModeControl } from "@/components/mda/workshop-strategist/StrategistModeControl";
import { StrategistInputBar } from "@/components/mda/workshop-strategist/StrategistInputBar";
import { StrategistThread } from "@/components/mda/workshop-strategist/StrategistThread";
import { StrategistEmptyState } from "@/components/mda/workshop-strategist/StrategistEmptyState";
import { applyMainCopyTarget } from "@/components/mda/workshop-strategist/apply-tuning";
import type { Card } from "@/types/card";
import type { DeckType } from "@/types/deck";
import type { StrategistMessage } from "@/components/mda/workshop-strategist/types";

expect.extend(toHaveNoViolations);

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} src={props.src} />
  ),
}));

jest.mock("@/store/cardStore", () => ({
  useCardStore: (selector: (s: { cardList: Card[] }) => unknown) =>
    selector({ cardList: [] }),
}));

jest.mock("@/context/deck-context", () => ({
  useDeck: () => ({
    currentDeck: {
      id: "test-deck",
      name: "Test Deck",
      mainDeck: [],
      extraDeck: [],
      sideDeck: [],
      deckFormat: "Master Duel",
      isPinned: false,
    },
    banlist: {},
  }),
}));

describe("Workshop Strategist UI", () => {
  it("EvidenceDisclosure and TuningActionRow have no axe violations", async () => {
    const onApply = jest.fn();
    const { container } = render(
      <div>
        <TuningActionRow
          recommendation={{
            cardId: "100",
            fromCopies: 3,
            toCopies: 2,
            changeReason: "Too many bricks",
            evidenceIds: ["consistency.brickRate"],
          }}
          cardName="Ash Blossom"
          applied={false}
          onApply={onApply}
        />
        <EvidenceDisclosure
          limitations={["Sample limitation"]}
          evidence={[
            {
              claim: "Brick rate elevated",
              evidenceIds: ["consistency.brickRate"],
            },
          ]}
        />
      </div>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("StrategistModeControl switches modes", () => {
    const onChange = jest.fn();
    render(<StrategistModeControl value="auto" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Tune" }));
    expect(onChange).toHaveBeenCalledWith("tune_copies");
  });

  it("StrategistModeControl marks the active mode with the ice edge", () => {
    render(<StrategistModeControl value="qa" onChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: "Ask" })).toHaveClass("border-b-[#bfe5f3]");
    expect(screen.getByRole("tab", { name: "Tune" })).toHaveClass("text-[#8a96a6]");
    expect(screen.getByRole("tab", { name: "Ask" })).toHaveClass("hover:bg-[#e2e8f0]");
  });

  it("StrategistInputBar uses the dark field and a send control", () => {
    render(
      <StrategistInputBar
        value="hello"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    const input = screen.getByLabelText("Ask Strategist about your deck");
    expect(input).toHaveAttribute("placeholder", "Ask about this deck...");
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
  });

  it("StrategistEmptyState shows the crucible and deck starters", async () => {
    const onStarter = jest.fn();
    const { container } = render(
      <StrategistEmptyState
        deckName="Pure Darkness"
        shortPillar="Resilience"
        onStarter={onStarter}
      />,
    );
    expect(screen.getByTestId("strategist-empty-state")).toBeInTheDocument();
    const crucible = screen.getByTestId("strategist-crucible");
    expect(crucible).toBeInTheDocument();
    expect(crucible.querySelectorAll("path[stroke='#14181f']")).toHaveLength(3);
    expect(crucible.innerHTML).toContain("M12.24 7.24H51.66L38.35 56.7H25.55Z");
    expect(crucible.innerHTML).toContain("M31.95 21.98V56.7");
    expect(crucible).toHaveClass("h-40", "w-40");
    const status = screen.getByRole("heading", { level: 2, name: /Strategist/ });
    expect(status).toHaveTextContent(/Online/);
    expect(status).toHaveClass("text-2xl");
    expect(screen.getByText("Pure Darkness")).toBeInTheDocument();
    expect(screen.getByText(/Deck list:/)).toBeInTheDocument();
    expect(
      screen.getByText("Ask about this deck list, tune copies, or find a card that fits."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Why is Resilience the lowest score?" }));
    expect(onStarter).toHaveBeenCalledWith("Why is Resilience the lowest score?", "qa");
    fireEvent.click(screen.getByRole("button", { name: "Trim the main deck for consistency" }));
    expect(onStarter).toHaveBeenCalledWith("Trim the main deck for consistency", "tune_copies");
    fireEvent.click(screen.getByRole("button", { name: "Find a card this deck list is missing" }));
    expect(onStarter).toHaveBeenCalledWith("Find a card this deck list is missing", "discover_synergy");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("StrategistThread scrolls to bottom when a new bubble is added", () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const base: StrategistMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Trim to 40",
        timestamp: new Date(),
      },
    ];

    const { rerender } = render(
      <StrategistThread
        messages={base}
        onApplyTuning={jest.fn()}
        onAddSynergy={jest.fn()}
      />,
    );

    expect(screen.getByTestId("strategist-thread-scroll")).toBeInTheDocument();
    expect(screen.getByText("Trim to 40")).toBeInTheDocument();
    expect(screen.queryByText("You")).not.toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();

    scrollIntoView.mockClear();
    rerender(
      <StrategistThread
        messages={[
          ...base,
          {
            id: "2",
            role: "assistant",
            content: "Pitch Crimson Gaia first.",
            timestamp: new Date(),
          },
        ]}
        onApplyTuning={jest.fn()}
        onAddSynergy={jest.fn()}
      />,
    );
    expect(screen.getByText("Pitch Crimson Gaia first.")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("shows View Combos soft CTA and calls onOpenWorkshopTab", () => {
    const onOpen = jest.fn();
    render(
      <StrategistThread
        messages={[
          {
            id: "u1",
            role: "user",
            content: "How should I play into endboard?",
            timestamp: new Date(),
          },
          {
            id: "a1",
            role: "assistant",
            content:
              "Primary line: Resonator Core → Red Dragon Archfiend endboard.",
            timestamp: new Date(),
            redirectHint: "workshop_combos",
          },
        ]}
        onApplyTuning={jest.fn()}
        onAddSynergy={jest.fn()}
        onOpenWorkshopTab={onOpen}
      />,
    );

    const cta = screen.getByTestId("workshop-tab-cta");
    expect(cta).toHaveTextContent("Combos");
    expect(screen.getByText("Open tab")).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onOpen).toHaveBeenCalledWith("combos");
  });

  it("shows View Matchups soft CTA for workshop_matchups hint", () => {
    const onOpen = jest.fn();
    render(
      <StrategistThread
        messages={[
          {
            id: "a2",
            role: "assistant",
            content: "Worst tagged matchups: Snake-Eye (T1).",
            timestamp: new Date(),
            redirectHint: "workshop_matchups",
          },
        ]}
        onApplyTuning={jest.fn()}
        onAddSynergy={jest.fn()}
        onOpenWorkshopTab={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Matchups tab/i }));
    expect(onOpen).toHaveBeenCalledWith("matchups");
  });

  it("hides workshop CTA when Facts hint is absent", () => {
    render(
      <StrategistThread
        messages={[
          {
            id: "a3",
            role: "assistant",
            content: "Matchup tags are thin for this list.",
            timestamp: new Date(),
          },
        ]}
        onApplyTuning={jest.fn()}
        onAddSynergy={jest.fn()}
        onOpenWorkshopTab={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("workshop-tab-cta")).not.toBeInTheDocument();
  });

  it("RecommendationCard renders role tag, effect bullets, and ADD TO DECK", () => {
    const onAdd = jest.fn();
    const card = {
      id: 42,
      name: "Gameciel, the Sea Turtle Kaiju",
      type: "Effect Monster",
    } as Card;
    render(
      <RecommendationCard
        title="Gameciel, the Sea Turtle Kaiju"
        roleTag="BOARD BREAKER"
        effectLines={[
          "Special Summon to opponent's field by Tributing 1 monster they control",
        ]}
        card={card}
        onAdd={onAdd}
      />,
    );
    expect(
      screen.getByText("Gameciel, the Sea Turtle Kaiju"),
    ).toBeInTheDocument();
    expect(screen.getByText("BOARD BREAKER")).toBeInTheDocument();
    expect(
      screen.getByText(/Special Summon to opponent's field/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Add Gameciel/i));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("applyMainCopyTarget removes main copies toward target", () => {
    const card = { id: 7, name: "Test Card", type: "Effect Monster" } as Card;
    const deck: DeckType = {
      id: "d1",
      name: "Saved",
      deckFormat: "Master Duel",
      mainDeck: [
        { ...card, deckInstanceId: "a" },
        { ...card, deckInstanceId: "b" },
        { ...card, deckInstanceId: "c" },
      ],
      extraDeck: [],
      sideDeck: [],
    };
    const removed: string[] = [];
    const added: Card[] = [];
    applyMainCopyTarget({
      deck,
      card,
      toCopies: 1,
      addCardToDeck: (c) => added.push(c),
      removeCardFromDeck: (id) => removed.push(id),
    });
    expect(removed).toEqual(["a", "b"]);
    expect(added).toHaveLength(0);
  });
});
