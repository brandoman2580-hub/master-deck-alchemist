/**
 * Supabase Edge Function: Sync Master Duel Rarity from YGOPRODeck API
 *
 * Fetches Master Duel format cards with misc=yes to get md_rarity,
 * then upserts into master_duel_rarity table (card_id -> md_rarity).
 *
 * Run periodically (e.g. monthly) to keep rarity data up to date.
 */

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const YGO_API = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const FORMAT = "master%20duel";
const MISC = "yes";

interface YGOCardWithMisc {
  id: number;
  name?: string;
  misc_info?: Array<{ md_rarity?: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const url = `${YGO_API}?format=${FORMAT}&misc=${MISC}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`YGOPRODeck API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error("Unexpected YGOPRODeck API response structure");
    }

    const cards = json.data as YGOCardWithMisc[];
    const entries: { card_id: number; md_rarity: string }[] = [];

    for (const card of cards) {
      const mdRarity = card.misc_info?.[0]?.md_rarity?.trim();
      if (mdRarity && card.id != null) {
        entries.push({ card_id: card.id, md_rarity: mdRarity });
      }
    }

    if (entries.length === 0) {
      return new Response(
        JSON.stringify({
          status: "warning",
          message: "No cards with md_rarity found in API response.",
          count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data, error } = await supabase
      .from("master_duel_rarity")
      .upsert(entries, { onConflict: "card_id" })
      .select();

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        count: entries.length,
        message: `Synced ${entries.length} Master Duel rarity entries.`,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error in sync-master-duel-rarity:", err);
    return new Response(
      JSON.stringify({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
