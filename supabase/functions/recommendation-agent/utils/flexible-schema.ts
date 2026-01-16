import { z } from "zod";

// UIBlock schema (matches index.ts)
const UIBlockContentZ = z.union([
  z.string(),
  z.array(z.string()),
  z.record(z.string(), z.any()),
]);

const UIBlockZ = z.object({
  id: z.string(),
  type: z.enum(["text", "list", "card", "table", "suggestion"]),
  content: UIBlockContentZ,
});

/**
 * Flexible schema validation that accepts LLM variations
 * Uses Zod transforms to normalize field names and types
 */

// Flexible reasoning schema - accepts variations in field names and types
// Handle field name variations by accepting both "intent" and "userIntent", etc.
const FlexibleReasoningZ = z
  .object({
    // Accept both "intent" and "userIntent" field names
    intent: z.string().optional(),
    userIntent: z.string().optional(),
    deckWeaknesses: z
      .union([
        z.string(),
        z.array(z.string()).transform((arr) => arr.join("; ")),
      ])
      .optional()
      .default(""),
    strategicConsiderations: z
      .union([
        z.string(),
        z.array(z.string()).transform((arr) => arr.join("; ")),
      ])
      .optional()
      .default(""),
    metaContext: z.string().optional().default(""),
    // Accept both "evaluation" and "candidateEvaluation" field names
    evaluation: z.string().optional(),
    candidateEvaluation: z.string().optional(),
  })
  .transform((data) => ({
    userIntent: data.userIntent || data.intent || "Analysis requested",
    deckWeaknesses: data.deckWeaknesses || "",
    strategicConsiderations: data.strategicConsiderations || "",
    metaContext: data.metaContext || "",
    candidateEvaluation: data.candidateEvaluation || data.evaluation || "",
  }))
  .optional()
  .default(() => ({
    userIntent: "Analysis requested",
    deckWeaknesses: "",
    strategicConsiderations: "",
    metaContext: "",
    candidateEvaluation: "",
  }));

// Flexible recommendation item schema
const FlexibleRecoItemZ = z.object({
  cardId: z
    .union([z.number(), z.string()])
    .transform((v) => String(v).replace(/['"]/g, "")),
  cardName: z.string().optional(),
  action: z
    .enum(["add", "remove", "replace", "tech", "note"])
    .optional()
    .default("add"),
  reason: z.string(),
  impactEst: z.number().min(-1).max(1).optional().default(0.5),
  synergyScore: z.number().min(0).max(1).optional().default(0.5),
  evidence: z.array(z.string()).optional().default([]),
  banned: z.boolean().optional().default(false),
});

// Flexible recommender schema
export const FlexibleRecommenderZ = z.object({
  schemaVersion: z.string().optional().default("1.0.0"),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  explainTo: z
    .enum(["novice", "intermediate", "advanced"])
    .optional()
    .default("novice"),
  reasoning: FlexibleReasoningZ,
  summary: z.string().optional().default(""),
  recommendations: z.array(FlexibleRecoItemZ),
  ui: z.array(UIBlockZ).optional().default([]),
  actions: z.record(z.string(), z.any()).optional().default({}),
  meta: z.record(z.string(), z.any()).optional().default({}),
});

export type FlexibleRecommenderResponse = z.infer<
  typeof FlexibleRecommenderZ
>;

/**
 * Validate LLM response with flexible schema
 * Attempts to salvage partial data if validation fails
 */
export function validateFlexible(
  parsed: unknown,
): FlexibleRecommenderResponse {
  const result = FlexibleRecommenderZ.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  // Try to salvage partial data
  console.error("Validation errors:", result.error.format());

  if (parsed && typeof parsed === "object" && "recommendations" in parsed) {
    const recs = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : [];

    // Try to validate individual recommendations
    const validRecs = recs
      .map((r: any) => {
        const recResult = FlexibleRecoItemZ.safeParse(r);
        return recResult.success ? recResult.data : null;
      })
      .filter((r): r is z.infer<typeof FlexibleRecoItemZ> => r !== null);

    if (validRecs.length > 0) {
      console.log(
        `✅ Salvaged ${validRecs.length} recommendations from partial data`,
      );
      
      // Normalize reasoning if present
      let normalizedReasoning = {
        userIntent: "Analysis requested",
        deckWeaknesses: "",
        strategicConsiderations: "",
        metaContext: "",
        candidateEvaluation: "",
      };
      if ((parsed as any).reasoning && typeof (parsed as any).reasoning === "object") {
        const r = (parsed as any).reasoning;
        normalizedReasoning = {
          userIntent: r.userIntent || r.intent || "Analysis requested",
          deckWeaknesses: r.deckWeaknesses || "",
          strategicConsiderations: r.strategicConsiderations || "",
          metaContext: r.metaContext || "",
          candidateEvaluation: r.candidateEvaluation || r.evaluation || "",
        };
      }
      
      return {
        schemaVersion: "1.0.0",
        confidence: (parsed as any).confidence ?? 0.5,
        explainTo: (parsed as any).explainTo ?? "novice",
        reasoning: normalizedReasoning,
        recommendations: validRecs,
        summary: (parsed as any).summary || "Recommendations generated",
        ui: [],
        actions: {},
        meta: {},
      };
    }
  }

  throw new Error("Cannot parse LLM response - no valid data found");
}
