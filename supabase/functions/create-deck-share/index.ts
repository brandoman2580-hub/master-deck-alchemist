/**
 * Create Deck Share Edge Function
 * 
 * Generates a secure share token and stores deck data server-side.
 * Returns a shareable link that can be used to import the deck.
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { corsHeaders } from "../_shared/cors.ts";

// Rate limiting: Max 10 shares per hour per user
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 10;

// In-memory rate limit store (consider Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string | null): boolean {
  if (!userId) {
    // Anonymous users: stricter limit
    const anonKey = "anon";
    const now = Date.now();
    const limit = rateLimitStore.get(anonKey);

    if (!limit || now > limit.resetAt) {
      rateLimitStore.set(anonKey, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return true;
    }

    if (limit.count >= 5) { // Lower limit for anonymous
      return false;
    }

    limit.count++;
    return true;
  }

  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitStore.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * Generate a cryptographically secure share token
 * Uses Web Crypto API for cryptographically secure random generation
 * Returns a URL-safe base64url encoded token (43 characters for 32 bytes)
 */
function generateShareToken(): string {
  // Generate 32 random bytes (256 bits) using Web Crypto API
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  
  // Convert to base64url (URL-safe base64)
  // Use btoa and replace characters to make it URL-safe
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  
  // Base64url encoding of 32 bytes = 43 characters (no padding needed)
  return base64;
}

/**
 * Validate deck card structure
 */
const DeckCardSchema = z.object({
  cardId: z.number().int().positive(),
  deckInstanceId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  type: z.string().optional(),
  desc: z.string().optional(),
  // Allow other optional fields but don't validate them strictly
}).passthrough();

/**
 * Validate deck structure
 */
const DeckShareRequestSchema = z.object({
  deck: z.object({
    name: z.string().min(1).max(200),
    mainDeck: z.array(DeckCardSchema).max(100), // Max 100 cards per section
    extraDeck: z.array(DeckCardSchema).max(100),
    sideDeck: z.array(DeckCardSchema).max(100),
    mode: z.enum(["Master Duel", "TCG"]),
  }),
  options: z.object({
    expiresInDays: z.number().int().min(1).max(365).optional(), // Max 1 year
    maxAccessCount: z.number().int().min(1).max(10000).optional(), // Max 10k accesses
  }).optional(),
});

/**
 * Sanitize deck data to remove any potentially malicious fields
 * Uses whitelist approach for maximum security
 */
