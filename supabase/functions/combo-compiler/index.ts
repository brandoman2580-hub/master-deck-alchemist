/**
 * Combo compiler edge function
 * - compile: validate curated templates (+ fallback) for a saved deck
 * - explain: Groq coaching for one validated combo line only
 */

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

type EngineFormat = "TCG" | "MASTER_DUEL";

interface ComboTemplateNode {
  id: string;
  label: string;
  cardNames: string[];
  kind: "hand" | "step" | "endboard" | "choke" | "killer";
  required?: boolean;
}

interface ComboTemplateGraph {
  nodes: ComboTemplateNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
  endboardSummary: string;
}

interface DeckCardRef {
  id: number;
  name: string;
  zone: "main" | "extra" | "side";
}

function toFormat(mode: string | null | undefined): EngineFormat {
  return mode === "TCG" ? "TCG" : "MASTER_DUEL";
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function buildNameIndex(deckCards: DeckCardRef[]): Map<string, DeckCardRef[]> {
  const map = new Map<string, DeckCardRef[]>();
  for (const card of deckCards) {
    const key = normalizeName(card.name);
    const list = map.get(key) ?? [];
    list.push(card);
    map.set(key, list);
  }
  return map;
}

function resolveCardIds(
  cardNames: string[],
  byName: Map<string, DeckCardRef[]>,
): number[] {
  const ids: number[] = [];
  for (const name of cardNames) {
    const hits = byName.get(normalizeName(name));
    if (!hits?.length) continue;
    for (const hit of hits) {
      if (!ids.includes(hit.id)) ids.push(hit.id);
    }
  }
  return ids;
}

function validateTemplate(
  template: {
    id: string;
    name: string;
    killers: string[];
    graph: ComboTemplateGraph;
  },
  deckCards: DeckCardRef[],
) {
  const byName = buildNameIndex(deckCards);
  const nodes = [];
  for (const node of template.graph.nodes) {
    const cardIds = resolveCardIds(node.cardNames, byName);
    const required =
      node.required === true ||
      (node.required === undefined &&
        (node.kind === "hand" ||
          node.kind === "step" ||
          node.kind === "endboard"));
    if (required && cardIds.length === 0) return null;
    nodes.push({
      id: node.id,
      label: node.label,
      cardIds,
      kind: node.kind,
    });
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = template.graph.edges.filter(
    (e) => nodeIds.has(e.from) && nodeIds.has(e.to),
  );
  return {
    id: template.id,
    name: template.name,
    nodes,
    edges,
    killers: template.killers,
    endboardSummary: template.graph.endboardSummary,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY")?.trim();
    const modelName =
      Deno.env.get("MODEL_NAME")?.trim() || "openai/gpt-oss-120b";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const action = body.action ?? "compile";
    const deckId = body.deck_id as string | undefined;

    if (!deckId) {
      return new Response(JSON.stringify({ error: "deck_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: deckRecord, error: deckError } = await supabase
      .from("decks")
      .select("id, cards, mode, user_id")
      .eq("id", deckId)
      .eq("user_id", user.id)
      .single();

    if (deckError || !deckRecord) {
      return new Response(JSON.stringify({ error: "Deck not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const format = toFormat(deckRecord.mode as string);
    const cardsJson = deckRecord.cards as {
      main?: Array<{ id?: number; cardId?: number; name?: string }>;
      extra?: Array<{ id?: number; cardId?: number; name?: string }>;
      side?: Array<{ id?: number; cardId?: number; name?: string }>;
    };

    const toRefs = (
      section: Array<{ id?: number; cardId?: number; name?: string }> | undefined,
      zone: DeckCardRef["zone"],
    ): DeckCardRef[] =>
      (section ?? [])
        .map((c) => {
          const id = c.cardId ?? c.id;
          if (typeof id !== "number" || !c.name) return null;
          return { id, name: c.name, zone };
        })
        .filter((c): c is DeckCardRef => c !== null);

    const deckCards = [
      ...toRefs(cardsJson.main, "main"),
      ...toRefs(cardsJson.extra, "extra"),
      ...toRefs(cardsJson.side, "side"),
    ];

    const mainIds = deckCards.filter((c) => c.zone === "main").map((c) => c.id);
    const { data: cardRows } = await supabase
      .from("cards")
      .select("id, name, archetype")
      .in("id", [...new Set(mainIds)].slice(0, 80));

    const archetypeCounts = new Map<string, number>();
    for (const row of cardRows ?? []) {
      if (!row.archetype) continue;
      archetypeCounts.set(
        row.archetype,
        (archetypeCounts.get(row.archetype) ?? 0) + 1,
      );
    }
    let primaryArchetype: string | null = null;
    let best = 0;
    for (const [name, count] of archetypeCounts) {
      if (count > best) {
        primaryArchetype = name;
        best = count;
      }
    }

    const { data: templates } = await supabase
      .from("combo_templates")
      .select("id, archetype_name, format, name, bosses, graph, killers")
      .eq("format", format);

    const scoped = (templates ?? []).filter((t) => {
      if (!primaryArchetype) return true;
      const a = normalizeName(primaryArchetype);
      const tName = normalizeName(t.archetype_name as string);
      return a === tName || a.includes(tName) || tName.includes(a);
    });

    const lines = [];
    for (const template of scoped.length ? scoped : templates ?? []) {
      const line = validateTemplate(
        {
          id: template.id as string,
          name: template.name as string,
          killers: (template.killers as string[]) ?? [],
          graph: template.graph as ComboTemplateGraph,
        },
        deckCards,
      );
      if (line) lines.push(line);
    }

    const combos =
      lines.length > 0
        ? { lines, source: "template" as const }
        : { lines: [], source: "empty" as const };

    if (action === "explain") {
      const lineId = body.line_id as string | undefined;
      const line = combos.lines.find((l) => l.id === lineId);
      if (!line) {
        return new Response(
          JSON.stringify({
            error: "line_id must refer to a validated combo line.",
          }),
          {
            status: 400,
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

      const factsBlock = `VALIDATED COMBO LINE (do not invent cards or steps):
Name: ${line.name}
Endboard: ${line.endboardSummary}
Killers: ${line.killers.join(", ")}
Nodes: ${line.nodes.map((n) => `${n.label} [${n.kind}] ids=${n.cardIds.join(",")}`).join("; ")}
Edges: ${line.edges.map((e) => `${e.from}->${e.to}${e.label ? `(${e.label})` : ""}`).join(", ")}`;

      const groqRes = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            temperature: 0.4,
            max_tokens: 600,
            messages: [
              {
                role: "system",
                content:
                  "You explain Yu-Gi-Oh combo lines. Only use the validated line facts provided. Do not invent cards, rates, or illegal steps.",
              },
              {
                role: "user",
                content: `${factsBlock}\n\nWrite a concise 3-6 sentence coaching comment for this line, then a short bullet list of why the listed killers hurt it.`,
              },
            ],
          }),
        },
      );

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        return new Response(
          JSON.stringify({ error: `Groq error: ${errText}` }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const groqJson = await groqRes.json();
      const explanation =
        groqJson.choices?.[0]?.message?.content ??
        "Unable to generate explanation.";

      return new Response(
        JSON.stringify({
          line_id: line.id,
          explanation,
          combos,
          archetype: primaryArchetype,
          format,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Default: compile
    return new Response(
      JSON.stringify({
        combos,
        archetype: primaryArchetype,
        format,
        deck_id: deckId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
