/**
 * Unit tests for recommendation agent schemas
 * Tests Zod validation, type inference, and edge cases
 */

/// <reference path="../types/jest.d.ts" />

import { z } from "zod";
import {
  DeckCardZ,
  DeckZ,
  UserPrefsZ,
  RecommendationRequestZ,
  CardDocZ,
  RecoItemZ,
  UIBlockZ,
  RecommenderZ,
} from "../types/recommender";
import {
  validateRecommendationRequest,
  validateRecommenderResponse,
  safeParseRecommenderResponse,
  isValidRecommendationAction,
  isValidExplainLevel,
  isValidPlayFormat,
} from "../lib/recommender-validation";

describe("DeckCardZ Schema", () => {
  it("should validate a valid deck card", () => {
    const validCard = { cardId: 123, count: 3 };
    expect(() => DeckCardZ.parse(validCard)).not.toThrow();
    const result = DeckCardZ.parse(validCard);
    expect(result.cardId).toBe(123);
    expect(result.count).toBe(3);
  });

  it("should reject negative count", () => {
    const invalidCard = { cardId: 123, count: -1 };
    expect(() => DeckCardZ.parse(invalidCard)).toThrow();
  });

  it("should reject missing cardId", () => {
    const invalidCard = { count: 3 };
    expect(() => DeckCardZ.parse(invalidCard)).toThrow();
  });

  it("should reject missing count", () => {
    const invalidCard = { cardId: 123 };
    expect(() => DeckCardZ.parse(invalidCard)).toThrow();
  });
});

describe("DeckZ Schema", () => {
  it("should validate a valid deck", () => {
    const validDeck = {
      main: [
        { cardId: 1, count: 3 },
        { cardId: 2, count: 2 },
      ],
      extra: [{ cardId: 3, count: 1 }],
      side: [],
    };
    expect(() => DeckZ.parse(validDeck)).not.toThrow();
    const result = DeckZ.parse(validDeck);
    expect(result.main).toHaveLength(2);
    expect(result.extra).toHaveLength(1);
    expect(result.side).toEqual([]);
  });

  it("should default empty extra and side arrays", () => {
    const deckWithoutOptional = {
      main: [{ cardId: 1, count: 3 }],
    };
    const result = DeckZ.parse(deckWithoutOptional);
    expect(result.extra).toEqual([]);
    expect(result.side).toEqual([]);
  });

  it("should reject invalid main deck cards", () => {
    const invalidDeck = {
      main: [{ cardId: 1, count: -1 }], // negative count
    };
    expect(() => DeckZ.parse(invalidDeck)).toThrow();
  });
});

describe("UserPrefsZ Schema", () => {
  it("should validate valid user preferences", () => {
    const validPrefs = {
      playstyle: "aggro",
      budget: "high",
    };
    expect(() => UserPrefsZ.parse(validPrefs)).not.toThrow();
  });

  it("should accept optional fields", () => {
    const partialPrefs = { playstyle: "control" };
    expect(() => UserPrefsZ.parse(partialPrefs)).not.toThrow();
  });

  it("should accept empty object", () => {
    expect(() => UserPrefsZ.parse({})).not.toThrow();
  });

  it("should accept undefined", () => {
    expect(() => UserPrefsZ.parse(undefined)).not.toThrow();
  });

  it("should reject invalid playstyle", () => {
    const invalidPrefs = { playstyle: "invalid" };
    expect(() => UserPrefsZ.parse(invalidPrefs)).toThrow();
  });

  it("should reject invalid budget", () => {
    const invalidPrefs = { budget: "invalid" };
    expect(() => UserPrefsZ.parse(invalidPrefs)).toThrow();
  });
});

