// import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
// const MODEL_NAME = 'llama3-70b-8192'

// serve(async (req) => {
//   const { deck_id, opponent_id } = await req.json()
//   const supabase = createClient(
//     Deno.env.get('SUPABASE_URL')!,
//     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
//   )

//   // Fetch deck data
//   const { data: deck } = await supabase
//     .from('decks')
//     .select('cards, name')
//     .eq('id', deck_id)
//     .single()

//   // Fetch opponent data
//   const { data: opponent } = await supabase
//     .from('opponents')
//     .select('deck, name')
//     .eq('id', opponent_id)
//     .single()

//   // Prepare simulation prompt
//   const prompt = `
//   Simulate a Yu-Gi-Oh Master Duel between:
//   Player Deck: ${deck?.name} (${JSON.stringify(deck?.cards)})
//   Opponent Deck: ${opponent?.name} (${JSON.stringify(opponent?.deck)})
  
//   Rules:
//   1. Follow official Master Duel rules
//   2. Output in JSON format: { "turns": [{ "player": "action", "opponent": "action" }], "winner": "player"|"opponent" }
//   3. Make turns realistic with actual card interactions
//   4. Limit to 8 turns maximum
//   `

//   // Call Groq API
//   const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//     method: 'POST',
//     headers: {
//       'Authorization': `Bearer ${GROQ_API_KEY}`,
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       model: MODEL_NAME,
//       messages: [{ role: 'user', content: prompt }],
//       response_format: { type: 'json_object' },
//       temperature: 0.7,
//       max_tokens: 2000
//     })
//   })

//   const result = await groqResponse.json()
//   const simulation = JSON.parse(result.choices[0].message.content)

//   // Save results
//   await supabase.from('duel_results').insert({
//     deck_id,
//     opponent_id,
//     result: simulation.winner === 'player',
//     log: simulation.turns
//   })

//   return new Response(JSON.stringify(simulation))
// })
