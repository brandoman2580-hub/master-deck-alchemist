/**
 * Card Recommendation Pipeline using Embeddings + MMR Reranking + LLM
 *
 * This module provides a sophisticated recommendation system that:
 * 1. Embeds deck context using Supabase AI embeddings
 * 2. Performs vector similarity search to find candidate cards
 * 3. Uses MMR (Maximal Marginal Relevance) to diversify results
 * 4. Formats candidates in TOON format for efficient LLM processing
 * 5. Calls LLM (Groq) to generate structured recommendations
 */

import { createClient } from "@supabase/supabase-js";
import { CardCandidateSchema, LlmResponseSchema } from "../lib/schemas";
import { toTOON } from "../lib/toon";

// Helper functions for vector similarity
function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function norm(a: number[]): number {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0));
}

function cosine(a: number[], b: number[]): number {
  const n = norm(a) * norm(b);
  return n === 0 ? 0 : dot(a, b) / n;
}

/**
 * Get embedding for text using Supabase embed edge function
 */
async function getEmbedding(
  text: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<number[]> {
  const embedFn = `${supabaseUrl}/functions/v1/embed`;
  const res = await fetch(embedFn, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Embed call failed: ${res.status} - ${errorText}`);
  }

  const j = await res.json();
  if (!j.embedding || !Array.isArray(j.embedding)) {
    throw new Error("Invalid embedding response format");
  }

  return j.embedding as number[];
}

/**
 * Fetch candidate cards using vector similarity search
 * Falls back to text search if vector RPC doesn't exist
 */
async function fetchCandidates(
  supabase: any,
  queryEmb: number[],
  excludeArchetypes: string[],
  excludeIds: number[],
  candidatePool = 200,
  deckContextText?: string,
): Promise<any[]> {
  // Try vector search RPC first
  try {
    const { data, error } = await supabase.rpc("match_cards_with_exclusions", {
      query_embedding: queryEmb,
      exclude_archetypes: excludeArchetypes,
      exclude_ids: excludeIds,
      match_count: candidatePool,
    });

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.warn(
      "Vector search RPC not available, falling back to text search:",
      err,
    );
  }

  // Fallback: Use text-based search if vector RPC doesn't exist
  if (deckContextText) {
    try {
      // Extract key terms from deck context for text search
      const searchTerms = deckContextText
        .split(/\s+/)
        .filter((term) => term.length > 3)
        .slice(0, 5)
        .join(" ");

      const { data, error } = await supabase.rpc("match_cards_by_text", {
        query: searchTerms || "effect",
        match_count: candidatePool,
        excluded_ids: excludeIds.length > 0 ? excludeIds : [0],
        banlist_format: "MASTER_DUEL",
      });

      if (!error && data) {
        // Transform to match expected format
        return data.map((row: any) => ({
          id: row.card_id || row.id,
          name: row.name,
          archetype: row.archetype,
          type: row.type,
          desc: row.desc || row.effecttext || "",
        }));
      }
    } catch (fallbackErr) {
      console.warn("Text search fallback also failed:", fallbackErr);
    }
  }

  // Last resort: simple query excluding archetypes and IDs
  try {
    let query = supabase
      .from("cards")
      .select("id, name, archetype, type, desc, effect_embedding")
      .limit(candidatePool);

    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    if (excludeArchetypes.length > 0) {
      for (const arch of excludeArchetypes) {
        query = query.not("archetype", "ilike", `%${arch}%`);
      }
    }

    const { data, error } = await query;
    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.error("Final fallback query failed:", err);
  }

  return [];
}

/**
 * MMR (Maximal Marginal Relevance) reranker
 * Balances relevance to query with diversity among results
 *
 * @param candidates - Array of candidates with embeddings
 * @param qEmb - Query embedding vector
 * @param k - Number of items to select
 * @param lambda - Balance between relevance (1.0) and diversity (0.0). Default 0.65
 */
function mmrSelect(
  candidates: {
    id: number;
    embedding: number[] | null;
    sim: number;
    row: any;
  }[],
  qEmb: number[],
  k: number,
  lambda = 0.65,
): { id: number; embedding: number[] | null; sim: number; row: any }[] {
  // Compute similarity to query for all candidates
  candidates.forEach((c) => {
    if (c.embedding && c.sim === 0) {
      c.sim = cosine(c.embedding, qEmb);
    }
  });

  const selected: typeof candidates = [];
  const pool = candidates.slice();

  // Sort by similarity (descending)
  pool.sort((a, b) => (b.sim ?? 0) - (a.sim ?? 0));

  // Select first item (most relevant)
  if (pool.length === 0) return selected;
  selected.push(pool.shift()!);

  // MMR selection: balance relevance and diversity
  const maxIterations = Math.min(k, pool.length);
  for (let iteration = 0; iteration < maxIterations && selected.length < k && pool.length > 0; iteration++) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i];
      const rel = cand.sim ?? 0;

      // Diversity penalty = max similarity to any already selected item
      const diversity =
        selected.length > 0
          ? Math.max(
              ...selected.map((s) =>
                s.embedding && cand.embedding
                  ? cosine(s.embedding, cand.embedding)
                  : 0,
              ),
            )
          : 0;

      // MMR score: higher is better
      const mmrScore = lambda * rel - (1 - lambda) * diversity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    selected.push(pool.splice(bestIdx, 1)[0]);
  }

  return selected;
}

/**
 * Call Groq LLM API
 */
async function callLLM({
  system,
  user,
  max_tokens = 400,
  groqApiKey,
  modelName = "llama-3.3-70b-versatile",
}: {
  system: string;
  user: string;
  max_tokens?: number;
  groqApiKey: string;
  modelName?: string;
}): Promise<{ text: string }> {
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY is required");
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";

  return { text };
}

/**
 * Main recommendation function using embeddings + MMR + LLM
 *
 * @param params - Configuration for recommendation
 * @returns LLM response with structured picks
 */
export async function recommendNonArchetypeCards({
  deckContextText,
  excludeArchetypes,
  excludeIds = [],
  picks = 5,
  supabaseUrl,
  supabaseServiceKey,
  groqApiKey,
  modelName,
}: {
  deckContextText: string;
  excludeArchetypes: string[];
  excludeIds?: number[];
  picks?: number;
  supabaseUrl: string;
  supabaseServiceKey: string;
  groqApiKey: string;
  modelName?: string;
}): Promise<{
  picks: Array<{
    id?: number;
    name: string;
    reason: string;
    combo: string;
    risk?: string;
  }>;
}> {
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1) embed the deck context
  const qEmb = await getEmbedding(
    deckContextText,
    supabaseUrl,
    supabaseServiceKey,
  );

  // 2) fetch candidate rows from RPC (with fallback)
  const rows = await fetchCandidates(
    supabase,
    qEmb,
    excludeArchetypes,
    excludeIds,
    200,
    deckContextText,
  );

  // 3) validate + transform rows using Zod
  const validated: Array<{
    id: number;
    name: string;
    archetype?: string | null;
    type?: string | null;
    desc?: string | null;
  }> = [];
  for (const r of rows) {
    // transform: some RPCs return "desc" field name `desc`; ensure it exists
    // Convert null to undefined to match schema expectations
    const archetypeValue =
      r.archetype != null && r.archetype !== ""
        ? String(r.archetype)
        : undefined;
    const typeValue =
      r.type != null && r.type !== "" ? String(r.type) : undefined;
    const descValue = (r.desc ?? r.effecttext ?? "") as string;

    const item = {
      id: Number(r.id),
      name: String(r.name),
      archetype: archetypeValue,
      type: typeValue,
      desc: descValue,
    };

    const parsed = CardCandidateSchema.safeParse(item);
    if (parsed.success) {
      validated.push(parsed.data);
    }
    // else drop noisy rows (silently - could add logging if needed)
  }

  if (validated.length === 0) return { picks: [] };

  // 4) fetch candidate embeddings for MMR (small set)
  const ids = validated.map((v) => v.id);
  const { data: embRows } = await supabase
    .from("cards")
    .select("id, effect_embedding")
    .in("id", ids);

  const embMap = new Map<number, number[]>();
  for (const e of embRows || []) {
    if (e.effect_embedding && Array.isArray(e.effect_embedding)) {
      embMap.set(e.id, e.effect_embedding);
    }
  }

  const candidatesWithEmb = validated.map((v) => ({
    id: v.id,
    row: v,
    embedding: embMap.get(v.id) ?? null,
    sim: 0,
  }));

  // Fill similarity scores using embeddings
  if (qEmb) {
    candidatesWithEmb.forEach((c) => {
      if (c.embedding) {
        c.sim = cosine(c.embedding, qEmb);
      }
    });
  }

  // 5) MMR select top picks
  const selected = mmrSelect(candidatesWithEmb, qEmb, picks, 0.65).map(
    (s) => s.row,
  );

  // 6) convert to TOON with truncated descriptions for efficient token usage
  const toon = toTOON({
    name: "cards",
    items: selected.map((s) => ({
      ...s,
      desc: (s.desc ?? "").slice(0, 320), // Truncate descriptions to save tokens
    })),
    fields: ["id", "name", "archetype", "type", "desc"],
    truncate: { desc: 320 },
  });

  // 7) prepare LLM prompt (explicit about TOON + Zod schema)
  const system = `You are a Yu-Gi-Oh! strategy assistant specializing in card recommendations. 

Input format: TOON tabular format with fields: id, name, archetype, type, desc.

CRITICAL RULES:
- Use ONLY the candidate cards provided in the TOON table
- DO NOT suggest any cards from or directly related to these archetypes: ${JSON.stringify(excludeArchetypes)}
- Output MUST be valid JSON matching this exact schema:
  {
    "picks": [
      {
        "id": number (optional, use if available),
        "name": string (required, exact card name from candidates),
        "reason": string (required, <= 40 words explaining why this card fits),
        "combo": string (required, <= 20 words describing a combo or synergy),
        "risk": string (optional, brief risk assessment)
      }
    ]
  }
- Include exactly ${picks} picks (or fewer if not enough candidates)
- Use card IDs when available for unambiguous matching
- Be specific and strategic in your recommendations`;

  const user = `Deck Context: ${deckContextText}

Candidate Cards (TOON format):
${toon}

Task: Analyze the deck context and candidate cards. Return the top ${picks} card recommendations as a JSON object with the exact schema specified above. Focus on cards that synergize well with the deck's strategy while avoiding the excluded archetypes.`;

  // 8) call the LLM using Groq API
  const llmRaw = await callLLM({
    system,
    user,
    max_tokens: 400,
    groqApiKey,
    modelName: modelName || "llama-3.3-70b-versatile",
  });
  const llmText = llmRaw?.text?.trim?.() ?? String(llmRaw);

  // 9) Try to parse as JSON
  let parsedJson: any = null;
  try {
    parsedJson = JSON.parse(llmText);
  } catch (e) {
    // If parse fails, attempt to extract JSON substring heuristically
    const match = llmText.match(/\{[\s\S]*\}$/);
    if (match) {
      try {
        parsedJson = JSON.parse(match[0]);
      } catch (_) {
        parsedJson = null;
      }
    }
  }

  // 10) validate with Zod
  if (parsedJson) {
    const safe = LlmResponseSchema.safeParse(parsedJson);
    if (safe.success) return safe.data;
    // if schema doesn't match, fall through to fallback
  }

  // 11) Fallback: ask the model again, but send JSON instead of TOON (sacrifices tokens)
  const fallbackSystem = `You are a Yu-Gi-Oh! strategy assistant. The input is in JSON format. Use only the provided candidate cards. Output must be strict JSON matching schema: { "picks": [{ "id": number (optional), "name": string, "reason": string (<=40 words), "combo": string (<=20 words), "risk": string? }, ...] }.`;
  const fallbackUser = `Context: Deck core: ${deckContextText}
Candidates JSON: ${JSON.stringify(selected, null, 2)}

Task: Return the top ${picks} picks as strict JSON: { "picks":[...] }`;
  const fallbackRes = await callLLM({
    system: fallbackSystem,
    user: fallbackUser,
    max_tokens: 600,
    groqApiKey,
    modelName: modelName || "llama-3.3-70b-versatile",
  });
  const fallbackText = fallbackRes?.text ?? String(fallbackRes);
  try {
    const parsed = JSON.parse(fallbackText);
    const safe2 = LlmResponseSchema.parse(parsed);
    return safe2;
  } catch (err) {
    // Give up and return empty with diagnostics
    console.error("LLM parse failed twice", { llmText, fallbackText, err });
    return { picks: [] };
  }
}
