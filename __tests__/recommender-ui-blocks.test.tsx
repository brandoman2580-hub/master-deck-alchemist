/**
 * Phase 3 UI Blocks Component Tests
 * Tests for the RecommenderUIBlocks component
 */

import { render, screen } from "@testing-library/react";
import { RecommenderUIBlocks } from "../components/ui/recommender-ui-blocks";
import type { UIBlock, SuggestionContent } from "../types/recommender";
import type { Card } from "../types/card";

// Mock dependencies
jest.mock("../store/cardStore", () => ({
  useCardStore: jest.fn(() => ({
    getCardById: jest.fn((id: number) => ({
      id,
      name: `Card ${id}`,
      type: "Effect Monster",
      desc: "Test card description",
    })),
  })),
}));

jest.mock("../components/ui/card-preview", () => ({
  CardPreview: ({ card }: { card: Card }) => (
    <div data-testid={`card-preview-${card.id}`}>{card.name}</div>
  ),
}));

describe("RecommenderUIBlocks", () => {
  const mockCards: Card[] = [
    {
      id: 123,
      name: "Ash Blossom & Joyous Spring",
      type: "Effect Monster",
      desc: "When a card or effect is activated...",
    } as Card,
    {
      id: 456,
      name: "Maxx C",
      type: "Effect Monster",
      desc: "During either player's turn...",
    } as Card,
  ];

  describe("Text Block Rendering", () => {
    it("should render text block with markdown", () => {
      const blocks: UIBlock[] = [
        {
          id: "text-1",
          type: "text",
          content: "This is a **bold** text block",
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.getByText(/This is a/)).toBeInTheDocument();
    });

    it("should handle plain text content", () => {
      const blocks: UIBlock[] = [
        {
          id: "text-2",
          type: "text",
          content: "Plain text without markdown",
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.getByText("Plain text without markdown")).toBeInTheDocument();
    });
  });

  describe("List Block Rendering", () => {
    it("should render list block with array of strings", () => {
      const blocks: UIBlock[] = [
        {
          id: "list-1",
          type: "list",
          content: ["Item 1", "Item 2", "Item 3"],
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
    });

    it("should handle single string as list", () => {
      const blocks: UIBlock[] = [
        {
          id: "list-2",
          type: "list",
          content: "Single item",
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.getByText("Single item")).toBeInTheDocument();
    });
  });

  describe("Card Block Rendering", () => {
    it("should render card preview for valid card ID", () => {
      const blocks: UIBlock[] = [
        {
          id: "card-1",
          type: "card",
          content: "123",
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.getByTestId("card-preview-123")).toBeInTheDocument();
    });

    it("should not render for invalid card ID", () => {
      const blocks: UIBlock[] = [
        {
          id: "card-2",
          type: "card",
          content: "999",
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.queryByTestId("card-preview-999")).not.toBeInTheDocument();
    });
  });

  describe("Table Block Rendering", () => {
    it("should render table from object content", () => {
      const blocks: UIBlock[] = [
        {
          id: "table-1",
          type: "table",
          content: {
            "Card Name": "Ash Blossom",
            "Type": "Hand Trap",
            "Synergy": "High",
          },
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.getByText("Card Name")).toBeInTheDocument();
      expect(screen.getByText("Ash Blossom")).toBeInTheDocument();
    });
  });

  describe("Suggestion Block Rendering", () => {
    it("should render suggestion block with apply action", () => {
      const onApply = jest.fn();
      const suggestionContent: SuggestionContent = {
        suggestionId: "sug-1",
        cardId: "123",
        verb: "apply",
        label: "Add Ash Blossom to deck",
      };

      const blocks: UIBlock[] = [
        {
          id: "suggestion-1",
          type: "suggestion",
          content: suggestionContent,
        },
      ];

      const recommendations = [
        {
          cardId: "123",
          cardName: "Ash Blossom & Joyous Spring",
          action: "add",
          reason: "Excellent hand trap",
          impactEst: 0.9,
          synergyScore: 0.8,
          evidence: [],
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          recommendations={recommendations}
          allCards={mockCards}
          onApplySuggestion={onApply}
        />
      );

      expect(screen.getByText("Add Ash Blossom to deck")).toBeInTheDocument();
      expect(screen.getByText("Excellent hand trap")).toBeInTheDocument();
    });

    it("should render suggestion block with preview action", () => {
      const onPreview = jest.fn();
      const suggestionContent: SuggestionContent = {
        suggestionId: "sug-2",
        cardId: "456",
        verb: "preview",
        label: "Preview Maxx C",
      };

      const blocks: UIBlock[] = [
        {
          id: "suggestion-2",
          type: "suggestion",
          content: suggestionContent,
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
          onPreviewSuggestion={onPreview}
        />
      );

      expect(screen.getByText("Preview Maxx C")).toBeInTheDocument();
    });

    it("should show ban status when card is banned", () => {
      const suggestionContent: SuggestionContent = {
        suggestionId: "sug-3",
        cardId: "123",
        verb: "apply",
        label: "Add banned card",
      };

      const blocks: UIBlock[] = [
        {
          id: "suggestion-3",
          type: "suggestion",
          content: suggestionContent,
        },
      ];

      const recommendations = [
        {
          cardId: "123",
          action: "add",
          reason: "Test",
          impactEst: 0.5,
          evidence: [],
          banned: true,
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          recommendations={recommendations}
          allCards={mockCards}
        />
      );

      expect(screen.getByText(/banned/i)).toBeInTheDocument();
    });
  });

  describe("Multiple Blocks", () => {
    it("should render multiple blocks in order", () => {
      const blocks: UIBlock[] = [
        {
          id: "text-1",
          type: "text",
          content: "First block",
        },
        {
          id: "list-1",
          type: "list",
          content: ["Item 1", "Item 2"],
        },
        {
          id: "text-2",
          type: "text",
          content: "Second block",
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.getByText("First block")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Second block")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty blocks array", () => {
      render(
        <RecommenderUIBlocks
          blocks={[]}
          allCards={mockCards}
        />
      );

      // Should render without errors
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it("should handle unknown block type gracefully", () => {
      const blocks: UIBlock[] = [
        {
          id: "unknown-1",
          type: "unknown" as any,
          content: "Test",
        },
      ];

      render(
        <RecommenderUIBlocks
          blocks={blocks}
          allCards={mockCards}
        />
      );

      expect(screen.getByText(/Unknown block type/i)).toBeInTheDocument();
    });
  });
});


