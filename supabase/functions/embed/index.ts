// /supabase/functions/embed/index.ts
import "@supabase/supabase-js";

import { z } from "zod";
import { corsHeaders } from "../_shared/cors.ts";
import postgres from "postgres";

// Declare Supabase.ai global (available at runtime in Supabase Edge Functions)
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run: (
        input: string,
        options?: { mean_pool?: boolean; normalize?: boolean }
      ) => Promise<number[]>;
    };
  };
};

// Initialize Postgres client using direct DB URL
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);

// Create an inference session using the built-in Supabase.ai API
const session = new Supabase.ai.Session("gte-small");

// Job schema matching our queue_card_embedding trigger
const jobSchema = z.object({
  jobId: z.number(),
  id: z.number(),
  schema: z.string(),
  table: z.string(),
  contentFunction: z.string(),
  embeddingColumn: z.string(),
});

const failedJobSchema = jobSchema.extend({
  error: z.string(),
});

type Job = z.infer<typeof jobSchema>;
type FailedJob = z.infer<typeof failedJobSchema>;

type Row = {
  id: number;
  content: unknown;
};

const QUEUE_NAME = "embedding_jobs";

// Allowed table mapping — hard-coded to avoid dynamic schema.table injection
// Add more entries here if you want to support other tables later.
const ALLOWED_TABLES: Record<string, string[]> = {
  // schema: [table1, table2, ...]
  public: ["cards"],
};

/**
 * Helper: validate that schema/table are permitted.
 * Throws an Error if not allowed.
 */
function assertAllowedTable(schema: string, table: string) {
  const allowed = ALLOWED_TABLES[schema];
  if (!allowed || allowed.indexOf(table) === -1) {
    throw new Error(`table not allowed: ${schema}.${table}`);
  }
}

/**
 * Generates an embedding for the given text using Supabase.ai.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || String(text).trim().length === 0) {
    throw new Error("Empty text provided for embedding");
  }

  const raw = await session.run(String(text).slice(0, 20000), {
    mean_pool: true,
    normalize: true,
  });

  // Normalize to a plain JS number[]
  const embedding = Array.isArray(raw)
    ? raw.map((v) => Number(v))
    : Array.from(raw as any, (v: any) => Number(v));

  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(
      `Invalid embedding format: expected non-empty array, got length=${
        embedding?.length ?? 0
      }`
    );
  }

  return embedding;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "expected POST request" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (
    (req.headers.get("content-type") ?? "").indexOf("application/json") === -1
  ) {
    return new Response(JSON.stringify({ error: "expected json body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use Zod to parse and validate the request body (single job or array)
  const body = await req.json();
  const singleJobResult = jobSchema.safeParse(body);
  const arrayJobResult = z.array(jobSchema).safeParse(body);

  let pendingJobs: Job[];

  if (singleJobResult.success) {
    pendingJobs = [singleJobResult.data];
  } else if (arrayJobResult.success) {
    pendingJobs = arrayJobResult.data;
  } else {
    const errorDetails =
      singleJobResult.error?.issues || arrayJobResult.error?.issues || [];
    return new Response(
      JSON.stringify({
        error: `invalid request body: expected a job object or array of jobs`,
        details: errorDetails,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Track outcomes
  const completedJobs: Job[] = [];
  const failedJobs: FailedJob[] = [];

  // Process jobs sequentially to keep things simple & debuggable
  for (const job of pendingJobs) {
    const jobId = job.jobId;
    try {
      // === NEW DEBUG: log the identifiers and contentFunction the function will use ===
      console.info(
        `processJob: jobId=${jobId}, id=${job.id}, schema='${job.schema}', table='${job.table}', contentFunction='${job.contentFunction}', embeddingColumn='${job.embeddingColumn}'`
      );
      // ============================================================================

      // Validate schema/table against allowlist to avoid double-qualification or injection
      assertAllowedTable(job.schema, job.table);

      // We restrict to the allowed schema/table; construct the static identifier safely.
      // Because we validated, it's safe to interpolate schema/table into template.
      const schema = job.schema;
      const table = job.table;
      const contentFunction = job.contentFunction;
      const embeddingColumn = job.embeddingColumn || "effect_embedding";

      // Fetch the content by calling the contentFunction on the row in the allowed table.
      // The SQL below calls: SELECT <contentFunction>(t) AS content FROM public.cards t WHERE id = $1
      const query = `
  select id, ${contentFunction}(t) as content
  from ${schema}.${table} t
  where id = $1
`;

      console.info(`processJob: executing query: ${query}`);
      const rows = (await sql.unsafe(query, [job.id])) as any[];
      const row = rows?.[0];

      if (!row) {
        throw new Error(`row not found: ${schema}.${table}/${job.id}`);
      }

      if (typeof row.content !== "string") {
        throw new Error(
          `invalid content - expected string: ${schema}.${table}/${job.id}`
        );
      }

      // generate embedding
      const embedding = await generateEmbedding(row.content);

      // update the row's embedding column (store as JSON array)
      // embedding: number[]
      const embeddingJson = JSON.stringify(embedding);
      await sql.unsafe(
        `
  UPDATE ${schema}.${table}
  SET ${embeddingColumn} = $1::vector
  WHERE id = $2
  `,
        [embeddingJson, job.id]
      );

      // delete the message from the queue
      console.info(
        `processJob: deleting jobId=${jobId} from queue ${QUEUE_NAME}`
      );
      await sql`
        select pgmq.delete(${QUEUE_NAME}, ${jobId}::bigint)
      `;

      completedJobs.push(job);
      console.info(`processJob: success jobId=${jobId}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error(`processJob: job ${jobId} failed: ${message}`, stack ?? "");
      failedJobs.push({
        ...job,
        error: message,
      });
      // continue to next job
    }
  } // end for

  // final log and response
  console.info("finished processing jobs:", {
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
  });

  return new Response(
    JSON.stringify({
      completedJobs,
      failedJobs,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
        "x-completed-jobs": String(completedJobs.length),
        "x-failed-jobs": String(failedJobs.length),
      },
    }
  );
});
