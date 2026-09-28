/**
 * Strategist Edge Function
 * Facts-Brain coaching: qa / tune_copies / discover_synergy / optimize over FactsEnvelope.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveGroqModel } from "../_shared/groq-model.ts";
import { getOrComputeDeckEmbedding } from "./deck-embedder.ts";
import { analyzeDeck } from "./deck-analyzer.ts";
import {
  evaluateDeckLegality,
  getOrComputeFactsEnvelope,
  listComboTemplateArchetypeNames,
  loadComboTemplatesForArchetypes,
} from "./get-facts-edge.ts";
import {
  collectDeckArchetypes,
  resolveBridgeArchetypes,
} from "./bridge-archetypes.ts";
import {
  classifyIntentHeuristic,
  classifyOutOfBoundsHeuristic,
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
import {
  banStatus,
  extractCandidateCardNames,
  fetchCardTexts,
  formatGroundingBlock,
  verifyCardNames,
} from "./verify-cards.ts";
import type { Deck, Card } from "./types.ts";
import {
  buildOutOfBoundsCoachResponse,
  type AssistantMode,
  type IntentClassification,
} from "./assistant-contract.ts";
import type { EngineFormat, FactsEnvelope } from "../_shared/engine/types.ts";
import {
  formatUnknownCardsRejection,
  sanitizeLiveDeckSnapshot,
  type DeckSnapshotPayload,
} from "./sanitize-snapshot.ts";
import {
  packDeckCardsForPrompt,
  type PackableDeckCard,
} from "../_shared/engine/prompt-packing.ts";
import { detectHeuristicRoleSlugs } from "../_shared/engine/card-role-heuristics.ts";

/** Lightweight role tags for DECK_CARDS packing (prompt only). */
function inferPackRoles(card: Card): string[] {
  return detectHeuristicRoleSlugs(card);
}

function buildPackableDeckCards(
  deck: Deck,
  allCards: Card[],
): PackableDeckCard[] {
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const out: PackableDeckCard[] = [];

  const pushZone = (
    zone: Deck["mainDeck"],
    section: PackableDeckCard["section"],
  ) => {
    for (const entry of zone) {
      const card = cardMap.get(entry.cardId);
      if (!card) continue;
      out.push({
        id: card.id,
        name: card.name,
        count: entry.count ?? 1,
        section,
        roles: inferPackRoles(card),
      });
    }
  };

  pushZone(deck.mainDeck, "main");
  pushZone(deck.extraDeck, "extra");
  pushZone(deck.sideDeck, "side");
  return out;
}

