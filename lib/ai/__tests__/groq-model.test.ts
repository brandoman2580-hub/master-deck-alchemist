import {
  DEFAULT_GROQ_MODEL,
  GROQ_FALLBACK_MODELS,
  isGroqModelPermissionError,
} from "../groq-model";

describe("Groq model default", () => {
  it("uses openai/gpt-oss-120b as the llama-3.3-70b-versatile replacement", () => {
    expect(DEFAULT_GROQ_MODEL).toBe("openai/gpt-oss-120b");
  });

  it("lists gpt-oss-20b as a permission fallback", () => {
    expect(GROQ_FALLBACK_MODELS).toContain("openai/gpt-oss-20b");
  });

  it("detects org-level model permission 403 bodies", () => {
    const body =
      '{"error":{"message":"The model `openai/gpt-oss-120b` is blocked at the organization level.","type":"permissions_error","code":"model_permission_blocked_org"}}';
    expect(isGroqModelPermissionError(403, body)).toBe(true);
    expect(isGroqModelPermissionError(401, body)).toBe(false);
  });
});
