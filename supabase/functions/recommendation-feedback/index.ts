// Recommendation feedback ingestion endpoint (Phase 4)
// Rationale: Secure, idempotent feedback collection with rate limiting and spam detection
// Supports both legacy format and new telemetry schema

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { corsHeaders } from "../_shared/cors.ts";

// Rate limiting: Max 10 feedback submissions per minute per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

// In-memory rate limit store (for edge function statelessness, consider Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
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

// Basic spam detection: Check for suspicious patterns
function detectSpam(feedbackText: string | null): boolean {
  if (!feedbackText) return false;

  const text = feedbackText.toLowerCase();
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters (e.g., "aaaaaaaaaa")
    /.{500,}/, // Extremely long text
    /(http|www\.|\.com|\.net)/i, // URLs
    /(buy|sell|cheap|discount|offer)/i, // Commercial keywords
  ];

  return spamPatterns.some((pattern) => pattern.test(text));
}

// ============================================================================
// Phase 4: Telemetry Schema
// ============================================================================

const TelemetryFeedbackZ = z.object({
  deckFingerprint: z.string(),
  suggestionId: z.string(),
  accepted: z.boolean(),
  timestamp: z.string().optional(), // ISO string, defaults to now
  userId: z.string().optional(), // Optional, will use auth user if not provided
  // Phase 5: Rich feedback fields
  cardId: z.string().optional(),
  rejectionReasons: z.array(z.string()).optional(),
  feedbackText: z.string().optional(),
  context: z.record(z.string(), z.any()).optional(),
});

// Legacy feedback schema (for backward compatibility)
const LegacyFeedbackZ = z.object({
  recommendation_id: z.string(),
  feedback_type: z.enum(["approved", "disapproved"]),
  feedback_text: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Check authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate JWT
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse and validate request body
    const body = await req.json();

    // Phase 4: Try new telemetry schema first, fallback to legacy
    console.log("Feedback request body:", JSON.stringify(body, null, 2));
    const telemetryResult = TelemetryFeedbackZ.safeParse(body);
    const legacyResult = LegacyFeedbackZ.safeParse(body);
    console.log("Telemetry validation:", {
      success: telemetryResult.success,
      errors: telemetryResult.success ? null : telemetryResult.error.format(),
    });
    console.log("Legacy validation:", {
      success: legacyResult.success,
      errors: legacyResult.success ? null : legacyResult.error.format(),
    });

    if (telemetryResult.success) {
      // New telemetry format
      const telemetry = telemetryResult.data;
      const timestamp = telemetry.timestamp || new Date().toISOString();
      const userId = telemetry.userId || user.id;

      // Spam detection (Phase 5): Apply basic screening to free-text.
      if (detectSpam(telemetry.feedbackText || null)) {
        return new Response(
          JSON.stringify({ error: "Feedback rejected due to spam detection." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Insert telemetry data
      const { data, error } = await supabase
        .from("recommendation_telemetry")
        .insert({
          deck_fingerprint: telemetry.deckFingerprint,
          suggestion_id: telemetry.suggestionId,
          accepted: telemetry.accepted,
          timestamp,
          user_id: userId,
          card_id: telemetry.cardId || null,
          rejection_reasons: telemetry.rejectionReasons || null,
          feedback_text: telemetry.feedbackText || null,
          context: telemetry.context || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting telemetry:", {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          table: "recommendation_telemetry",
          data: {
            deck_fingerprint: telemetry.deckFingerprint,
            suggestion_id: telemetry.suggestionId,
            accepted: telemetry.accepted,
            user_id: userId,
          },
        });
        return new Response(
          JSON.stringify({
            error: "Failed to save telemetry.",
            details: error.message,
            code: error.code,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log("Telemetry recorded:", {
        deckFingerprint: telemetry.deckFingerprint,
        suggestionId: telemetry.suggestionId,
        accepted: telemetry.accepted,
        userId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          telemetry_id: data.id,
          message: "Telemetry recorded successfully.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else if (legacyResult.success) {
      // Legacy format (backward compatibility)
      const { recommendation_id, feedback_type, feedback_text } =
        legacyResult.data;

      // Spam detection
      if (detectSpam(feedback_text ?? null)) {
        return new Response(
          JSON.stringify({ error: "Feedback rejected due to spam detection." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Insert or update feedback (idempotent via ON CONFLICT)
      const { data, error } = await supabase
        .from("recommendation_feedback")
        .upsert(
          {
            recommendation_id,
            user_id: user.id,
            feedback_type,
            feedback_text: feedback_text || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "recommendation_id,user_id",
          },
        )
        .select()
        .single();

      if (error) {
        console.error("Error inserting feedback:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save feedback." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Log feedback submission
      console.log("Feedback recorded:", {
        recommendation_id,
        user_id: user.id,
        feedback_type,
        has_text: !!feedback_text,
      });

      return new Response(
        JSON.stringify({
          success: true,
          feedback_id: data.id,
          message: "Feedback recorded successfully.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      // Invalid format
      return new Response(
        JSON.stringify({
          error: "Invalid request format. Expected telemetry schema or legacy feedback schema.",
          details: {
            telemetry_errors: telemetryResult.error?.format(),
            legacy_errors: legacyResult.error?.format(),
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error: unknown) {
    console.error("Feedback endpoint error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
