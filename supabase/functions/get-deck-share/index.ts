/**
 * Get Deck Share Edge Function
 * 
 * Retrieves deck data by share token and increments access count.
 * No authentication required - shares are public.
 */

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use GET." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let token: string | null = null;
  
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

    // Extract token from URL path or query parameter
    const url = new URL(req.url);
    token = url.searchParams.get("token");
    
    // If not in query params, try to extract from path
    if (!token) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const functionIndex = pathParts.indexOf("get-deck-share");
      if (functionIndex >= 0 && pathParts.length > functionIndex + 1) {
        token = pathParts[functionIndex + 1];
      }
    }

    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Share token is required.",
          details: "Provide token as URL parameter: /get-deck-share/{token} or ?token={token}",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate token format (strict check)
    // Tokens should be base64url encoded (43 chars for 32 bytes)
    if (token.length < 32 || token.length > 128) {
      return new Response(
        JSON.stringify({ error: "Invalid share token format." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate token contains only URL-safe base64url characters
    if (!/^[A-Za-z0-9_-]+$/.test(token)) {
      return new Response(
        JSON.stringify({ error: "Invalid share token format: contains invalid characters." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get deck data and increment access count atomically
    const { data: deckData, error: functionError } = await supabase.rpc(
      "increment_shared_deck_access",
      { token },
    );

    if (functionError) {
      console.error("Error accessing share:", {
        error: functionError.message,
        code: functionError.code,
        tokenPrefix: token.substring(0, 8) + "...",
      });
      
      // Check if it's because the share doesn't exist or is invalid
      if (functionError.code === "P0001" || functionError.message.includes("not found")) {
        return new Response(
          JSON.stringify({
            error: "Share not found or expired.",
            details: "The share link may have expired, reached its access limit, or been revoked.",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Don't expose internal error details to client
      return new Response(
        JSON.stringify({
          error: "Failed to retrieve share. Please try again later.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!deckData) {
      return new Response(
        JSON.stringify({
          error: "Share not found or expired.",
          details: "The share link may have expired, reached its access limit, or been revoked.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get metadata (without incrementing access again)
    const { data: metadata, error: metadataError } = await supabase.rpc(
      "get_shared_deck_metadata",
      { token },
    );

    if (metadataError) {
      console.error("Error fetching metadata:", metadataError);
      // Continue anyway - metadata is optional
    }

    console.log("Share accessed successfully:", {
      tokenPrefix: token.substring(0, 8) + "...", // Log partial token for security
      hasMetadata: !!metadata,
      accessCount: metadata && metadata.length > 0 ? metadata[0].access_count : null,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        deck: deckData,
        metadata: metadata && metadata.length > 0 ? {
          deckName: metadata[0].deck_name,
          deckMode: metadata[0].deck_mode,
          createdAt: metadata[0].created_at,
          expiresAt: metadata[0].expires_at,
          accessCount: metadata[0].access_count,
          maxAccessCount: metadata[0].max_access_count,
        } : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Get share endpoint error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      tokenPrefix: token ? token.substring(0, 8) + "..." : "unknown",
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