Deno.serve(async (req) => {
  console.log(
    `🌐 [strategist/index.ts] Request received: ${req.method} ${new URL(req.url).pathname}`,
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
      deck_snapshot,
      user_query,
      question,
      conversation_id,
      mode: rawMode,
      format: rawFormat,
    } = body;

    const userQuery = (question ?? user_query ?? "").toString();

    if (!deck_id && !deck) {
      return new Response(
        JSON.stringify({
          error: "A saved deck is required to use Strategist.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let deckData: Deck | null = null;
    let actualDeckId: string | null = null;
    let deckMode: string | undefined;
    let cards: Card[] | null = null;

    if (deck_id) {
      const { data: deckRecord, error: deckError } = await supabase
        .from("decks")
        .select("id, cards, user_id, mode")
        .eq("id", deck_id)
        .eq("user_id", user.id)
        .single();

      if (deckError || !deckRecord) {
        return new Response(
          JSON.stringify({
            error: "That deck could not be found for your account.",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      actualDeckId = deckRecord.id;
      deckMode = deckRecord.mode as string | undefined;
      const savedCards = deckRecord.cards as {
        main?: Array<number | { id?: number; cardId?: number; count?: number }>;
        extra?: Array<number | { id?: number; cardId?: number; count?: number }>;
        side?: Array<number | { id?: number; cardId?: number; count?: number }>;
      };
      const mapZone = (
        zone: typeof savedCards.main,
      ): Deck["mainDeck"] =>
        (zone || []).map((c) => ({
          cardId: typeof c === "number" ? c : c.id || c.cardId || 0,
          count: typeof c === "number" ? 1 : c.count || 1,
        }));
      deckData = {
        mainDeck: mapZone(savedCards?.main),
        extraDeck: mapZone(savedCards?.extra),
        sideDeck: mapZone(savedCards?.side),
      };

      // Chat prefers a live Workshop snapshot (id+count), sanitized against cards.
      const liveSnapshot = deck_snapshot as DeckSnapshotPayload | undefined;
      const hasLiveSnapshot =
        action === "chat" &&
        liveSnapshot &&
        (Array.isArray(liveSnapshot.main) ||
          Array.isArray(liveSnapshot.extra) ||
          Array.isArray(liveSnapshot.side));

      if (hasLiveSnapshot) {
        try {
          const sanitized = await sanitizeLiveDeckSnapshot(
            supabase,
            liveSnapshot,
          );
          if (!sanitized.ok) {
            return new Response(
              JSON.stringify({
                error: formatUnknownCardsRejection(sanitized.unknownCardIds),
                unknown_card_ids: sanitized.unknownCardIds,
              }),
              {
                status: 400,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              },
            );
          }
          deckData = sanitized.deck;
          cards = sanitized.allCards;
        } catch {
          return new Response(
            JSON.stringify({
              error:
                "Unable to verify cards in your deck against the card library.",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    } else if (deck) {
      // Non-chat actions may still accept client deck; chat requires deck_id
      const deckFromClient = deck as Deck & { mode?: string };
      deckData = deckFromClient;
      deckMode = deckFromClient.mode;
      actualDeckId = null;
    }

    if (!deckData) {
      return new Response(
        JSON.stringify({
          error: "Your deck list could not be read. Check the list and try again.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!cards) {
      const cardIds = new Set<number>();
      deckData.mainDeck.forEach((c) => cardIds.add(c.cardId));
      deckData.extraDeck.forEach((c) => cardIds.add(c.cardId));
      deckData.sideDeck.forEach((c) => cardIds.add(c.cardId));

      const { data: loadedCards, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .in("id", Array.from(cardIds));

      if (cardsError) {
        return new Response(
          JSON.stringify({
            error:
              "Unable to load cards for your deck from the card library.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      cards = loadedCards || [];
    }

    switch (action) {
      case "get_embedding":
      case undefined: {
        if (!actualDeckId) {
          return new Response(
            JSON.stringify({
              error: "A saved deck is required for this action.",
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
            JSON.stringify({
              error: "Enter a question about your deck or cards.",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (!actualDeckId) {
          return new Response(
            JSON.stringify({
              error: "Save your deck before using Strategist.",
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
          JSON.stringify({
            error: "That Strategist request is not supported.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
    }
  } catch (error) {
    console.error("Strategist error:", error);
    return new Response(
      JSON.stringify({
        error: "Strategist could not review your deck right now. Try again.",
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

    const banlist = await loadFormatBanlist(supabase, format);
    const legality = evaluateDeckLegality(deck, { banlist, allCards });
    if (!legality.ok) {
      return new Response(
        JSON.stringify({
          error:
            "Your current deck is not legal for coaching. Fix banlist or size issues, then ask again.",
          legality_errors: legality.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Auto → Groq NLP classifier (heuristic fallback). Explicit modes skip NLP OOB,
    // but domain gate always runs so weather/off-topic never hits Groq.
    let intent: IntentClassification | null = null;
    if (!mode || mode === "auto") {
      intent = await classifyIntent({
        question: userQuery,
        apiKey: groqApiKey,
        modelName,
      });
    }
    const domainOob = classifyOutOfBoundsHeuristic(userQuery);
    if (domainOob.isOutOfBounds && domainOob.reason === "off_domain") {
      intent = {
        inferred_mode: "qa",
        target_card_entities: [],
        is_out_of_bounds: true,
        oob_reason: "off_domain",
        confidence: "high",
      };
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
      banlist,
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
    let combosBlock = "";
    let groundingBlock = "";

    const needsVariants =
      resolvedMode === "tune_copies" || resolvedMode === "optimize";
    const needsSynergy =
      resolvedMode === "discover_synergy" || resolvedMode === "optimize";

    if (needsVariants) {
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

    if (needsSynergy) {
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
      retrievedBlock = "";
    }

    if (resolvedMode === "optimize") {
      const primary = facts.diagnostics.strategyFit.primaryArchetype;
      const deckCardsForArchetype = allCards.filter((c) =>
        [
          ...deck.mainDeck,
          ...deck.extraDeck,
          ...deck.sideDeck,
        ].some((e) => e.cardId === c.id),
      );
      const deckArchetypes = collectDeckArchetypes(
        deckCardsForArchetype,
        primary,
      );
      const knownTemplateArchetypes = await listComboTemplateArchetypeNames(
        supabase,
        format,
      );
      const bridges = resolveBridgeArchetypes({
        question: userQuery,
        deckArchetypes,
        knownTemplateArchetypes,
        max: 4,
      });
      const archetypes = [
        ...new Set([
          ...(primary ? [primary] : []),
          ...bridges,
        ]),
      ].slice(0, 4);
      const templates = await loadComboTemplatesForArchetypes(
        supabase,
        format,
        archetypes,
      );
      if (templates.length > 0) {
        const lines = templates.slice(0, 8).map((t) => {
          const bosses = (t.bosses ?? []).slice(0, 4).join(", ") || "n/a";
          return `- ${t.archetypeName} | ${t.name} | bosses: ${bosses}`;
        });
        combosBlock = `# MULTI_ARCHETYPE_COMBOS\n${lines.join("\n")}`;
      } else {
        combosBlock =
          "# MULTI_ARCHETYPE_COMBOS\nNo curated templates for the requested bridge — do not invent combo scripts.";
      }
    }

    // Grounding tools: verify named entities + retrieved cards before Groq narrates.
    {
      const candidateNames = extractCandidateCardNames(
        userQuery,
        intent?.target_card_entities ?? [],
      );
      const verification = await verifyCardNames(supabase, candidateNames);
      const retrievedIds = retrieved.map((r) => r.card.id);
      const banTargets = [
        ...verification.found.map((c) => c.id),
        ...retrievedIds,
      ];
      const banResults = await banStatus(supabase, {
        cardIds: banTargets,
        names: verification.notFound,
        format,
        banlist,
      });
      const textIds = [
        ...verification.found.map((c) => c.id),
        ...retrievedIds.slice(0, 12),
      ];
      const texts = await fetchCardTexts(supabase, textIds);
      const preferSide =
        intent?.qa_focus === "side_plan" ||
        /\b(side\s+deck|side\s+plan)\b/i.test(userQuery);
      const packed = packDeckCardsForPrompt(
        buildPackableDeckCards(deck, allCards),
        {
          priorityCardIds: [
            ...resolvedTargetCardIds
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id)),
            ...facts.diagnostics.collisions.flatMap((c) => c.cardIds ?? []),
            ...facts.diagnostics.bosses.map((b) => b.cardId),
          ],
          priorityNames: [
            ...(intent?.target_card_entities ?? []),
            ...candidateNames,
          ],
          collisionCardIds: facts.diagnostics.collisions.flatMap(
            (c) => c.cardIds ?? [],
          ),
          preferSide,
        },
      );
      const forbidden = new Set(
        banResults
          .filter((b) => b.status === "forbidden")
          .map((b) => b.name.toLowerCase()),
      );
      if (forbidden.size > 0) {
        retrieved = retrieved.filter(
          (r) => !forbidden.has(r.card.name.toLowerCase()),
        );
      }
      groundingBlock = formatGroundingBlock({
        verification,
        banResults,
        texts,
        deckCardLines: packed.lines,
        deckCardsTruncated: packed.truncated,
      });
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
      groundingBlock,
      comboGraphBlock: combosBlock,
    });

    // Legacy recommendation projection for older UI slideshow (from synergies / optimize)
    const legacyRecommendations = (
      coach.recommendations?.length
        ? coach.recommendations.map((r) => ({
          cardId: Number(r.cardId) || 0,
          cardName: r.title,
          reason: (r.effectLines ?? []).join(". ") || r.roleTag || r.title,
          priority: "medium" as const,
          canAdd: true,
          synergyScore: 0.7,
        }))
        : (coach.synergies ?? []).map((s) => ({
          cardId: Number(s.cardId) || 0,
          cardName: s.title,
          reason: s.fitSummary,
          priority: "medium" as const,
          canAdd: true,
          synergyScore: 0.7,
        }))
    );

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
        grounding: Boolean(groundingBlock),
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
        recommendations: coach.recommendations ??
          (legacyRecommendations.length ? legacyRecommendations : null),
        redirectHint: coach.redirectHint ?? null,
        // Back-compat fields
        text: coach.answer,
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
        error: "Strategist could not review your deck right now. Try again.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
