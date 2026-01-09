import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Explicitly load .env.local (dotenv/config only loads .env by default)
config({ path: ".env.local" });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GROQ_API_KEY) {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!GROQ_API_KEY) missing.push("GROQ_API_KEY");
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}\n` +
    `Please add these to your .env.local file.`
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------- CONFIG ----------
const BATCH_SIZE = 25; // safe for tokens
const DRY_RUN = false; // set true to test without writing
const GROQ_DELAY_MS = 2500; // Delay between Groq API calls (30 req/min = 2s per req, using 2.5s for safety)
// ----------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an embedding is valid (not a placeholder)
 * Placeholder embeddings are arrays of zeros or very small values
 */
function isValidEmbedding(embedding: any): boolean {
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    return false;
  }

  // Check if all values are zero (placeholder)
  const allZeros = embedding.every((val) => val === 0 || Math.abs(val) < 1e-10);
  if (allZeros) {
    return false;
  }

  // Check if embedding has reasonable values (gte-small produces 384-dim vectors)
  // Valid embeddings should have non-zero values
  const hasNonZeroValues = embedding.some((val) => Math.abs(val) > 1e-10);
  return hasNonZeroValues;
}

async function generateEffectSummary(card: {
  name: string;
  type: string;
  desc: string;
}, retries = 3): Promise<string> {
  const prompt = `
You are extracting mechanical effects from a Yu-Gi-Oh! card.

Rules:
- Describe ONLY what the card does mechanically.
- Use short, neutral phrases.
- No flavor, no opinions, no archetype assumptions.
- No card names.
- Plain text only.

Card type: ${card.type}
Card effect text:
${card.desc}
`;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`Groq API error: ${errorText}`);
    }

    // Handle rate limiting with retry
    if (errorData.error?.code === "rate_limit_exceeded" && retries > 0) {
      const errorMessage = errorData.error?.message || "";
      // Parse wait time from message (handles formats like "1m22.944s" or "30s")
      let waitTime = 60000; // Default 60 seconds
      
      const minutesMatch = errorMessage.match(/(\d+)m/);
      const secondsMatch = errorMessage.match(/(\d+\.?\d*)s/);
      
      if (minutesMatch || secondsMatch) {
        const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
        const seconds = secondsMatch ? parseFloat(secondsMatch[1]) : 0;
        waitTime = (minutes * 60 + seconds) * 1000 + 2000; // Add 2s buffer
      }
      
      console.log(`⏳ Rate limit hit, waiting ${Math.ceil(waitTime / 1000)}s before retry (${retries} retries left)...`);
      await sleep(waitTime);
      return generateEffectSummary(card, retries - 1);
    }

    throw new Error(`Groq API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim();
}

async function embedText(text: string): Promise<number[]> {
  const supabaseFunctionsUrl = `${SUPABASE_URL}/functions/v1`;
  
  const res = await fetch(`${supabaseFunctionsUrl}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ input: text, model: "gte-small" }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Embed error: ${res.status} ${errorText}`);
  }

  const json = (await res.json()) as { embedding: number[] };
  if (!json.embedding || !Array.isArray(json.embedding)) {
    throw new Error("Embed response missing embedding");
  }
  return json.embedding;
}

async function checkCardHasEmbedding(cardId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from("card_embeddings")
    .select("card_id, embedding")
    .eq("card_id", cardId)
    .not("embedding", "is", null)
    .maybeSingle();

  if (error) {
    console.warn(`Error checking embedding for card ${cardId}:`, error);
    return false; // Assume it doesn't exist if we can't check
  }

  if (!data || !data.embedding) {
    return false;
  }

  // Check if embedding is valid (not a placeholder)
  return isValidEmbedding(data.embedding);
}

async function fetchAllCards(): Promise<Array<{ id: number; name: string; type: string; desc: string }>> {
  const allCards: Array<{ id: number; name: string; type: string; desc: string }> = [];
  let offset = 0;
  const pageSize = 1000; // Supabase default limit

  console.log("Fetching all cards (this may take a moment)...");

  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, name, type, desc")
      .neq("type", "Normal Monster")
      .range(offset, offset + pageSize - 1)
      .order("id", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) break;

    allCards.push(...data);
    console.log(`  Fetched ${allCards.length} cards so far...`);

    if (data.length < pageSize) break; // Last page
    offset += pageSize;
  }

  return allCards;
}

