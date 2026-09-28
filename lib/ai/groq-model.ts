/**
 * Groq's recommended replacement for deprecated `llama-3.3-70b-versatile`
 * (shutdown 2026-08-16). See https://console.groq.com/docs/deprecations
 *
 * Org may block gpt-oss-120b → edge falls back via GROQ_FALLBACK_MODELS.
 */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b" as const;

export const GROQ_FALLBACK_MODELS = [
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b",
] as const;

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