describe("RecommendationRequestZ Schema", () => {
  it("should validate a valid recommendation request", () => {
    const validRequest = {
      question: "What cards work well with this deck?",
      current_deck: {
        main: [{ cardId: 1, count: 3 }],
      },
      format: "MASTER_DUEL",
      explainTo: "intermediate",
      userPrefs: { playstyle: "combo" },
    };
    expect(() => RecommendationRequestZ.parse(validRequest)).not.toThrow();
  });

  it("should default format to MASTER_DUEL", () => {
    const requestWithoutFormat = {
      question: "Test question",
    };
    const result = RecommendationRequestZ.parse(requestWithoutFormat);
    expect(result.format).toBe("MASTER_DUEL");
  });

  it("should default explainTo to novice", () => {
    const requestWithoutExplainTo = {
      question: "Test question",
    };
    const result = RecommendationRequestZ.parse(requestWithoutExplainTo);
    expect(result.explainTo).toBe("novice");
  });

  it("should default use_hybrid_search to true", () => {
    const requestWithoutHybrid = {
      question: "Test question",
    };
    const result = RecommendationRequestZ.parse(requestWithoutHybrid);
    expect(result.use_hybrid_search).toBe(true);
  });

  it("should default maxOutputTokens to 800", () => {
    const requestWithoutTokens = {
      question: "Test question",
    };
    const result = RecommendationRequestZ.parse(requestWithoutTokens);
    expect(result.maxOutputTokens).toBe(800);
  });

  it("should reject invalid format", () => {
    const invalidRequest = {
      question: "Test",
      format: "INVALID",
    };
    expect(() => RecommendationRequestZ.parse(invalidRequest)).toThrow();
  });

  it("should reject invalid explainTo", () => {
    const invalidRequest = {
      question: "Test",
      explainTo: "expert", // invalid
    };
    expect(() => RecommendationRequestZ.parse(invalidRequest)).toThrow();
  });
});

describe("RecoItemZ Schema", () => {
  it("should validate a valid recommendation item", () => {
    const validReco = {
      cardId: "123",
      cardName: "Dark Magician",
      action: "add",
      reason: "Strong monster card",
      impactEst: 0.8,
      synergyScore: 0.9,
      evidence: ["Works well with spell cards"],
      banned: false,
    };
    expect(() => RecoItemZ.parse(validReco)).not.toThrow();
  });

  it("should require all mandatory fields", () => {
    const invalidReco = {
      cardId: "123",
      // missing action, reason, impactEst, evidence
    };
    expect(() => RecoItemZ.parse(invalidReco)).toThrow();
  });

  it("should reject impactEst outside -1 to 1 range", () => {
    const invalidReco = {
      cardId: "123",
      action: "add",
      reason: "Test",
      impactEst: 1.5, // out of range
      evidence: [],
    };
    expect(() => RecoItemZ.parse(invalidReco)).toThrow();
  });

  it("should reject negative impactEst below -1", () => {
    const invalidReco = {
      cardId: "123",
      action: "add",
      reason: "Test",
      impactEst: -1.5, // out of range
      evidence: [],
    };
    expect(() => RecoItemZ.parse(invalidReco)).toThrow();
  });

  it("should reject synergyScore outside 0 to 1 range", () => {
    const invalidReco = {
      cardId: "123",
      action: "add",
      reason: "Test",
      impactEst: 0.5,
      synergyScore: 1.5, // out of range
      evidence: [],
    };
    expect(() => RecoItemZ.parse(invalidReco)).toThrow();
  });

  it("should accept valid action types", () => {
    const actions = [
      "add",
      "remove",
      "replace",
      "tech",
      "note",
    ];
    actions.forEach((action) => {
      const reco = {
        cardId: "123",
        action,
        reason: "Test",
        impactEst: 0.5,
        evidence: [],
      };
      expect(() => RecoItemZ.parse(reco)).not.toThrow();
    });
  });

  it("should reject invalid action type", () => {
    const invalidReco = {
      cardId: "123",
      action: "invalid", // invalid action
      reason: "Test",
      impactEst: 0.5,
      evidence: [],
    };
    expect(() => RecoItemZ.parse(invalidReco)).toThrow();
  });

  it("should accept optional banned field", () => {
    const recoWithBanned = {
      cardId: "123",
      action: "add",
      reason: "Test",
      impactEst: 0.5,
      evidence: [],
      banned: true,
    };
    expect(() => RecoItemZ.parse(recoWithBanned)).not.toThrow();
  });
});