async function fetchAllExistingEmbeddings(): Promise<Set<number>> {
  const embeddedCardIds = new Set<number>();
  let offset = 0;
  const pageSize = 1000; // Supabase default limit
  let placeholderCount = 0;

  console.log("Fetching existing embeddings (this may take a moment)...");

  while (true) {
    const { data, error } = await supabase
      .from("card_embeddings")
      .select("card_id, embedding")
      .not("embedding", "is", null)
      .range(offset, offset + pageSize - 1)
      .order("card_id", { ascending: true });

    if (error) {
      console.warn("Error fetching existing embeddings, will check individually:", error);
      return embeddedCardIds; // Return what we have so far
    }

    if (!data || data.length === 0) break;

    // Filter out placeholder embeddings
    data.forEach((e) => {
      if (e.card_id) {
        if (isValidEmbedding(e.embedding)) {
          embeddedCardIds.add(e.card_id);
        } else {
          placeholderCount++;
        }
      }
    });

    console.log(`  Found ${embeddedCardIds.size} valid embeddings, ${placeholderCount} placeholders so far...`);

    if (data.length < pageSize) break; // Last page
    offset += pageSize;
  }

  if (placeholderCount > 0) {
    console.log(`  ⚠️  Found ${placeholderCount} placeholder embeddings that will be regenerated`);
  }

  return embeddedCardIds;
}

async function run() {
  console.log("Starting card embedding backfill…\n");

  // Fetch all cards using pagination
  const allCards = await fetchAllCards();

  if (allCards.length === 0) {
    console.log("No cards found.");
    return;
  }

  console.log(`\n✅ Fetched ${allCards.length} total cards.\n`);

  // Fetch all existing embeddings using pagination
  const embeddedCardIds = await fetchAllExistingEmbeddings();

  // Filter cards that need embeddings
  const cardsNeedingEmbedding = allCards.filter(
    (card) => !embeddedCardIds.has(card.id)
  );
  const alreadyEmbeddedCount = allCards.length - cardsNeedingEmbedding.length;

  console.log(`\n📊 Progress Summary:`);
  console.log(`   Total cards: ${allCards.length}`);
  console.log(`   Already embedded: ${alreadyEmbeddedCount}`);
  console.log(`   Need embedding: ${cardsNeedingEmbedding.length}`);
  console.log(`\n🚀 Starting embedding process...\n`);

  if (cardsNeedingEmbedding.length === 0) {
    console.log("✅ All cards already have embeddings!");
    return;
  }

  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < cardsNeedingEmbedding.length; i += BATCH_SIZE) {
    const batch = cardsNeedingEmbedding.slice(i, i + BATCH_SIZE);

    for (const card of batch) {
      processedCount++;
      const progress = `[${processedCount}/${cardsNeedingEmbedding.length}]`;
      console.log(`${progress} Processing: ${card.name}`);

      // Double-check before processing (in case it was added while script was running)
      const hasEmbedding = await checkCardHasEmbedding(card.id);
      if (hasEmbedding) {
        console.log(`${progress} ⏭️  Skipping ${card.name} (already has embedding)`);
        continue;
      }

      try {
        const summary = await generateEffectSummary(card);
        if (!summary) {
          console.warn(`${progress} ⚠️  No summary generated for ${card.name}, skipping.`);
          errorCount++;
          continue;
        }

        const embedding = await embedText(summary);

        if (DRY_RUN) {
          console.log(`${progress} [DRY RUN] Would upsert card_id=${card.id}`);
          continue;
        }

        // Use upsert instead of update to handle both insert and update cases
        const { error: upsertError } = await supabase
          .from("card_embeddings")
          .upsert(
            { card_id: card.id, embedding },
            { onConflict: "card_id" }
          );

        if (upsertError) {
          console.error(`${progress} ❌ Failed to upsert ${card.name}:`, upsertError);
          errorCount++;
        } else {
          console.log(`${progress} ✅ Embedded: ${card.name}`);
          successCount++;
        }
      } catch (error) {
        console.error(`${progress} ❌ Error processing ${card.name}:`, error);
        errorCount++;
        // Continue with next card even if this one failed
      }

      // Rate limiting: wait between Groq API calls
      await sleep(GROQ_DELAY_MS);
    }

    // Progress update after each batch
    const remaining = cardsNeedingEmbedding.length - processedCount;
    console.log(`\n📈 Batch complete. Remaining: ${remaining} cards\n`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Embedding backfill complete!");
  console.log("=".repeat(60));
  console.log(`   Total processed: ${processedCount}`);
  console.log(`   Successfully embedded: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Already had embeddings: ${alreadyEmbeddedCount}`);
  console.log("=".repeat(60));
}

run().catch(console.error);
