/**
 * @jest-environment jsdom
 */
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useConversationPersistence } from "@/hooks/useConversationPersistence";

describe("useConversationPersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not clear messages when conversationId is set without externalConversationId", async () => {
    // Regression: coach reply set conversationId via onConversationChange;
    // the old effect treated unset externalConversationId as "clear thread"
    // and wiped the assistant bubble right after it appeared.
    const { result } = renderHook(() =>
      useConversationPersistence({
        currentDeckId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );

    act(() => {
      result.current.setMessages([
        {
          id: "1",
          role: "user",
          content: "What helps Lair of Darkness tribute?",
          timestamp: new Date(),
        },
        {
          id: "2",
          role: "assistant",
          content: "Enemy Controller tributes an opponent monster.",
          timestamp: new Date(),
          mode: "discover_synergy",
        },
      ]);
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.setConversationId("660e8400-e29b-41d4-a716-446655440111");
    });

    await waitFor(() => {
      expect(result.current.conversationId).toBe(
        "660e8400-e29b-41d4-a716-446655440111",
      );
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]?.content).toContain("Enemy Controller");
  });

  it("startNewConversation clears the thread without thrashing", () => {
    const { result } = renderHook(() =>
      useConversationPersistence({
        currentDeckId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );

    act(() => {
      result.current.setConversationId("660e8400-e29b-41d4-a716-446655440111");
      result.current.setMessages([
        {
          id: "1",
          role: "user",
          content: "hi",
          timestamp: new Date(),
        },
      ]);
    });

    act(() => {
      result.current.startNewConversation();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.conversationId).toBeUndefined();
  });
});
