/**
 * Unit tests for AI chatbot conversation context (multi-turn memory)
 */
/// <reference path="../types/jest.d.ts" />

import { buildConversationContextFromMessages } from "../components/ai-chatbot/conversation-context";
import type { Message } from "../components/ai-chatbot/types";
import { useAIFeedbackStore } from "../store/aiFeedbackStore";

describe("buildConversationContextFromMessages", () => {
  beforeEach(() => {
    useAIFeedbackStore.getState().clearFeedback();
  });

  it("builds goals from user messages and pending user input", () => {
    const messages: Message[] = [
      {
        id: "u1",
        role: "user",
        content: "I need budget options for this deck.",
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "u2",
        role: "user",
        content: "Also make it more competitive for the meta.",
        timestamp: new Date("2026-01-01T00:01:00.000Z"),
      },
    ];

    const ctx = buildConversationContextFromMessages({
      messages,
      feedbackStates: new Map(),
      deckStats: null,
      pendingUserMessage: "Can we add an OTK line too?",
    });

    expect(ctx.userGoals).toEqual(
      expect.arrayContaining(["budget", "competitive", "otk"]),
    );
  });

  it("captures previous recommendations and expands message-level feedback into per-card feedback", () => {
    const assistantReco: Message = {
      id: "a1",
      role: "assistant",
      content: "Here are some suggestions.",
      timestamp: new Date("2026-01-01T00:02:00.000Z"),
      recommenderResponse: {
        schemaVersion: "1.0.0",
        confidence: 0.85,
        explainTo: "novice",
        summary: "Summary",
        recommendations: [
          {
            cardId: "1",
            cardName: "Card A",
            action: "add",
            reason: "Reason A",
            impactEst: 0.7,
            evidence: [],
          },
          {
            cardId: "2",
            cardName: "Card B",
            action: "add",
            reason: "Reason B",
            impactEst: 0.6,
            evidence: [],
          },
        ],
        ui: [],
        meta: { deckFingerprint: "fp-123" },
      },
      recommendation_id: "rec-1",
      response_version: "1.0.0",
    };

    useAIFeedbackStore.getState().recordFeedback({
      cardId: "2",
      accepted: false,
      reasons: ["no-synergy"],
      note: undefined,
    });

    const ctx = buildConversationContextFromMessages({
      messages: [assistantReco],
      feedbackStates: new Map([["a1", "approved"]]),
      deckStats: { mainCount: 40, extraCount: 15, sideCount: 0 },
    });

    expect(ctx.previousRecommendations).toEqual(
      expect.arrayContaining(["1:Card A", "2:Card B"]),
    );
    expect(ctx.userFeedback).toEqual(
      expect.arrayContaining([
        { cardId: "1", accepted: true },
        { cardId: "2", accepted: false, reason: "no-synergy" },
      ]),
    );
    expect(ctx.deckEvolution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deckFingerprint: "fp-123",
        }),
        expect.objectContaining({
          mainCount: 40,
          extraCount: 15,
          sideCount: 0,
        }),
      ]),
    );
  });
});
