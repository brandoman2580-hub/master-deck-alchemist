# Recommendation Agent API Documentation

## Overview

The Recommendation Agent is a Supabase Edge Function that provides AI-powered deck recommendations for Yu-Gi-Oh! decks. It uses strict JSON schema validation, comprehensive card search, and LLM-powered analysis to generate consistent, actionable recommendations.

**Endpoint**: `POST /functions/v1/recommendation-agent`

**Authentication**: Required (Bearer token)

**Schema Version**: `1.0.0`

---

## Request Format

### Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Request Body Schema

```typescript
{
  question?: string;                    // User's question or request
  current_deck?: {                      // Current deck structure
    main: Array<{                       // Main deck (40-60 cards required)
      cardId: number;                   // Card ID from database
      count: number;                    // Number of copies (min: 0)
    }>;
    extra?: Array<{                     // Extra deck (optional)
      cardId: number;
      count: number;
    }>;
    side?: Array<{                      // Side deck (optional)
      cardId: number;
      count: number;
    }>;
  };
  format?: "MASTER_DUEL" | "TCG";       // Default: "MASTER_DUEL"
  recommendation_type?:                 // Default: "personalized"
    | "personalized"
    | "archetype"
    | "engine"
    | "tech"
    | "simple";
  use_hybrid_search?: boolean;          // Default: true
  explainTo?:                           // Default: "novice"
    | "novice"
    | "intermediate"
    | "advanced";
  userPrefs?: {
    playstyle?:                         // Optional
      | "aggro"
      | "control"
      | "combo"
      | "stall"
      | "hybrid";
    budget?:                            // Optional
      | "low"
      | "mid"
      | "high";
  };
  conversationContext?: {               // Optional multi-turn memory from client
    previousRecommendations: string[];
    userFeedback: Array<{
      cardId: string;
      accepted: boolean;
      reason?: string;
    }>;
    deckEvolution: Array<{
      timestamp: string;
      deckFingerprint?: string;
      mainCount?: number;
      extraCount?: number;
      sideCount?: number;
    }>;
    userGoals: string[];                // e.g. ["competitive", "budget"]
  };
  maxOutputTokens?: number;             // Default: 800
}
```

### Request Examples

#### Example 1: Simple Question
```json
{
  "question": "What engines work well with my deck?",
  "format": "MASTER_DUEL",
  "explainTo": "novice"
}
```

#### Example 2: With Deck Context
```json
{
  "question": "What hand traps should I add?",
  "current_deck": {
    "main": [
      { "cardId": 123, "count": 3 },
      { "cardId": 456, "count": 2 }
    ],
    "extra": [
      { "cardId": 789, "count": 1 }
    ],
    "side": []
  },
  "format": "MASTER_DUEL",
  "explainTo": "intermediate",
  "userPrefs": {
    "playstyle": "control",
    "budget": "mid"
  }
}
```

#### Example 3: Archetype Recommendation
```json
{
  "question": "What cards work with Blue-Eyes?",
  "recommendation_type": "archetype",
  "format": "TCG",
  "explainTo": "advanced"
}
```

---

## Response Format

### Success Response Schema

```typescript
{
  schemaVersion: string;                // "1.0.0"
  confidence: number;                   // 0.0 - 1.0
  explainTo: "novice" | "intermediate" | "advanced";
  summary?: string;                     // Optional summary text
  recommendations: Array<{
    cardId: string;                     // Card ID (as string)
    cardName?: string;                  // Card name
    action: "add" | "remove" | "replace" | "tech" | "note";
    reason: string;                     // Explanation
    impactEst: number;                  // -1.0 to 1.0
    synergyScore?: number;              // 0.0 to 1.0 (optional)
    evidence: string[];                // Supporting evidence
    banned?: boolean;                   // True if card is banned
  }>;
  ui: Array<{
    id: string;                         // Unique block ID
    type: "text" | "list" | "card" | "table" | "suggestion";
    content: string | string[] | {      // Content varies by type
      suggestionId?: string;
      cardId?: string;
      label?: string;
      verb?: "apply" | "preview";
    };
  }>;
  actions?: {
    applyAllowed?: boolean;            // True if confidence >= 0.6
    investigateRecommended?: boolean;   // True if confidence <= 0.45
  };
  meta?: {
    deckFingerprint?: string;          // SHA256 hash of deck
    recommendation_id?: string;        // UUID for tracking
    usedCardIds?: number[];            // Card IDs used in analysis
    tokens_used?: number;               // LLM tokens consumed
    cost_usd?: number;                  // Estimated cost
    diagnostic?: {                      // Debug information
      candidateCount?: number;
      cardDocsCount?: number;
      question?: string;
    };
  };
}
```

