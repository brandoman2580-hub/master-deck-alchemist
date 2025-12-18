import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseFunctionsUrl =
  process.env.SUPABASE_FUNCTIONS_URL ?? `${supabaseUrl}/functions/v1`;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Tune these
const BATCH_SIZE = 100;
const SLEEP_MS = 200; // avoid hammering edge function

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${supabaseFunctionsUrl}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // If your embed function requires auth, pass a service token header
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embed error: ${res.status} ${t}`);
  }

  const json = (await res.json()) as { embedding: number[] };
  if (!json.embedding || !Array.isArray(json.embedding)) {
    throw new Error("Embed response missing embedding");
  }
  return json.embedding;
}

function buildCardText(card: any): string {
  // Compact but semantically rich representation
  const parts = [
    card.name,
    card.archetype ? `Archetype: ${card.archetype}` : "",
    card.type ? `Type: ${card.type}` : "",
    card.race ? `Race: ${card.race}` : "",
    card.attribute ? `Attribute: ${card.attribute}` : "",
    card.level ? `Level: ${card.level}` : "",
    card.atk != null ? `ATK: ${card.atk}` : "",
    card.def != null ? `DEF: ${card.def}` : "",
    card.desc ?? "",
  ];
  return parts.filter(Boolean).join(" | ");
}

async function embedCards() {
  console.log("Embedding cards…");

  let offset = 0;
  for (;;) {
    const { data: cards, error } = await supabase
      .from("cards")
      .select("id, name, type, race, attribute, archetype, level, atk, def, desc")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!cards || cards.length === 0) break;

    console.log(`Fetched ${cards.length} cards (offset ${offset})`);

    for (const card of cards) {
      // Skip if already embedded
      const { data: existing, error: exErr } = await supabase
        .from("card_embeddings")
        .select("card_id")
        .eq("card_id", card.id)
        .maybeSingle();

      if (exErr) throw exErr;
      if (existing) {
        continue;
      }

      const input = buildCardText(card);
      const embedding = await embedText(input);

      const { error: upErr } = await supabase
        .from("card_embeddings")
        .upsert({ card_id: card.id, embedding });

      if (upErr) throw upErr;

      console.log(`Embedded card ${card.id} - ${card.name}`);
      await sleep(SLEEP_MS);
    }

    offset += cards.length;
    if (cards.length < BATCH_SIZE) break;
  }

  console.log("Finished card embeddings");
}

async function embedArchetypes() {
  console.log("Embedding archetypes…");

  const { data: archetypes, error } = await supabase
    .from("archetypes")
    .select("id, name, summary, embedding");

  if (error) throw error;
  if (!archetypes || archetypes.length === 0) {
    console.log("No archetypes to embed");
    return;
  }

  for (const arch of archetypes) {
    if (arch.embedding) {
      continue;
    }

    const text =
      arch.summary && arch.summary.length > 0
        ? `${arch.name}: ${arch.summary}`
        : arch.name;

    const embedding = await embedText(text);

    const { error: upErr } = await supabase
      .from("archetypes")
      .update({ embedding })
      .eq("id", arch.id);

    if (upErr) throw upErr;

    console.log(`Embedded archetype ${arch.name}`);
    await sleep(SLEEP_MS);
  }

  console.log("Finished archetype embeddings");
}

async function main() {
  try {
    await embedCards();
    await embedArchetypes();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