describe("UIBlockZ Schema", () => {
  it("should validate a text block", () => {
    const textBlock = {
      id: "text1",
      type: "text",
      content: "This is a text block",
    };
    expect(() => UIBlockZ.parse(textBlock)).not.toThrow();
  });

  it("should validate a list block", () => {
    const listBlock = {
      id: "list1",
      type: "list",
      content: ["Item 1", "Item 2", "Item 3"],
    };
    expect(() => UIBlockZ.parse(listBlock)).not.toThrow();
  });

  it("should validate a suggestion block", () => {
    const suggestionBlock = {
      id: "suggestion1",
      type: "suggestion",
      content: {
        suggestionId: "sug1",
        cardId: "123",
        verb: "apply",
        label: "Apply: add 1x Dark Magician",
      },
    };
    expect(() => UIBlockZ.parse(suggestionBlock)).not.toThrow();
  });

  it("should reject invalid block type", () => {
    const invalidBlock = {
      id: "block1",
      type: "invalid",
      content: "Test",
    };
    expect(() => UIBlockZ.parse(invalidBlock)).toThrow();
  });

  it("should require id field", () => {
    const invalidBlock = {
      type: "text",
      content: "Test",
    };
    expect(() => UIBlockZ.parse(invalidBlock)).toThrow();
  });
});

describe("RecommenderZ Schema", () => {
  it("should validate a complete recommender response", () => {
    const validResponse = {
      schemaVersion: "1.0.0",
      confidence: 0.75,
      explainTo: "intermediate",
      summary: "Here are some recommendations",
      recommendations: [
        {
          cardId: "123",
          action: "add",
          reason: "Strong card",
          impactEst: 0.8,
          synergyScore: 0.9,
          evidence: ["Works well"],
        },
      ],
      ui: [
        {
          id: "summary",
          type: "text",
          content: "Summary text",
        },
      ],
      actions: {
        applyAllowed: true,
      },
      meta: {
        deckFingerprint: "abc123",
      },
    };
    expect(() => RecommenderZ.parse(validResponse)).not.toThrow();
  });

  it("should require schemaVersion", () => {
    const invalidResponse = {
      confidence: 0.75,
      explainTo: "novice",
      recommendations: [],
      ui: [],
    };
    expect(() => RecommenderZ.parse(invalidResponse)).toThrow();
  });

  it("should require confidence in 0-1 range", () => {
    const invalidResponse = {
      schemaVersion: "1.0.0",
      confidence: 1.5, // out of range
      explainTo: "novice",
      recommendations: [],
      ui: [],
    };
    expect(() => RecommenderZ.parse(invalidResponse)).toThrow();
  });

  it("should reject negative confidence", () => {
    const invalidResponse = {
      schemaVersion: "1.0.0",
      confidence: -0.1, // out of range
      explainTo: "novice",
      recommendations: [],
      ui: [],
    };
    expect(() => RecommenderZ.parse(invalidResponse)).toThrow();
  });

  it("should require valid explainTo", () => {
    const invalidResponse = {
      schemaVersion: "1.0.0",
      confidence: 0.75,
      explainTo: "expert", // invalid
      recommendations: [],
      ui: [],
    };
    expect(() => RecommenderZ.parse(invalidResponse)).toThrow();
  });

  it("should accept optional summary", () => {
    const responseWithoutSummary = {
      schemaVersion: "1.0.0",
      confidence: 0.75,
      explainTo: "novice",
      recommendations: [],
      ui: [],
    };
    expect(() => RecommenderZ.parse(responseWithoutSummary)).not.toThrow();
  });

  it("should accept empty recommendations array", () => {
    const responseWithEmptyRecos = {
      schemaVersion: "1.0.0",
      confidence: 0.0,
      explainTo: "novice",
      recommendations: [],
      ui: [
        {
          id: "investigate",
          type: "suggestion",
          content: {
            suggestionId: "investigate",
            label: "Investigate",
            verb: "preview",
          },
        },
      ],
    };
    expect(() => RecommenderZ.parse(responseWithEmptyRecos)).not.toThrow();
  });

  it("should accept optional actions and meta", () => {
    const responseWithoutOptional = {
      schemaVersion: "1.0.0",
      confidence: 0.75,
      explainTo: "novice",
      recommendations: [],
      ui: [],
    };
    expect(() => RecommenderZ.parse(responseWithoutOptional)).not.toThrow();
  });
});

