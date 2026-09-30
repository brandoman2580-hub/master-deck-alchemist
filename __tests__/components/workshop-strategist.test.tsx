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

  it("StrategistModeControl uses full inverse-text on every tab", () => {
    render(<StrategistModeControl value="auto" onChange={jest.fn()} />);
    for (const label of ["Auto", "Ask", "Tune", "Synergy", "Optimize"]) {
      expect(screen.getByRole("tab", { name: label })).toHaveClass(
        "text-mda-inverse-text",
      );
    }
  });

  it("StrategistInputBar uses light text, Open Sans body, and cyan-soft send", () => {
    const { container } = render(
      <StrategistInputBar
        value="hello"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    const input = screen.getByLabelText("Ask Strategist about your deck");
    expect(input).toHaveClass("font-open-sans", "text-mda-inverse-text");
    expect(input).toHaveClass("placeholder:font-mda");
    expect(screen.getByLabelText("Send message")).toHaveClass(
      "text-mda-cyan-soft",
    );
    const searchIcon = container.querySelector("svg");
    expect(searchIcon).toHaveClass("text-mda-inverse-text");
  });

  it("StrategistEmptyState shows logo and deck-focused copy", () => {
    render(<StrategistEmptyState />);
    expect(screen.getByTestId("strategist-empty-state")).toBeInTheDocument();
    expect(screen.getByAltText("Strategist logo")).toHaveAttribute(
      "src",
      "/images/ai_strategist_logo.png",
    );
    expect(
      screen.getByText(/Ask about your current deck/i),
    ).toBeInTheDocument();
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
    expect(screen.getByText("Strategist")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
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
    expect(screen.getAllByText("Strategist").length).toBeGreaterThanOrEqual(1);
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
    expect(cta).toHaveTextContent(/View Combos/i);
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
