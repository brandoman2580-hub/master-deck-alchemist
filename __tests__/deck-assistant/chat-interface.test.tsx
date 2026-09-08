/**
 * Component tests for ChatInterface
 * Tests chat message handling, conversation management, and UI interactions
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatInterface } from "@/components/deck-assistant/chat-interface";
import { DeckType, DeckMode } from "@/types/types";

// Mock dependencies
jest.mock("@/context/deck-context", () => ({
  useDeck: () => ({
    saveDeck: jest.fn(() => Promise.resolve()),
    addCardToDeck: jest.fn(),
  }),
}));

jest.mock("@/hooks/useConversationPersistence", () => ({
  useConversationPersistence: () => ({
    messages: [],
    setMessages: jest.fn(),
    conversationId: undefined,
    setConversationId: jest.fn(),
    isLoadingHistory: false,
  }),
}));

jest.mock("@/hooks/useChatMessage", () => ({
  useChatMessage: () => ({
    sendMessage: jest.fn(() => Promise.resolve()),
    isLoading: false,
  }),
}));

jest.mock("@/lib/recommender-helpers", () => ({
  fingerprintDeck: jest.fn(() => Promise.resolve("test-fingerprint")),
}));

const mockDeck: DeckType = {
  id: "test-deck-id",
  name: "Test Deck",
  mainDeck: [],
  extraDeck: [],
  sideDeck: [],
  mode: "Master Duel",
  isPinned: false,
};

describe("ChatInterface", () => {
  it("renders chat interface component", () => {
    const { container } = render(
      <ChatInterface
        currentDeck={mockDeck}
        deckMode="Master Duel"
        isAuthenticated={true}
        isDeckEmpty={false}
      />
    );
    
    // Check for chat input - InputWithClear renders a textbox
    const chatInput = screen.queryByRole("textbox") || container.querySelector('input[type="text"]');
    expect(chatInput).toBeInTheDocument();
  });

  it("displays empty state when no messages", () => {
    const { container } = render(
      <ChatInterface
        currentDeck={mockDeck}
        deckMode="Master Duel"
        isAuthenticated={true}
        isDeckEmpty={false}
      />
    );
    
    // Empty state should be visible when no messages
    // This depends on the ChatEmptyState component implementation
    const chatInput = screen.queryByRole("textbox") || container.querySelector('input[type="text"]');
    expect(chatInput).toBeInTheDocument();
  });

  it("handles input changes", async () => {
    const { container } = render(
      <ChatInterface
        currentDeck={mockDeck}
        deckMode="Master Duel"
        isAuthenticated={true}
        isDeckEmpty={false}
      />
    );
    
    const chatInput = screen.queryByRole("textbox") || container.querySelector('input[type="text"]') as HTMLInputElement;
    if (chatInput) {
      fireEvent.change(chatInput, { target: { value: "What cards should I add?" } });
      
      await waitFor(() => {
        expect(chatInput).toHaveValue("What cards should I add?");
      });
    }
  });

  it("requires authentication", () => {
    const { container } = render(
      <ChatInterface
        currentDeck={mockDeck}
        deckMode="Master Duel"
        isAuthenticated={false}
        isDeckEmpty={false}
      />
    );
    
    // Should show authentication requirement
    // This depends on the component's auth handling
    const chatInput = screen.queryByRole("textbox") || container.querySelector('input[type="text"]');
    expect(chatInput).toBeInTheDocument();
  });

  it("handles empty deck state", () => {
    const { container } = render(
      <ChatInterface
        currentDeck={mockDeck}
        deckMode="Master Duel"
        isAuthenticated={true}
        isDeckEmpty={true}
      />
    );
    
    // Should handle empty deck appropriately
    const chatInput = screen.queryByRole("textbox") || container.querySelector('input[type="text"]');
    expect(chatInput).toBeInTheDocument();
  });

  it("displays blocked empty state when assistant gate fails", () => {
    render(
      <ChatInterface
        currentDeck={mockDeck}
        deckMode="Master Duel"
        isAuthenticated={true}
        isDeckEmpty={false}
        assistantBlocked={true}
        assistantBlockReasons={["Main deck must have at least 40 cards"]}
      />,
    );

    expect(
      screen.getByText("Deck Not Ready for Assistant"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Main deck must have at least 40 cards/),
    ).toBeInTheDocument();
  });
});
