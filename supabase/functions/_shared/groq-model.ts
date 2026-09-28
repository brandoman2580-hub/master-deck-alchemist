/**
 * Groq model resolution + permission-aware fallbacks.
 * Preferred: openai/gpt-oss-120b (AGENTS.md). Org may block it → fall through.
 */

export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

/** Tried in order when the preferred model returns model_permission_blocked_*. */
export const GROQ_FALLBACK_MODELS = [
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b",
] as const;

export function resolveGroqModel(): string {
  return Deno.env.get("MODEL_NAME")?.trim() || GROQ_DEFAULT_MODEL;
}

/**
 * Ordered unique candidate list: MODEL_NAME / default first, then fallbacks.
 * Optional GROQ_FALLBACK_MODELS env (comma-separated) overrides built-in fallbacks.
 */
export function resolveGroqModelCandidates(): string[] {
  const primary = resolveGroqModel();
  const envFallbacks = Deno.env.get("GROQ_FALLBACK_MODELS")?.trim();
  const fallbacks = envFallbacks
    ? envFallbacks.split(",").map((s) => s.trim()).filter(Boolean)
    : [...GROQ_FALLBACK_MODELS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const model of [primary, ...fallbacks]) {
    if (!model || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

export function isGroqModelPermissionError(
  status: number,
  body: string,
): boolean {
  if (status !== 403) return false;
  return (
    body.includes("model_permission_blocked") ||
    body.includes("permissions_error") ||
    body.includes("blocked at the organization") ||
    body.includes("blocked at the project")
  );
}

/** gpt-oss models support reasoning_effort; keep classifier/coach lean. */
export function groqReasoningEffortForModel(
  model: string,
): "low" | "medium" | undefined {
  if (model.includes("gpt-oss")) return "low";
  return undefined;
}