### Success Response Example

```json
{
  "schemaVersion": "1.0.0",
  "confidence": 0.85,
  "explainTo": "novice",
  "summary": "Here are some excellent hand trap options for your deck:",
  "recommendations": [
    {
      "cardId": "14558127",
      "cardName": "Ash Blossom & Joyous Spring",
      "action": "add",
      "reason": "Excellent hand trap that negates searches and draws",
      "impactEst": 0.9,
      "synergyScore": 0.85,
      "evidence": [
        "Card text: When a card or effect is activated...",
        "Commonly used in competitive decks"
      ],
      "banned": false
    }
  ],
  "ui": [
    {
      "id": "summary",
      "type": "text",
      "content": "Consider adding Ash Blossom for hand trap coverage"
    },
    {
      "id": "suggestion-1",
      "type": "suggestion",
      "content": {
        "suggestionId": "rec-123-suggestion-1",
        "cardId": "14558127",
        "label": "Apply: Add 1x Ash Blossom & Joyous Spring",
        "verb": "apply"
      }
    }
  ],
  "actions": {
    "applyAllowed": true,
    "investigateRecommended": false
  },
  "meta": {
    "deckFingerprint": "7f49949a2d20a1b4970ee7483d28526a29c0cb501d4d31dc7ea99a1655871c11",
    "recommendation_id": "ad4c089d-4400-40bf-8387-6eb5d2bd81ac",
    "usedCardIds": [14558127, 14558128, 14558129],
    "tokens_used": 1245,
    "cost_usd": 0.000336
  }
}
```

---

## Error Responses

### Error Response Schema

All error responses follow the same schema format but with `confidence: 0.0` and appropriate error messages.

### Error Types

#### 1. Authentication Error (401)
```json
{
  "error": "Authentication required.",
  "details": "No Authorization header found in request. Please ensure you are logged in."
}
```

#### 2. Invalid Request (400)
```json
{
  "error": "invalid_request",
  "details": {
    "question": { "_errors": ["Expected string, received undefined"] }
  }
}
```

#### 3. Deck Legality Error (200)
```json
{
  "schemaVersion": "1.0.0",
  "confidence": 0.0,
  "explainTo": "novice",
  "summary": "Deck legality: main deck must be 40-60 cards. Current main deck size: 35.",
  "recommendations": [],
  "ui": [
    {
      "id": "legality",
      "type": "text",
      "content": "Deck legality issue: main deck size 35. Fix deck to 40–60."
    }
  ],
  "actions": {},
  "meta": {
    "mainCount": 35
  }
}
```

#### 4. Insufficient Data (200)
```json
{
  "schemaVersion": "1.0.0",
  "confidence": 0.0,
  "explainTo": "novice",
  "summary": "Insufficient data to provide recommendations. No candidate cards were found matching your query.",
  "recommendations": [],
  "ui": [
    {
      "id": "insufficient_data",
      "type": "text",
      "content": "I couldn't find any cards matching your request. Try rephrasing your question or being more specific about what you're looking for."
    }
  ],
  "actions": {
    "applyAllowed": false,
    "investigateRecommended": true
  },
  "meta": {
    "deckFingerprint": "...",
    "recommendation_id": "...",
    "diagnostic": {
      "candidateCount": 0,
      "cardDocsCount": 0,
      "question": "What engines work well with my deck?"
    }
  }
}
```

