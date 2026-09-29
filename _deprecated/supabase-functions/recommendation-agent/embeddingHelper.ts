/**
 * Embedding helper for recommendation agent
 * CRITICAL: This must use the SAME model/method that was used to generate card_embeddings
 * Uses the embed edge function via HTTP call (more reliable than direct Supabase.ai.Session)
 * Note: MODEL_NAME env variable is for LLM model (Groq), not embedding model
 */

/**
 * Generate query embedding using the embed edge function
 * This calls the /functions/v1/embed endpoint which uses "gte-small" model
 * This matches the pattern used in other scripts and is more reliable than direct Supabase.ai.Session
 */
export async function generateQueryEmbedding(
  text: string,
  supabaseUrl: string | undefined = undefined,
  serviceRoleKey: string | undefined = undefined,
): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Empty text provided for embedding");
  }

  // Get Supabase URL and service role key from parameters or environment
  const url = supabaseUrl ?? Deno.env.get("SUPABASE_URL");
  const key = serviceRoleKey ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for embedding generation",
    );
  }

  try {
    // Call the embed edge function via HTTP (proven working approach)
    const embedFn = `${url}/functions/v1/embed`;
    const res = await fetch(embedFn, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: String(text).slice(0, 20000),
        model: "gte-small", // Explicitly specify model
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Embed call failed: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    if (!result.embedding || !Array.isArray(result.embedding)) {
      throw new Error("Invalid embedding response format");
    }

    const embedding = result.embedding as number[];

    if (!embedding || embedding.length === 0) {
      throw new Error(
        `Invalid embedding format: expected non-empty array, got length=${embedding?.length ?? 0}`,
      );
    }

    return embedding;
  } catch (error) {
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
