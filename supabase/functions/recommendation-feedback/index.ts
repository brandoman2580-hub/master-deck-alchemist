// Recommendation feedback ingestion endpoint
// Rationale: Secure, idempotent feedback collection with rate limiting and spam detection

import { createClient } from "@supabase/supabase-js";
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

    // Parse request body
    const { recommendation_id, feedback_type, feedback_text } =
      await req.json();

    // Validate input
    if (!recommendation_id || typeof recommendation_id !== "string") {
      return new Response(
        JSON.stringify({
          error: "recommendation_id is required and must be a string.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (
      !feedback_type ||
      !["approved", "disapproved"].includes(feedback_type)
    ) {
      return new Response(
        JSON.stringify({
          error: "feedback_type must be 'approved' or 'disapproved'.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Spam detection
    if (detectSpam(feedback_text)) {
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