function sanitizeDeckData(deck: z.infer<typeof DeckShareRequestSchema>["deck"]) {
  const sanitizeCard = (card: unknown) => {
    // Type guard: ensure card is an object
    if (typeof card !== "object" || card === null || Array.isArray(card)) {
      return null;
    }

    const cardObj = card as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    
    // Only copy whitelisted fields with strict validation
    // cardId: must be a positive safe integer
    if (
      typeof cardObj.cardId === "number" &&
      Number.isSafeInteger(cardObj.cardId) &&
      cardObj.cardId > 0 &&
      cardObj.cardId <= 999999999 // Reasonable upper limit
    ) {
      sanitized.cardId = cardObj.cardId;
    } else {
      return null; // Invalid cardId, skip this card
    }
    
    // deckInstanceId: must be a valid UUID format
    if (
      typeof cardObj.deckInstanceId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cardObj.deckInstanceId
      )
    ) {
      sanitized.deckInstanceId = cardObj.deckInstanceId;
    }
    
    // name: must be a non-empty string, max 200 chars, no control characters
    if (
      typeof cardObj.name === "string" &&
      cardObj.name.length > 0 &&
      cardObj.name.length <= 200 &&
      !/[\x00-\x1F\x7F]/.test(cardObj.name) // No control characters
    ) {
      sanitized.name = cardObj.name.trim();
    } else {
      return null; // Invalid name, skip this card
    }
    
    // type: optional string, max 100 chars
    if (
      typeof cardObj.type === "string" &&
      cardObj.type.length <= 100 &&
      !/[\x00-\x1F\x7F]/.test(cardObj.type)
    ) {
      sanitized.type = cardObj.type.trim();
    }
    
    // desc: optional string, max 5000 chars
    if (
      typeof cardObj.desc === "string" &&
      cardObj.desc.length <= 5000 &&
      !/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(cardObj.desc) // Allow newlines and tabs
    ) {
      sanitized.desc = cardObj.desc;
    }
    
    return sanitized;
  };

  // Sanitize deck name
  let sanitizedName = "Untitled Deck";
  if (
    typeof deck.name === "string" &&
    deck.name.length > 0 &&
    deck.name.length <= 200 &&
    !/[\x00-\x1F\x7F]/.test(deck.name)
  ) {
    sanitizedName = deck.name.trim();
  }

  // Filter out null cards (invalid cards)
  const sanitizeDeckSection = (cards: unknown[]) => {
    return cards
      .map(sanitizeCard)
      .filter((card): card is Record<string, unknown> => card !== null);
  };

  return {
    name: sanitizedName,
    mainDeck: sanitizeDeckSection(deck.mainDeck),
    extraDeck: sanitizeDeckSection(deck.extraDeck),
    sideDeck: sanitizeDeckSection(deck.sideDeck),
    mode: deck.mode === "Master Duel" || deck.mode === "TCG" ? deck.mode : "Master Duel",
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check authentication (optional - anonymous shares allowed)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(token);

        if (!authError && user) {
          userId = user.id;
        }
      }
    }

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
          details: "Maximum 10 shares per hour for authenticated users, 5 for anonymous.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = DeckShareRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request format.",
          details: validationResult.error.format(),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { deck, options } = validationResult.data;

    // Validate deck size limits (Yu-Gi-Oh! rules)
    const totalCards = deck.mainDeck.length + deck.extraDeck.length + deck.sideDeck.length;
    
    if (totalCards === 0) {
      return new Response(
        JSON.stringify({ error: "Deck cannot be empty." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (deck.mainDeck.length < 40) {
      return new Response(
        JSON.stringify({ error: "Main deck must have at least 40 cards." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (deck.mainDeck.length > 60) {
      return new Response(
        JSON.stringify({ error: "Main deck cannot exceed 60 cards." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (deck.extraDeck.length > 15) {
      return new Response(
        JSON.stringify({ error: "Extra deck cannot exceed 15 cards." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (deck.sideDeck.length > 15) {
      return new Response(
        JSON.stringify({ error: "Side deck cannot exceed 15 cards." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (totalCards > 200) {
      return new Response(
        JSON.stringify({ error: "Deck too large. Maximum 200 cards total." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate card counts (max 3 per card)
    const cardCounts = new Map<number, number>();
    const allCards = [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck];
    
    for (const card of allCards) {
      const count = cardCounts.get(card.cardId) || 0;
      cardCounts.set(card.cardId, count + 1);
      
      if (cardCounts.get(card.cardId)! > 3) {
        return new Response(
          JSON.stringify({ 
            error: `Card with ID ${card.cardId} exceeds maximum count of 3.` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Check for prototype pollution vectors
    for (const card of allCards) {
      const cardObj = card as Record<string, unknown>;
      if ("__proto__" in cardObj || "constructor" in cardObj || "prototype" in cardObj) {
        return new Response(
          JSON.stringify({ error: "Invalid deck data: contains dangerous properties." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Sanitize deck data
    const sanitizedDeck = sanitizeDeckData(deck);

    // Generate share token
    const shareToken = generateShareToken();

    // Calculate expiration
    const expiresAt = options?.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Insert into database
    const { data, error } = await supabase
      .from("shared_decks")
      .insert({
        share_token: shareToken,
        deck_data: sanitizedDeck,
        deck_name: sanitizedDeck.name,
        deck_mode: sanitizedDeck.mode,
        created_by: userId,
        expires_at: expiresAt,
        max_access_count: options?.maxAccessCount || null,
        is_active: true,
        access_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating share:", {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        userId: userId || "anonymous",
        deckName: sanitizedDeck.name,
      });
      
      // Don't expose internal error details to client
      return new Response(
        JSON.stringify({
          error: "Failed to create share. Please try again later.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Construct share URL
    const shareUrl = `${supabaseUrl.replace("/rest/v1", "")}/share/${shareToken}`;
    // For frontend, we'll use a relative URL that the frontend can handle
    const frontendShareUrl = `/share/${shareToken}`;

    console.log("Share created successfully:", {
      shareTokenPrefix: shareToken.substring(0, 8) + "...",
      userId: userId || "anonymous",
      deckName: sanitizedDeck.name,
      deckSize: {
        main: sanitizedDeck.mainDeck.length,
        extra: sanitizedDeck.extraDeck.length,
        side: sanitizedDeck.sideDeck.length,
      },
      expiresAt,
      maxAccessCount: options?.maxAccessCount || null,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        shareToken,
        shareUrl: frontendShareUrl, // Return relative URL for frontend
        expiresAt: data.expires_at,
        maxAccessCount: data.max_access_count,
        createdAt: data.created_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Create share endpoint error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Don't expose internal error details to client
    return new Response(
      JSON.stringify({ 
        error: "An unexpected error occurred. Please try again later." 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
