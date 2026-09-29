/**
 * NOT LIVE — legacy twin of the Strategist edge function.
 * Client traffic uses `/functions/v1/strategist` via `lib/api/strategist.ts`.
 * See `NOT_LIVE.md` in this folder. Prefer editing `../strategist/` for coaching changes.
 *
 * Deck Assistant Edge Function
 * Facts-Brain coaching: qa / tune_copies / discover_synergy over validated FactsEnvelope.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveGroqModel } from "../_shared/groq-model.ts";
import { getOrComputeDeckEmbedding } from "./deck-embedder.ts";
import { analyzeDeck } from "./deck-analyzer.ts";
import {
  evaluateStructuralLegality,
  getOrComputeFactsEnvelope,
} from "./get-facts-edge.ts";
import {
  classifyIntentHeuristic,
  resolveAssistantMode,
  resolveCardEntitiesFromNames,
} from "./mode-router.ts";
import { classifyIntent } from "./intent-classifier.ts";
import {
  computeCopyVariants,
  formatVariantsForPrompt,
} from "./tune-variants.ts";
import {
  extractEngineConditions,
  formatConditionsForPrompt,
  parseDiscoveryFilters,
  buildDiscoveryCondition,
  rankConditionsForQuestion,
} from "./engine-conditions.ts";
import { retrieveSynergyCandidates } from "./synergy-retrieval.ts";
import { loadFormatBanlist } from "./synergy-eligibility.ts";
import { generateCoachResponse } from "./coach-response.ts";
import type { Deck, Card } from "./types.ts";
import {
  buildOutOfBoundsCoachResponse,
  type AssistantMode,
  type IntentClassification,
} from "./assistant-contract.ts";
import type { EngineFormat } from "../_shared/engine/types.ts";

Deno.serve(async (req) => {
  console.log(
    `🌐 [deck-assistant/index.ts] Request received: ${req.method} ${new URL(req.url).pathname}`,
  );

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY")?.trim();
    const modelName = resolveGroqModel();

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Authentication required.",
          details: "No Authorization header found in request.",
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: "Authentication failed.",
          details: authError?.message || "Invalid or expired token.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const {
      action,
      deck_id,
      deck,
      user_query,
      question,
      conversation_id,
      mode: rawMode,
      format: rawFormat,
    } = body;

    const userQuery = (question ?? user_query ?? "").toString();

    if (!deck_id && !deck) {
      return new Response(
        JSON.stringify({ error: "Missing deck_id or deck data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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
      const cards = deckRecord.cards as {
        main?: Array<number | { id?: number; cardId?: number; count?: number }>;
        extra?: Array<number | { id?: number; cardId?: number; count?: number }>;
        side?: Array<number | { id?: number; cardId?: number; count?: number }>;
      };
      const mapZone = (
        zone: typeof cards.main,
      ): Deck["mainDeck"] =>
        (zone || []).map((c) => ({
          cardId: typeof c === "number" ? c : c.id || c.cardId || 0,
          count: typeof c === "number" ? 1 : c.count || 1,
        }));
      deckData = {
        mainDeck: mapZone(cards?.main),
        extraDeck: mapZone(cards?.extra),
        sideDeck: mapZone(cards?.side),
      };
    } else if (deck) {
      // Non-chat actions may still accept client deck; chat requires deck_id
      const deckFromClient = deck as Deck & { mode?: string };
      deckData = deckFromClient;
      deckMode = deckFromClient.mode;
      actualDeckId = null;
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

    const cardIds = new Set<number>();
    deckData.mainDeck.forEach((c) => cardIds.add(c.cardId));
    deckData.extraDeck.forEach((c) => cardIds.add(c.cardId));
    deckData.sideDeck.forEach((c) => cardIds.add(c.cardId));

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

    switch (action) {
      case "get_embedding":
      case undefined: {
        if (!actualDeckId) {
          return new Response(
            JSON.stringify({
              error: "deck_id required for embedding computation",
            }),
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
      }

      case "analyze": {
        const analysis = await analyzeDeck(deckData, cards || []);
        return new Response(JSON.stringify({ analysis }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "chat": {
        if (!userQuery || userQuery.trim().length < 2) {
          return new Response(
            JSON.stringify({ error: "question / user_query required for chat" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (!actualDeckId) {
          return new Response(
            JSON.stringify({
              error: "deck_id required for chat action (saved decks only)",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const engineFormat: EngineFormat =
          rawFormat === "TCG" || deckMode === "TCG" ? "TCG" : "MASTER_DUEL";

        return await handleChatRequest({
          userQuery: userQuery.trim(),
          deckId: actualDeckId,
          userId: user.id,
          deck: deckData,
          allCards: cards || [],
          conversationId: conversation_id,
          mode: (rawMode as AssistantMode | undefined) ?? "auto",
          format: engineFormat,
          supabase,
          groqApiKey,
          modelName,
        });
      }

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

async function handleChatRequest(args: {
  userQuery: string;
  deckId: string;
  userId: string;
  deck: Deck;
  allCards: Card[];
  conversationId: string | undefined;
  mode: AssistantMode;
  format: EngineFormat;
  supabase: SupabaseClient;
  groqApiKey: string;
  modelName: string;
}): Promise<Response> {
  const {
    userQuery,
    deckId,
    userId,
    deck,
    allCards,
    conversationId,
    mode,
    format,
    supabase,
    groqApiKey,
    modelName,
  } = args;

  try {
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
      },
    );

    if (convError || !convId) {
      throw new Error(
        `Failed to get/create conversation: ${convError?.message || "Unknown"}`,
      );
    }

    const actualConversationId = conversationId || convId;
    const isNewConversation = !conversationId;

    const { data: messages } = await supabase
      .from("chatbot_messages")
      .select("role, content")
      .eq("conversation_id", actualConversationId)
      .order("sequence_number", { ascending: true });

    const conversationHistory = (messages || []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

    const legality = evaluateStructuralLegality(deck);
    if (!legality.ok) {
      return new Response(
        JSON.stringify({
          error: "Deck is not legal for assistant analysis.",
          details: legality.errors.join("; "),
          legality_errors: legality.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Auto → Groq NLP classifier (heuristic fallback). Explicit modes skip OOB gate.
    let intent: IntentClassification | null = null;
    if (!mode || mode === "auto") {
      intent = await classifyIntent({
        question: userQuery,
        apiKey: groqApiKey,
        modelName,
      });
    }

    // Persist user message early (needed for OOB replies too)
    const { data: userSeqData } = await supabase.rpc(
      "get_next_message_sequence",
      { p_conversation_id: actualConversationId },
    );
    await supabase.from("chatbot_messages").insert({
      conversation_id: actualConversationId,
      role: "user",
      content: userQuery,
      sequence_number: userSeqData || 0,
    });

    if (isNewConversation) {
      const truncatedName =
        userQuery.length > 50
          ? userQuery.substring(0, 47) + "..."
          : userQuery;
      try {
        await supabase
          .from("chatbot_conversations")
          .update({ name: truncatedName })
          .eq("id", actualConversationId);
      } catch {
        // name column may be missing
      }
    }

    if (intent?.is_out_of_bounds) {
      const coach = buildOutOfBoundsCoachResponse(intent);
      const { data: assistantSeqData } = await supabase.rpc(
        "get_next_message_sequence",
        { p_conversation_id: actualConversationId },
      );
      await supabase.from("chatbot_messages").insert({
        conversation_id: actualConversationId,
        role: "assistant",
        content: coach.answer,
        sequence_number: assistantSeqData || 0,
        recommendations: null,
        retrieval_metadata: {
          mode: coach.mode,
          out_of_bounds: true,
          oob_reason: intent.oob_reason,
          intent,
          coach,
        },
      });
      return new Response(
        JSON.stringify({
          type: "coach",
          mode: coach.mode,
          answer: coach.answer,
          confidence: coach.confidence,
          limitations: coach.limitations,
          evidence: coach.evidence,
          tuning: null,
          synergies: null,
          redirectHint: coach.redirectHint ?? null,
          text: coach.answer,
          recommendations: null,
          conversation_id: actualConversationId,
          coach,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const facts = await getOrComputeFactsEnvelope(supabase, {
      deckId,
      deck,
      allCards,
      format,
    });

    const resolvedMode = resolveAssistantMode(mode, userQuery, intent);
    const mainDeckSize = deck.mainDeck.reduce(
      (s, c) => s + (c.count ?? 1),
      0,
    );

    const resolvedTargetCardIds = resolveCardEntitiesFromNames(
      intent?.target_card_entities ?? [],
      allCards.map((c) => ({ id: c.id, name: c.name })),
    );

    let variantsBlock = "";
    let variants: ReturnType<typeof computeCopyVariants> = [];
    let conditionsBlock = "";
    let conditions: ReturnType<typeof extractEngineConditions> = [];
    let retrievedBlock = "";
    let retrieved: Awaited<ReturnType<typeof retrieveSynergyCandidates>> = [];

    if (resolvedMode === "tune_copies") {
      const { data: weightRows } = await supabase
        .from("card_strategy_weights")
        .select("card_id, role, is_boss, synergy_weight")
        .eq("format", format);
      const weights = (weightRows ?? []).map((row) => ({
        cardId: String(row.card_id),
        role: String(row.role),
        isBoss: Boolean(row.is_boss),
        synergyWeight: Number(row.synergy_weight ?? 0),
      }));
      variants = computeCopyVariants({
        deck,
        allCards,
        weights,
        baseline: facts,
        preferCardIds: resolvedTargetCardIds,
      });
      variantsBlock = formatVariantsForPrompt(variants);
    }

    if (resolvedMode === "discover_synergy") {
      const detected = extractEngineConditions(deck, allCards);
      conditions = rankConditionsForQuestion(detected, userQuery);
      const discovery = buildDiscoveryCondition(
        parseDiscoveryFilters(userQuery),
        detected.flatMap((c) => c.satisfiedByDeck),
      );
      if (discovery) {
        conditions = [
          discovery,
          ...conditions.filter((c) => c.slug !== "card_discovery"),
        ].slice(0, 4);
      }
      conditionsBlock = formatConditionsForPrompt(conditions);
      const deckCardIds = [
        ...deck.mainDeck.map((c) => c.cardId),
        ...deck.extraDeck.map((c) => c.cardId),
        ...deck.sideDeck.map((c) => c.cardId),
      ];
      const banlist = await loadFormatBanlist(supabase, format);
      retrieved = await retrieveSynergyCandidates({
        conditions,
        deckCardIds,
        primaryArchetype: facts.diagnostics.strategyFit.primaryArchetype,
        supabase,
        banlistFormat: format,
        deck,
        banlist,
        userQuery,
      });
      // Drop Extra Deck candidates when active ED locks make them soft-illegal.
      const edLocks = (facts.diagnostics.restrictions ?? []).filter(
        (r) => r.appliesTo === "extra_deck",
      );
      const lockScoped =
        intent?.qa_focus === "anti_synergy" ||
        /\b(lock|anti[- ]?synergy|extra\s+deck)\b/i.test(userQuery);
      if (edLocks.length > 0 && lockScoped) {
        const { isLikelyExtraDeckCard } = await import("./restrictions.ts");
        retrieved = retrieved.filter((r) => !isLikelyExtraDeckCard(r.card));
      }
      // Lean RETRIEVED_CARDS block is built inside generateCoachResponse
      retrievedBlock = "";
    }

    // If auto classification was skipped (explicit mode), still attach heuristic intent for prompt focus
    const promptIntent =
      intent ??
      (mode && mode !== "auto"
        ? {
          ...classifyIntentHeuristic(userQuery),
          inferred_mode: resolvedMode,
          is_out_of_bounds: false,
          oob_reason: null,
        }
        : classifyIntentHeuristic(userQuery));

    let sideDeckBlock = "";
    let matchupBlock = "";
    if (
      resolvedMode === "qa" &&
      (promptIntent.qa_focus === "side_plan" ||
        promptIntent.qa_focus === "meta_matchup" ||
        /\b(side\s+deck|side\s+plan|matchup|going\s+first|going\s+second)\b/i
          .test(userQuery))
    ) {
      const cardMap = new Map(allCards.map((c) => [c.id, c]));
      const sideLines = deck.sideDeck
        .map((e) => {
          const c = cardMap.get(e.cardId);
          return c ? `- ${c.name} x${e.count ?? 1}` : null;
        })
        .filter(Boolean)
        .slice(0, 20);
      sideDeckBlock =
        sideLines.length > 0
          ? `# SIDE_DECK\n${sideLines.join("\n")}`
          : "# SIDE_DECK\nEmpty — say so if side_plan was asked.";
      const mu = facts.matchups.slice(0, 8).map(
        (m) =>
          `- ${m.opponentArchetype}${m.tier ? ` T${m.tier}` : ""} tagAdvantage=${m.tagAdvantage.toFixed(2)}`,
      );
      matchupBlock =
        mu.length > 0
          ? `# MATCHUP_ATTACHMENT\n${mu.join("\n")}`
          : "# MATCHUP_ATTACHMENT\nThin — do not invent live meta tiers.";
    }

    const coach = await generateCoachResponse({
      question: userQuery,
      mode: resolvedMode,
      facts,
      conversationHistory,
      apiKey: groqApiKey,
      modelName,
      variantsBlock,
      variants,
      conditionsBlock,
      conditions,
      retrievedBlock,
      retrieved,
      mainDeckSize,
      intent: promptIntent,
      resolvedTargetCardIds,
      sideDeckBlock,
      matchupBlock,
    });

    // Legacy recommendation projection for older UI slideshow (from synergies)
    const legacyRecommendations = (coach.synergies ?? []).map((s) => ({
      cardId: Number(s.cardId) || 0,
      cardName: s.title,
      reason: s.fitSummary,
      priority: "medium" as const,
      canAdd: true,
      synergyScore: 0.7,
    }));

    const { data: assistantSeqData } = await supabase.rpc(
      "get_next_message_sequence",
      { p_conversation_id: actualConversationId },
    );

    await supabase.from("chatbot_messages").insert({
      conversation_id: actualConversationId,
      role: "assistant",
      content: coach.answer,
      sequence_number: assistantSeqData || 0,
      recommendations: legacyRecommendations.length
        ? legacyRecommendations
        : null,
      retrieval_metadata: {
        mode: resolvedMode,
        intent: promptIntent,
        resolved_target_card_ids: resolvedTargetCardIds,
        coach,
        variants_count: variants.length,
        conditions: conditions.map((c) => c.slug),
        candidates_count: retrieved.length,
      },
    });

    return new Response(
      JSON.stringify({
        type: "coach",
        mode: coach.mode,
        answer: coach.answer,
        confidence: coach.confidence,
        limitations: coach.limitations,
        evidence: coach.evidence,
        tuning: coach.tuning ?? null,
        synergies: coach.synergies ?? null,
        redirectHint: coach.redirectHint ?? null,
        // Back-compat fields
        text: coach.answer,
        recommendations: legacyRecommendations.length
          ? legacyRecommendations
          : null,
        conversation_id: actualConversationId,
        coach,
      }),
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