#### 5. Internal Server Error (500)
```json
{
  "schemaVersion": "1.0.0",
  "confidence": 0.0,
  "explainTo": "novice",
  "summary": "Internal server error generating recommendations.",
  "recommendations": [],
  "ui": [
    {
      "id": "err_generic",
      "type": "text",
      "content": "Internal error: [error message]"
    }
  ]
}
```

---

## Confidence Gating

The response includes `actions` that indicate what the user can do based on confidence:

- **`applyAllowed: true`** - Confidence >= 0.6
  - User can directly apply recommendations
  - Recommendations are high-quality and safe to apply

- **`investigateRecommended: true`** - Confidence <= 0.45
  - User should investigate before applying
  - Recommendations may be uncertain or experimental

- **Neither set** - 0.45 < Confidence < 0.6
  - User can review and decide
  - Recommendations are moderate quality

---

## Feedback Endpoint

### Endpoint
`POST /functions/v1/recommendation-feedback`

### Request Body

```typescript
{
  deckFingerprint: string;              // SHA256 hash from recommendation meta
  suggestionId: string;                  // Suggestion ID from UI block
  accepted: boolean;                     // True if user accepted, false if rejected
  timestamp?: string;                    // ISO timestamp (defaults to now)
  userId?: string;                       // Optional, uses auth user if not provided
}
```

### Response

```json
{
  "success": true,
  "telemetry_id": "uuid-here",
  "message": "Feedback recorded successfully"
}
```

### Example

```json
{
  "deckFingerprint": "7f49949a2d20a1b4970ee7483d28526a29c0cb501d4d31dc7ea99a1655871c11",
  "suggestionId": "rec-123-suggestion-1",
  "accepted": true
}
```

---

## Best Practices

### 1. Always Check Confidence
Before allowing users to apply recommendations, check `actions.applyAllowed`:

```typescript
if (response.actions?.applyAllowed) {
  // Show "Apply" button
} else if (response.actions?.investigateRecommended) {
  // Show "Investigate" button
} else {
  // Show "Review" button
}
```

### 2. Handle Banned Cards
Check `banned: true` in recommendations and adjust UI accordingly:

```typescript
if (recommendation.banned) {
  // Show warning, disable apply, or convert to "note" action
}
```

### 3. Use deckFingerprint for Telemetry
Always include `deckFingerprint` from response `meta` when submitting feedback:

```typescript
await submitFeedback({
  deckFingerprint: response.meta?.deckFingerprint,
  suggestionId: suggestion.suggestionId,
  accepted: true
});
```

### 4. Handle Empty Responses
If `recommendations.length === 0`, show the `ui` blocks which contain helpful messages:

```typescript
if (response.recommendations.length === 0) {
  // Render UI blocks for user guidance
  response.ui.forEach(block => {
    // Render based on block.type
  });
}
```

### 5. Validate Response Schema
Always validate the response matches the expected schema:

```typescript
import { RecommenderZ } from '@/types/recommender';

const validated = RecommenderZ.safeParse(response);
if (!validated.success) {
  // Handle invalid response
}
```

---

## Rate Limiting

- **Recommended**: 1 request per user per 5 seconds
- **Maximum**: 10 requests per user per minute
- **Burst**: Up to 3 concurrent requests per user

---

## Performance

- **Typical Response Time**: 2-4 seconds
- **P95 Response Time**: < 5 seconds
- **Token Usage**: ~800-1200 tokens per request
- **Cost**: ~$0.0003 per request (Groq API)

---

## Changelog

### Version 1.0.0 (Current)
- Initial strict JSON schema implementation
- Comprehensive validation
- Master Duel banlist integration
- Confidence gating
- Telemetry support

---

## Support

For issues or questions:
1. Check Edge Function logs in Supabase Dashboard
2. Review `meta.diagnostic` in error responses
3. Check `recommendation_logs` table for request history

