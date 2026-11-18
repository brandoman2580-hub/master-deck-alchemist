import { createClient } from "@/utils/supabase/client";
import type { EngineFormat } from "./types";
import type { ComboTemplateGraph, ComboTemplateRow } from "./combos";

const supabase = createClient();

/**
 * Load curated combo templates for a format (optional archetype filter).
 */
export async function loadComboTemplates(
  format: EngineFormat,
  archetypeName?: string | null,
): Promise<ComboTemplateRow[]> {
  let query = supabase
    .from("combo_templates")
    .select(
      "id, archetype_name, format, name, bosses, graph, killers, updated_at",
    )
    .eq("format", format)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (archetypeName) {
    query = query.ilike("archetype_name", `%${archetypeName}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    archetypeName: row.archetype_name as string,
    format: row.format as EngineFormat,
    name: row.name as string,
    bosses: (row.bosses as string[]) ?? [],
    graph: row.graph as ComboTemplateGraph,
    killers: (row.killers as string[]) ?? [],
  }));
}
