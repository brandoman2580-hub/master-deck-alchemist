/**
 * Deck Assistant Edge Function
 * Deck Analysis, Embedding System, and Self-Querying Retrieval
 * 
 * Provides endpoints for:
 * - Getting/computing deck embeddings
 * - Getting deck analysis
 * - Self-querying retrieval with RAG
 * - Conversation management
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { getOrComputeDeckEmbedding } from "./deck-embedder.ts";
import { analyzeDeck } from "./deck-analyzer.ts";
import { generateStructuredQuery } from "./self-query.ts";
import { retrieveCards } from "./rag-retrieval.ts";
import { generateRecommendations } from "./response-generator.ts"; // Uses prompts.ts
import type { Deck, Card } from "./types.ts";
import type { Message } from "./self-query.ts";

Deno.serve(async (req) => {
  console.log(`🌐 [deck-assistant/index.ts] Request received: ${req.method} ${new URL(req.url).pathname}`);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY")?.trim();
    const modelName = Deno.env.get("MODEL_NAME")?.trim() || "llama-3.3-70b-versatile";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
    });

    // Verify Supabase connection by testing cards table access
    const { data: testCards, error: testError } = await supabase
      .from("cards")
      .select("id")
      .limit(1);
    
    if (testError) {
      console.error("❌ Cannot access cards table:", {
        error: testError.message,
        code: testError.code,
        details: testError.details,
        hint: testError.hint,
      });
    } else {
      console.log(`✅ Cards table accessible. Test query returned ${testCards?.length || 0} cards`);
    }

    // Check authentication (simplified pattern matching recommend-cards)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Authentication required.",
          details: "No Authorization header found in request. Please ensure you are logged in.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Invalid authentication token.",
          details: "Token is empty or malformed.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if token is a service role key (for better error messages)
    try {
      const tokenParts = token.split(".");
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        console.log("🔍 Token payload check:", {
          role: payload.role,
          hasSub: !!payload.sub,
          sub: payload.sub,
        });
        
        if (payload.role === "service_role" && !payload.sub) {
          console.warn("⚠️ Service role key detected in Authorization header - returning helpful error");
          return new Response(
            JSON.stringify({
              error: "Service role key detected.",
              details:
                "You're using a service role key as the Authorization token. " +
                "Edge functions require a user access token (JWT with 'sub' claim), not a service role key. " +
                "To test this function:\n" +
                "1. Log in via your application\n" +
                "2. Get the access_token from the session\n" +
                "3. Use that token in the Authorization header: Bearer <access_token>\n\n" +
                "In Supabase test interface, you may need to manually provide a user access token.",
              hint: "Service role keys are for server-side operations only, not for Authorization headers.",
            }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    } catch (e) {
      // If we can't decode, continue to let Supabase handle validation
      console.warn("⚠️ Could not decode token payload (continuing):", e);
    }

    // Validate user token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("❌ Auth error:", authError?.message || "No user returned");
      console.error("   Auth error details:", JSON.stringify(authError));
      
      // Provide more helpful error message for missing sub claim
      let errorDetails = authError?.message || "Invalid or expired token.";
      if (authError?.message?.includes("missing sub claim") || authError?.code === "bad_jwt") {
        errorDetails +=
          " This usually means you're using a service role key or API key instead of a user access token. " +
          "Please use a user access token from a logged-in session.";
      }
      
      return new Response(
        JSON.stringify({
          error: "Authentication failed.",
          details: errorDetails,
          error_code: authError?.status,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("✅ User authenticated:", user.id);

    const { action, deck_id, deck, user_query, conversation_id } = await req.json();

    if (!deck_id && !deck) {
      return new Response(
        JSON.stringify({ error: "Missing deck_id or deck data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Load deck from database if deck_id provided
    let deckData: Deck | null = null;
    let actualDeckId: string | null = null;
    let deckMode: string | undefined;

    if (deck_id) {
      const { data: deckRecord, error: deckError } = await supabase
        .from("decks")
        .select("id, cards, user_id, mode")
        .eq("id", deck_id)
        .eq("user_id", user.id)
        .single();

      if (deckError || !deckRecord) {
        return new Response(
          JSON.stringify({ error: "Deck not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      actualDeckId = deckRecord.id;
      deckMode = deckRecord.mode as string | undefined;
      const cards = deckRecord.cards as any;
      deckData = {
        mainDeck: (cards?.main || []).map((c: any) => ({
          cardId: typeof c === "number" ? c : c.id || c.cardId,
          count: c.count || 1,
        })),
        extraDeck: (cards?.extra || []).map((c: any) => ({
          cardId: typeof c === "number" ? c : c.id || c.cardId,
          count: c.count || 1,
        })),
        sideDeck: (cards?.side || []).map((c: any) => ({
          cardId: typeof c === "number" ? c : c.id || c.cardId,
          count: c.count || 1,
        })),
      };
    } else if (deck) {
      // Use provided deck data (mode may be in deck object from client)
      const deckFromClient = deck as Deck & { mode?: string };
      deckData = deckFromClient;
      deckMode = deckFromClient.mode;
      actualDeckId = null; // Will need to be provided or created
    }

    if (!deckData) {
      return new Response(
        JSON.stringify({ error: "Invalid deck data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Load all cards for analysis
    const cardIds = new Set<number>();
    deckData.mainDeck.forEach(c => cardIds.add(c.cardId));
    deckData.extraDeck.forEach(c => cardIds.add(c.cardId));
    deckData.sideDeck.forEach(c => cardIds.add(c.cardId));

    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("*")
      .in("id", Array.from(cardIds));

    if (cardsError) {
      return new Response(
        JSON.stringify({ error: `Failed to load cards: ${cardsError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle different actions
    switch (action) {
      case "get_embedding":
      case undefined: // Default action
        if (!actualDeckId) {
          return new Response(
            JSON.stringify({ error: "deck_id required for embedding computation" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const result = await getOrComputeDeckEmbedding(
          deckData,
          actualDeckId,
          user.id,
          cards || [],
          supabase,
        );

        return new Response(
          JSON.stringify({
            embedding: result.embedding,
            analysis: result.analysis,
            deck_id: actualDeckId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );

      case "analyze":
        const analysis = await analyzeDeck(deckData, cards || []);

        return new Response(
          JSON.stringify({
            analysis,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );

      case "chat":
        console.log("💬 [deck-assistant/index.ts] Chat action received");
        console.log(`📝 Raw user_query: "${user_query}"`);
        console.log(`🆔 Raw deck_id: ${deck_id}`);
        
        //: Self-querying retrieval with conversation
        if (!user_query) {
          return new Response(
            JSON.stringify({ error: "user_query required for chat action" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (!actualDeckId) {
          return new Response(
            JSON.stringify({ error: "deck_id required for chat action" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const deckFormat: "TCG" | "Master Duel" =
          deckMode === "TCG" ? "TCG" : "Master Duel"; // Default to Master Duel if mode unknown

        return await handleChatRequest(
          user_query,
          actualDeckId,
          user.id,
          deckData,
          cards || [],
          conversation_id,
          supabase,
          groqApiKey,
          modelName,
          deckFormat,
        );

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
    }
  } catch (error) {
    console.error("Deck Assistant error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/**
 * Handle chat request with self-querying retrieval
 */
