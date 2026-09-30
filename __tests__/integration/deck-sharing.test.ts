/**
 * Integration tests for deck sharing flow
 * Tests the complete flow: create share → get share → verify data
 *
 * Requires real Supabase credentials. Skipped in CI (placeholder env vars).
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import { createDeckShare, getDeckShare } from "@/lib/api/deckShare";
import type { DeckType } from "@/types/deck";

// Mock environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const hasRequiredEnv =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  SUPABASE_URL !== "https://placeholder.supabase.co" &&
  SUPABASE_ANON_KEY !== "placeholder" &&
  typeof fetch === "function";

const describeIntegration = hasRequiredEnv ? describe : describe.skip;

// Test deck data
const testDeck: DeckType = {
  id: "test-share-deck-id",
  name: "Test Share Deck",
  mainDeck: Array.from({ length: 40 }, (_, i) => ({
    id: 89631139 + (i % 3),
    deckInstanceId: crypto.randomUUID(),
    name: "Test Card",
    type: "Normal Monster",
    desc: "Test description",
  })),
  extraDeck: [
    {
      id: 23995346,
      deckInstanceId: crypto.randomUUID(),
      name: "Blue-Eyes Ultimate Dragon",
      type: "Fusion Monster",
      desc: "Fusion monster",
    },
  ],
  sideDeck: [],
  deckFormat: "Master Duel",
  isPinned: false,
};

describeIntegration("Deck Sharing Integration", () => {
  let shareToken: string | null = null;

  beforeAll(() => {
    if (!hasRequiredEnv) {
      console.warn("⚠️ Skipping deck sharing tests - missing environment variables");
    }
  });

  it("should create a deck share", async () => {
    if (!hasRequiredEnv) {
      console.log("⏭️ Skipping - missing environment variables");
      return;
    }

    const result = await createDeckShare({
      deck: {
        name: testDeck.name,
        mainDeck: testDeck.mainDeck,
        extraDeck: testDeck.extraDeck,
        sideDeck: testDeck.sideDeck,
        mode: testDeck.deckFormat,
      },
      options: {
        expiresInDays: 30,
        maxAccessCount: 100,
      },
    });

    expect(result.success).toBe(true);
    expect(result.shareToken).toBeDefined();
    expect(result.shareToken.length).toBeGreaterThan(0);
    expect(result.shareUrl).toBeDefined();
    expect(result.shareUrl.includes(result.shareToken)).toBe(true);

    shareToken = result.shareToken;
  });

  it("should retrieve deck share", async () => {
    if (!hasRequiredEnv || !shareToken) {
      console.log("⏭️ Skipping - missing environment variables or share token");
      return;
    }

    const result = await getDeckShare(shareToken);

    expect(result.success).toBe(true);
    expect(result.deck).toBeDefined();
    expect(result.deck.name).toBe(testDeck.name);
    expect(result.deck.mode).toBe(testDeck.deckFormat);
    expect(result.deck.mainDeck.length).toBe(testDeck.mainDeck.length);
    expect(result.deck.extraDeck.length).toBe(testDeck.extraDeck.length);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.accessCount).toBeGreaterThanOrEqual(1);
  });

  it("should increment access count on multiple retrievals", async () => {
    if (!hasRequiredEnv || !shareToken) {
      console.log("⏭️ Skipping - missing environment variables or share token");
      return;
    }

    const result1 = await getDeckShare(shareToken);
    const initialCount = result1.metadata?.accessCount || 0;

    const result2 = await getDeckShare(shareToken);
    const newCount = result2.metadata?.accessCount || 0;

    expect(newCount).toBe(initialCount + 1);
  });

  it("should handle invalid token", async () => {
    if (!hasRequiredEnv) {
      console.log("⏭️ Skipping - missing environment variables");
      return;
    }

    await expect(getDeckShare("invalid-token-123")).rejects.toThrow();
  });
});
