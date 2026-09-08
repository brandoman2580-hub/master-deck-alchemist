/**
 * Phase 3 Client Integration Tests
 * Tests for the recommendation agent API client and response handling
 */

import type { RecommenderResponse } from "../types/recommender";

// Mock the dependencies
jest.mock("@/lib/supabaseClient", () => ({
  getAccessToken: jest.fn(() => Promise.resolve("mock-access-token")),
}));

jest.mock("@/lib/api/coachFromFacts", () => ({
  coachFromFacts: jest.fn(() =>
    Promise.resolve({
      facts: null,
      systemPrompt: "mock",
      factsPromptBlock: null,
    }),
  ),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

describe("Recommendation Agent Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  describe("Request Format Conversion", () => {
    it("should convert deck format from mainDeck/extraDeck/sideDeck to main/extra/side", async () => {
      const { getRecommendations } = await import("../lib/api/recommendationAgent");

      const mockResponse: RecommenderResponse = {
        schemaVersion: "1.0.0",
        confidence: 0.8,
        explainTo: "novice",
        summary: "Test summary",
        recommendations: [],
        ui: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request = {
        question: "Find me hand traps",
        current_deck: {
          mainDeck: [{ id: 1, name: "Card 1" }],
          extraDeck: [{ id: 2, name: "Card 2" }],
          sideDeck: [{ id: 3, name: "Card 3" }],
        },
        format: "MASTER_DUEL" as const,
      };

      await getRecommendations(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.current_deck).toEqual({
        main: [{ cardId: 1, count: 1 }],
        extra: [{ cardId: 2, count: 1 }],
        side: [{ cardId: 3, count: 1 }],
      });
    });

    it("should handle empty deck sections", async () => {
      const { getRecommendations } = await import("../lib/api/recommendationAgent");

      const mockResponse: RecommenderResponse = {
        schemaVersion: "1.0.0",
        confidence: 0.8,
        explainTo: "novice",
        summary: "Test",
        recommendations: [],
        ui: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request = {
        question: "Test",
        current_deck: {
          mainDeck: [],
          extraDeck: [],
          sideDeck: [],
        },
      };

      await getRecommendations(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.current_deck).toEqual({
        main: [],
        extra: [],
        side: [],
      });
    });

    it("should include new request parameters", async () => {
      const { getRecommendations } = await import("../lib/api/recommendationAgent");

      const mockResponse: RecommenderResponse = {
        schemaVersion: "1.0.0",
        confidence: 0.8,
        explainTo: "intermediate",
        summary: "Test",
        recommendations: [],
        ui: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request = {
        question: "Test",
        explainTo: "intermediate" as const,
        userPrefs: {
          playstyle: "aggro" as const,
          budget: "mid" as const,
        },
        maxOutputTokens: 1000,
      };

      await getRecommendations(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.explainTo).toBe("intermediate");
      expect(requestBody.userPrefs).toEqual({
        playstyle: "aggro",
        budget: "mid",
      });
      expect(requestBody.maxOutputTokens).toBe(1000);
    });
  });

  describe("Response Handling", () => {
    it("should handle new strict schema response format", async () => {
      const { getRecommendations } = await import("../lib/api/recommendationAgent");

      const mockResponse: RecommenderResponse = {
        schemaVersion: "1.0.0",
        confidence: 0.85,
        explainTo: "novice",
        summary: "Here are some recommendations",
        recommendations: [
          {
            cardId: "123",
            cardName: "Ash Blossom & Joyous Spring",
            action: "add",
            reason: "Excellent hand trap",
            impactEst: 0.9,
            synergyScore: 0.8,
            evidence: ["Card text"],
          },
        ],
        ui: [
          {
            id: "summary",
            type: "text",
            content: "Consider adding hand traps",
          },
        ],
        actions: {
          applyAllowed: true,
        },
        meta: {
          usedCardIds: [123],
          deckFingerprint: "abc123",
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getRecommendations({ question: "Test" });

      expect(result.schemaVersion).toBe("1.0.0");
      expect(result.confidence).toBe(0.85);
      expect(result.recommendations).toHaveLength(1);
      expect(result.ui).toHaveLength(1);
      expect(result.actions?.applyAllowed).toBe(true);
    });

    it("should handle legacy response format for backward compatibility", async () => {
      const { getRecommendations } = await import("../lib/api/recommendationAgent");

      const legacyResponse = {
        answer: "Legacy response",
        validated_cards: [],
        recommendation_id: "legacy-123",
        response_version: "1.0",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => legacyResponse,
      });

      const result = await getRecommendations({ question: "Test" });

      // Should still return the response even if it doesn't have schemaVersion
      expect(result).toBeDefined();
    });

    it("should handle error responses", async () => {
      const { getRecommendations } = await import("../lib/api/recommendationAgent");

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Authentication failed" }),
      });

      await expect(getRecommendations({ question: "Test" })).rejects.toThrow(
        "Authentication"
      );
    });
  });

  describe("Request Defaults", () => {
    it("should use default values when not provided", async () => {
      const { getRecommendations } = await import("../lib/api/recommendationAgent");

      const mockResponse: RecommenderResponse = {
        schemaVersion: "1.0.0",
        confidence: 0.8,
        explainTo: "novice",
        summary: "Test",
        recommendations: [],
        ui: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await getRecommendations({ question: "Test" });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.format).toBe("MASTER_DUEL");
      expect(requestBody.recommendation_type).toBe("personalized");
      expect(requestBody.use_hybrid_search).toBe(true);
      expect(requestBody.explainTo).toBe("novice");
    });
  });
});