describe("Validation Helpers", () => {
  describe("validateRecommendationRequest", () => {
    it("should validate a valid request", () => {
      const request = {
        question: "Test question",
        format: "TCG",
      };
      expect(() => validateRecommendationRequest(request)).not.toThrow();
    });

    it("should throw on invalid request", () => {
      const invalidRequest = {
        format: "INVALID",
      };
      expect(() => validateRecommendationRequest(invalidRequest)).toThrow();
    });
  });

  describe("validateRecommenderResponse", () => {
    it("should validate a valid response", () => {
      const response = {
        schemaVersion: "1.0.0",
        confidence: 0.75,
        explainTo: "novice",
        recommendations: [],
        ui: [],
      };
      expect(() => validateRecommenderResponse(response)).not.toThrow();
    });

    it("should throw on invalid response", () => {
      const invalidResponse = {
        confidence: 1.5, // out of range
        explainTo: "novice",
        recommendations: [],
        ui: [],
      };
      expect(() => validateRecommenderResponse(invalidResponse)).toThrow();
    });
  });

  describe("safeParseRecommenderResponse", () => {
    it("should return success for valid response", () => {
      const response = {
        schemaVersion: "1.0.0",
        confidence: 0.75,
        explainTo: "novice",
        recommendations: [],
        ui: [],
      };
      const result = safeParseRecommenderResponse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBe(0.75);
      }
    });

    it("should return error for invalid response", () => {
      const invalidResponse = {
        confidence: 1.5, // out of range
      };
      const result = safeParseRecommenderResponse(invalidResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
      }
    });
  });

  describe("isValidRecommendationAction", () => {
    it("should return true for valid actions", () => {
      expect(isValidRecommendationAction("add")).toBe(true);
      expect(isValidRecommendationAction("remove")).toBe(true);
      expect(isValidRecommendationAction("replace")).toBe(true);
      expect(isValidRecommendationAction("tech")).toBe(true);
      expect(isValidRecommendationAction("note")).toBe(true);
    });

    it("should return false for invalid actions", () => {
      expect(isValidRecommendationAction("invalid")).toBe(false);
      expect(isValidRecommendationAction("")).toBe(false);
      expect(isValidRecommendationAction("ADD")).toBe(false); // case sensitive
    });
  });

  describe("isValidExplainLevel", () => {
    it("should return true for valid levels", () => {
      expect(isValidExplainLevel("novice")).toBe(true);
      expect(isValidExplainLevel("intermediate")).toBe(true);
      expect(isValidExplainLevel("advanced")).toBe(true);
    });

    it("should return false for invalid levels", () => {
      expect(isValidExplainLevel("expert")).toBe(false);
      expect(isValidExplainLevel("beginner")).toBe(false);
      expect(isValidExplainLevel("")).toBe(false);
    });
  });

  describe("isValidPlayFormat", () => {
    it("should return true for valid formats", () => {
      expect(isValidPlayFormat("MASTER_DUEL")).toBe(true);
      expect(isValidPlayFormat("TCG")).toBe(true);
    });

    it("should return false for invalid formats", () => {
      expect(isValidPlayFormat("master_duel")).toBe(false); // case sensitive
      expect(isValidPlayFormat("tcg")).toBe(false);
      expect(isValidPlayFormat("invalid")).toBe(false);
    });
  });
});

describe("Edge Cases", () => {
  it("should handle empty strings in evidence array", () => {
    const reco = {
      cardId: "123",
      action: "add",
      reason: "Test",
      impactEst: 0.5,
      evidence: [""], // empty string
    };
    expect(() => RecoItemZ.parse(reco)).not.toThrow();
  });

  it("should handle very long reason strings", () => {
    const longReason = "A".repeat(1000);
    const reco = {
      cardId: "123",
      action: "add",
      reason: longReason,
      impactEst: 0.5,
      evidence: [],
    };
    expect(() => RecoItemZ.parse(reco)).not.toThrow();
  });

  it("should handle zero confidence", () => {
    const response = {
      schemaVersion: "1.0.0",
      confidence: 0.0,
      explainTo: "novice",
      recommendations: [],
      ui: [],
    };
    expect(() => RecommenderZ.parse(response)).not.toThrow();
  });

  it("should handle maximum confidence (1.0)", () => {
    const response = {
      schemaVersion: "1.0.0",
      confidence: 1.0,
      explainTo: "novice",
      recommendations: [],
      ui: [],
    };
    expect(() => RecommenderZ.parse(response)).not.toThrow();
  });

  it("should handle large recommendation arrays", () => {
    const recommendations = Array.from({ length: 50 }, (_, i) => ({
      cardId: String(i),
      action: "add",
      reason: `Reason ${i}`,
      impactEst: 0.5,
      evidence: [],
    }));
    const response = {
      schemaVersion: "1.0.0",
      confidence: 0.75,
      explainTo: "novice",
      recommendations,
      ui: [],
    };
    expect(() => RecommenderZ.parse(response)).not.toThrow();
  });
});

