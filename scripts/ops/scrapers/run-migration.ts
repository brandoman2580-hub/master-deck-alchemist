/**
 * Run tier list migration directly
 * Uses Supabase client to apply migration SQL
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log("🔄 Reading migration file...");
    const migrationPath = join(
      process.cwd(),
      "supabase/migrations/20260111200000_create_tier_list_meta.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🔄 Applying migration...");
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.length > 0) {
        const { error } = await supabase.rpc("exec_sql", { sql: statement });
        if (error) {
          // Try direct query if RPC doesn't work
          console.log(`   Executing: ${statement.substring(0, 50)}...`);
          // Use raw SQL execution - Supabase client doesn't support DDL directly
          // We'll need to use a different approach
        }
      }
    }

    // Alternative: Use Supabase Management API or direct connection
    console.log("⚠️ Direct SQL execution not supported via Supabase JS client");
    console.log("   Please run migration using one of these methods:");
    console.log("   1. Supabase Dashboard SQL Editor");
    console.log("   2. psql connection to your database");
    console.log("   3. supabase db push (after linking project)");
    console.log("\n   Migration file location:");
    console.log(`   ${migrationPath}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
