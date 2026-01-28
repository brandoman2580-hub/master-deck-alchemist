/**
 * Integration tests for meta-stats edge function
 * Run with: deno test --allow-net --allow-env --allow-read tests/integration.test.ts
 * 
 * Note: These tests require:
 * - Supabase connection
 * - Test data in tier_list_snapshots table
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const hasRequiredEnv = SUPABASE_URL && SUPABASE_SERVICE_KEY;

Deno.test({
  name: "meta-stats - request format validation",
  ignore: !hasRequiredEnv,
  fn() {
    // Test that request structure is valid
    const validRequest = {
      format: "tcg" as const,
      days: 30,
    };

    assertEquals(typeof validRequest.format, "string");
    assertEquals(validRequest.format === "tcg" || validRequest.format === "master_duel", true);
    assertEquals(typeof validRequest.days, "number");
    assertEquals(validRequest.days > 0, true);
  },
});

Deno.test({
  name: "meta-stats - response structure validation",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Missing environment variables");
    }

    const url = new URL(`${SUPABASE_URL}/functions/v1/meta-stats`);
    url.searchParams.set("format", "tcg");
    url.searchParams.set("days", "30");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Should return 200 even if no data (graceful handling)
    assertEquals(response.ok, true);

    const data = await response.json();
    
    // Validate response structure
    assertExists(data.format);
    assertExists(data.totalDecks);
    assertExists(data.tierDistribution);
    assertExists(data.topDecks);
    assertExists(data.metaHealth);
    
    assertEquals(typeof data.format, "string");
    assertEquals(typeof data.totalDecks, "number");
    assertEquals(Array.isArray(data.tierDistribution), true);
    assertEquals(Array.isArray(data.topDecks), true);
    assertEquals(typeof data.metaHealth.diversity, "number");
    assertEquals(typeof data.metaHealth.stability, "number");
  },
});

Deno.test({
  name: "meta-stats - format validation",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Missing environment variables");
    }

    // Test invalid format
    const url = new URL(`${SUPABASE_URL}/functions/v1/meta-stats`);
    url.searchParams.set("format", "invalid_format");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    assertEquals(response.status, 400);
    const error = await response.json();
    assertExists(error.error);
  },
});

Deno.test({
  name: "meta-stats - master_duel format",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Missing environment variables");
    }

    const url = new URL(`${SUPABASE_URL}/functions/v1/meta-stats`);
    url.searchParams.set("format", "master_duel");
    url.searchParams.set("days", "7");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    assertEquals(response.ok, true);
    const data = await response.json();
    assertEquals(data.format, "master_duel");
  },
});