async function handleChatRequest(
  userQuery: string,
  deckId: string,
  userId: string,
  deck: Deck,
  allCards: Card[],
  conversationId: string | undefined,
  supabase: SupabaseClient,
  apiKey: string,
  modelName: string,
  deckFormat: "TCG" | "Master Duel" = "Master Duel"
): Promise<Response> {
  console.log("🚀 [deck-assistant/index.ts] handleChatRequest called");
  console.log(`📝 User query: "${userQuery}"`);
  console.log(`🆔 Deck ID: ${deckId}, User ID: ${userId}`);
  
  try {
    // 1. Get or create conversation
    const deckSnapshot = {
      main: deck.mainDeck,
      extra: deck.extraDeck,
      side: deck.sideDeck,
    };

    const { data: convId, error: convError } = await supabase.rpc(
      "get_or_create_conversation",
      {
        p_deck_id: deckId,
        p_user_id: userId,
        p_deck_snapshot: deckSnapshot,
      }
    );

    if (convError || !convId) {
      throw new Error(`Failed to get/create conversation: ${convError?.message || "Unknown error"}`);
    }

    const actualConversationId = conversationId || convId;
    
    // Check if this is a new conversation (no conversationId was provided)
    const isNewConversation = !conversationId;

    // 2. Load conversation history
    const { data: messages, error: historyError } = await supabase
      .from("chatbot_messages")
      .select("role, content")
      .eq("conversation_id", actualConversationId)
      .order("sequence_number", { ascending: true });

    if (historyError) {
      console.warn("Failed to load conversation history:", historyError);
    }

    const conversationHistory: Message[] = (messages || []).map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 3. Get or compute deck embedding + analysis (embedding cached for consistency)
    const { analysis: deckAnalysis } = await getOrComputeDeckEmbedding(
        deck,
        deckId,
        userId,
        allCards,
        supabase,
      );

    // 4. Extract deck card IDs and archetypes for exclusion
    const deckCardIds = [
      ...deck.mainDeck.map(c => c.cardId),
      ...deck.extraDeck.map(c => c.cardId),
      ...deck.sideDeck.map(c => c.cardId),
    ];

    const deckArchetypes: string[] = [];
    allCards.forEach(card => {
      if (deckCardIds.includes(card.id) && card.archetype) {
        if (!deckArchetypes.includes(card.archetype)) {
          deckArchetypes.push(card.archetype);
        }
      }
    });

    // 5. Generate structured query (self-querying)
    const structuredQuery = await generateStructuredQuery(
      userQuery,
      deckAnalysis,
      conversationHistory,
      apiKey,
      modelName,
      deckCardIds,
      deckArchetypes,
    );

    // 6. Check if clarification needed
    if (structuredQuery.needsClarification) {
      // Save clarification question
      const { data: seqData } = await supabase.rpc("get_next_message_sequence", {
        p_conversation_id: actualConversationId,
      });

      await supabase.from("chatbot_messages").insert({
        conversation_id: actualConversationId,
        role: "assistant",
        content: structuredQuery.clarificationQuestion || "Could you provide more details?",
        sequence_number: seqData || 0,
      });

      return new Response(
        JSON.stringify({
          type: "clarification",
          question: structuredQuery.clarificationQuestion,
          conversation_id: actualConversationId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 7. Save user message
    const { data: userSeqData } = await supabase.rpc("get_next_message_sequence", {
      p_conversation_id: actualConversationId,
    });

    await supabase.from("chatbot_messages").insert({
      conversation_id: actualConversationId,
      role: "user",
      content: userQuery,
      sequence_number: userSeqData || 0,
    });

    // If this is a new conversation, set the name from the first user message
    if (isNewConversation) {
      const conversationName = userQuery.trim().replace(/\s+/g, " ");
      const truncatedName = conversationName.length > 50 
        ? conversationName.substring(0, 47) + "..." 
        : conversationName;
      
      // Try to update conversation name (gracefully fail if name column doesn't exist)
      try {
        const { error: nameError } = await supabase
          .from("chatbot_conversations")
          .update({ name: truncatedName })
          .eq("id", actualConversationId);
        
        if (nameError) {
          // Only warn if it's not a missing column error
          if (!nameError.message.includes("column") && !nameError.message.includes("does not exist")) {
            console.warn("Failed to set conversation name:", nameError.message);
          } else {
            console.log("Name column does not exist yet, skipping name update");
          }
        }
      } catch (err) {
        // Silently fail if name column doesn't exist
        console.log("Name column may not exist yet, skipping name update");
      }
    }

    // 8. Build deck cards with names for ratio suggestions
    const deckCardsWithNames = deck.mainDeck.map(dc => {
      const card = allCards.find(c => c.id === dc.cardId);
      return {
        cardId: dc.cardId,
        cardName: card?.name || `Card ${dc.cardId}`,
        count: dc.count || 1,
      };
    });

    // 9. Retrieve cards (RAG) - skip if ratio question
    const isRatioQuestion = userQuery.toLowerCase().includes('ratio') || 
                            userQuery.toLowerCase().includes('adjust') ||
                            userQuery.toLowerCase().includes('optimize');
    
    console.log(`🔍 [deck-assistant/index.ts] Retrieving cards (isRatioQuestion: ${isRatioQuestion})`);
    console.log(`📊 [deck-assistant/index.ts] Structured query: ${JSON.stringify(structuredQuery)}`);
    
    const banlistFormat =
      deckFormat === "TCG" ? "TCG" : "MASTER_DUEL";

    const candidates = isRatioQuestion ? [] : await retrieveCards(
      structuredQuery,
      deckAnalysis,
      supabase,
      banlistFormat,
    );
    
    console.log(`📊 [deck-assistant/index.ts] RAG retrieval returned ${candidates.length} candidates`);
    if (candidates.length > 0) {
      console.log(`📊 [deck-assistant/index.ts] First 5 candidate IDs: ${candidates.slice(0, 5).map(c => c.id).join(", ")}`);
    }

    // 10. Generate LLM response with recommendations or ratio suggestions
    console.log(`🔍 [deck-assistant/index.ts] Generating recommendations for query: "${userQuery}"`);
    console.log(`📊 [deck-assistant/index.ts] Candidates count: ${candidates.length}`);
    console.log(`📊 [deck-assistant/index.ts] Deck card IDs count: ${deckCardIds.length}`);
    
    const response = await generateRecommendations(
      userQuery,
      deckAnalysis,
      candidates,
      conversationHistory,
      apiKey,
      modelName,
      deckCardIds,
      deckCardsWithNames, // Pass deck cards for ratio suggestions
      deckFormat,
    );
    
    console.log(`✅ [deck-assistant/index.ts] Response received:`);
    console.log(`   - Type: ${response.ratioSuggestions ? "ratio_suggestions" : "recommendations"}`);
    console.log(`   - Recommendations count: ${response.recommendations?.length || 0}`);
    console.log(`   - Ratio suggestions count: ${response.ratioSuggestions?.length || 0}`);
    if (response.recommendations && response.recommendations.length > 0) {
      const cardIds = response.recommendations.map(r => r.cardId);
      const uniqueIds = [...new Set(cardIds)];
      console.log(`   - Recommendation card IDs (${cardIds.length} total, ${uniqueIds.length} unique): ${cardIds.join(", ")}`);
      if (cardIds.length !== uniqueIds.length) {
        console.warn(`   ⚠️ DUPLICATES DETECTED: ${cardIds.length - uniqueIds.length} duplicate card IDs in recommendations!`);
      }
      console.log(`   - Recommendation card names: ${response.recommendations.map(r => r.cardName).join(", ")}`);
    }

    // 11. Save assistant response
    const { data: assistantSeqData } = await supabase.rpc("get_next_message_sequence", {
      p_conversation_id: actualConversationId,
    });

    await supabase.from("chatbot_messages").insert({
      conversation_id: actualConversationId,
      role: "assistant",
      content: response.text,
      sequence_number: assistantSeqData || 0,
      recommendations: response.recommendations ? response.recommendations.map(rec => ({
        cardId: rec.cardId,
        cardName: rec.cardName,
        reason: rec.reason,
        priority: rec.priority,
        impactEst: rec.impactEst,
        synergyScore: rec.synergyScore,
      })) : null,
      retrieval_metadata: {
        query: structuredQuery,
        candidates_count: candidates.length,
        ratio_suggestions: response.ratioSuggestions || null,
      },
    });

    // 12. Return response
    const responsePayload = {
      type: response.ratioSuggestions ? "ratio_suggestions" : "recommendations",
      text: response.text,
      recommendations: response.recommendations || null,
      ratioSuggestions: response.ratioSuggestions || null,
      conversation_id: actualConversationId,
      structured_query: structuredQuery,
    };
    
    console.log(`📤 [deck-assistant/index.ts] Sending response with ${responsePayload.recommendations?.length || 0} recommendations`);
    
    return new Response(
      JSON.stringify(responsePayload),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Chat request error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
