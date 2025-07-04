// import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
// const MODEL_NAME = "llama3-70b-8192";

// serve(async (req) => {
//   const { deck_id, question } = await req.json();
//   const supabase = createClient(
//     Deno.env.get("SUPABASE_URL")!,
//     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
//   );

//   // Fetch deck and card data
//   const { data: deck } = await supabase
//     .from("decks")
//     .select("cards, name")
//     .eq("id", deck_id)
//     .single();

//   if (!deck) {
//     throw new Error(`Deck not found with id ${deck_id}`);
//   }

//   const cardIds = [...deck.cards.main, ...deck.cards.extra, ...deck.cards.side];

//   const { data: cards } = await supabase
//     .from("cards")
//     .select("*")
//     .in("id", cardIds);

//   // Prepare context
//   const context = cards
//     ?.map((card) => `${card.name} (${card.type}): ${card.desc}`)
//     .join("\n\n");

//   // Generate analysis
//   const prompt = `
//   As a Yu-Gi-Oh expert analyzing this deck: ${deck.name}
//   Card context:
//   ${context}
  
//   User question: ${question}
  
//   Provide detailed recommendations considering:
//   - Current meta relevance
//   - Card synergies
//   - Potential weaknesses
//   - Banlist considerations
//   - Consistency improvements
//   `;

//   const groqResponse = await fetch(
//     "https://api.groq.com/openai/v1/chat/completions",
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${GROQ_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: MODEL_NAME,
//         messages: [{ role: "user", content: prompt }],
//         temperature: 0.5,
//         max_tokens: 1024,
//       }),
//     }
//   );

//   const result = await groqResponse.json();
//   return new Response(result.choices[0].message.content);
// });
