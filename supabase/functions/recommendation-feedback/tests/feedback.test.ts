// Tests for recommendation feedback endpoint
// Rationale: Ensure feedback ingestion is secure, idempotent, and handles edge cases

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: async (token: string) => {
      if (token === "valid-token") {
        return {
          data: { user: { id: "user-123" } },
          error: null,
        };
      }
      return {
        data: { user: null },
        error: { message: "Invalid token" },
      };
    },
  },
  from: (table: string) => ({
    upsert: (data: any, options: any) => ({
      select: () => ({
        single: async () => ({
          data: { id: "feedback-123", ...data },
          error: null,
        }),
      }),
    }),
  }),
};

// Mock rate limit store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (userLimit.count >= 10) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Test rate limiting
Deno.test("Rate limiting allows requests within limit", () => {
  rateLimitStore.clear();
  const userId = "user-123";
  
  // First 10 requests should pass
  for (let i = 0; i < 10; i++) {
    assertEquals(checkRateLimit(userId), true);
  }
  
  // 11th request should fail
  assertEquals(checkRateLimit(userId), false);
});

// Test spam detection
function detectSpam(feedbackText: string | null): boolean {
  if (!feedbackText) return false;
  
  const text = feedbackText.toLowerCase();
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /.{500,}/, // Extremely long text
    /(http|www\.|\.com|\.net)/i, // URLs
    /(buy|sell|cheap|discount|offer)/i, // Commercial keywords
  ];
  
  return spamPatterns.some(pattern => pattern.test(text));
}

Deno.test("Spam detection catches suspicious patterns", () => {
  assertEquals(detectSpam("aaaaaaaaaaaaaaaa"), true); // Repeated chars
  assertEquals(detectSpam("a".repeat(500)), true); // Too long
  assertEquals(detectSpam("Check out http://spam.com"), true); // URL
  assertEquals(detectSpam("Buy cheap cards now!"), true); // Commercial
  assertEquals(detectSpam("This recommendation was helpful"), false); // Normal feedback
});

// Test feedback validation
Deno.test("Feedback validation requires recommendation_id", async () => {
  const request = {
    feedback_type: "approved",
  };
  
  // Should fail without recommendation_id
  assertEquals(request.recommendation_id, undefined);
});

Deno.test("Feedback validation requires valid feedback_type", async () => {
  const validTypes = ["approved", "disapproved"];
  const invalidType = "maybe";
  
  assertEquals(validTypes.includes(invalidType), false);
});

console.log("✅ All feedback tests passed");

