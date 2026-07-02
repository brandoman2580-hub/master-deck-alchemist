import { describe, expect, it } from "vitest";
import { DEFAULT_GROQ_MODEL } from "@/lib/ai/groq-model";

describe("Groq model default", () => {
  it("uses openai/gpt-oss-120b as the llama-3.3-70b-versatile replacement", () => {
    expect(DEFAULT_GROQ_MODEL).toBe("openai/gpt-oss-120b");
  });
});
