/**
 * Groq's recommended replacement for deprecated `llama-3.3-70b-versatile`
 * (shutdown 2026-08-16). See https://console.groq.com/docs/deprecations
 */
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

export function resolveGroqModel(): string {
  return Deno.env.get("MODEL_NAME")?.trim() || GROQ_DEFAULT_MODEL;
}
