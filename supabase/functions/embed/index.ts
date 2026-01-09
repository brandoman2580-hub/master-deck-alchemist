import { corsHeaders } from "../_shared/cors.ts";

// Declare Supabase.ai global (available at runtime in Supabase Edge Functions)
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run: (
        input: string,
        options?: { mean_pool?: boolean; normalize?: boolean },
      ) => Promise<number[]>;
    };
  };
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { input, model = "gte-small" } = await req.json();

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'input' field" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create an inference session using the built-in Supabase.ai API
    const session = new Supabase.ai.Session(model);

    const raw = await session.run(String(input).slice(0, 20000), {
      mean_pool: true,
      normalize: true,
    });

    // Normalize to a plain JS number[]
    const embedding = Array.isArray(raw)
      ? raw.map((v: any) => Number(v))
      : Array.from(raw as any, (v: any) => Number(v));

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error(
        `Invalid embedding format: expected non-empty array, got length=${
          embedding?.length ?? 0
        }`,
      );
    }

    return new Response(
      JSON.stringify({ embedding }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Embed error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
