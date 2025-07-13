import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the JWT from the Authorization header
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    // Get the user object
    const {
      data: { user },
    } = await supabaseClient.auth.getUser(token);

    // Parse request body
    const { question, deck_cards, card_pool } = await req.json();

    const deckCards = Array.isArray(deck_cards) ? deck_cards : [];
    const allCards = Array.isArray(card_pool) ? card_pool : [];

    if (!deckCards.length) {
      return new Response(
        JSON.stringify({ error: "No cards in the current deck." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (!allCards.length) {
      return new Response(
        JSON.stringify({ error: "No card pool available for analysis." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare context for LLM
    const deckContext = deckCards
      .map(
        (card) =>
          `${card.name} (${card.type}): ${card.description || card.desc}`
      )
      .join("\n\n");

    const poolContext = allCards
      .map(
        (card) =>
          `${card.name} (${card.type}): ${card.description || card.desc}`
      )
      .join("\n\n");

    // Build your prompt with both contexts as needed
    const prompt = `
      As a Yu-Gi-Oh expert analyzing this deck:
      Deck:
        ${deckContext}

      Full card pool (for suggestions):
        ${poolContext}

      User question: ${question}

      Provide detailed recommendations and suggest cards from the pool if relevant.
    `;

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo", // or "gpt-4"
          messages: [{ role: "user", content: prompt }],
          temperature: 0.5,
          max_tokens: 1024,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await openaiResponse.json();
    const aiContent =
      result.choices?.[0]?.message?.content || "No response from AI.";

    // Return user, AI answer, and optionally deck/cards for debugging/context
    return new Response(
      JSON.stringify({ user, answer: aiContent, deck_cards, card_pool }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
