import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function parseYGOPRODeckText(rawText: string) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("//") &&
        !line.startsWith("==") &&
        !line.includes("cards)")
    );

  return lines
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      return match
        ? { qty: parseInt(match[1], 10), name: match[2].trim() }
        : null;
    })
    .filter(Boolean);
}

Deno.serve(async () => {
  const { data: entries } = await supabase
    .from("raw_deck_inputs")
    .select("*")
    .or("processed.is.null,processed.eq.false") // supabase-js syntax
    .limit(10);

  for (const entry of entries || []) {
    const parsed = parseYGOPRODeckText(entry.raw_text);

    const { error } = await supabase.rpc("create_meta_deck_from_card_names", {
      name: entry.name,
      mode: entry.mode,
      cards: parsed,
    });

    if (error) {
      console.error(`Failed to create meta deck for ${entry.name}:`, error);
    } else {
      await supabase
        .from("raw_deck_inputs")
        .update({ processed: true })
        .eq("id", entry.id);
      console.log(`Processed deck: ${entry.name} in mode: ${entry.mode}`);
    }
  }

  return new Response("Decks processed", { status: 200 });
});
