/**
 * Apply tier list migration to Supabase
 * 
 * This script reads the migration SQL file and applies it to your Supabase database.
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  console.error("\n   Please set these in your .env.local file or export them:");
  console.error("   export NEXT_PUBLIC_SUPABASE_URL=your_url");
  console.error("   export SUPABASE_SERVICE_ROLE_KEY=your_key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(
      process.cwd(),
      "supabase/migrations/20260111200000_create_tier_list_meta.sql"
    );
    
    let migrationSQL: string;
    try {
      migrationSQL = readFileSync(migrationPath, "utf-8");
    } catch (error) {
      console.error(`❌ Could not read migration file: ${migrationPath}`);
      process.exit(1);
    }

    console.log("🔄 Applying migration to Supabase...");
    console.log("   Note: Supabase JS client doesn't support DDL directly.");
    console.log("   This script will attempt to execute via RPC if available.\n");

    // Try to execute via a custom RPC function (if it exists)
    // Otherwise, we'll provide instructions
    const { error: rpcError } = await supabase.rpc("exec_sql", { 
      sql: migrationSQL 
    });

    if (rpcError) {
      console.log("⚠️  Direct SQL execution not available via Supabase JS client.");
      console.log("\n📋 To apply this migration, use one of these methods:\n");
      console.log("   1. Supabase Dashboard:");
      console.log("      - Go to your Supabase project dashboard");
      console.log("      - Navigate to SQL Editor");
      console.log("      - Copy and paste the migration SQL");
      console.log("      - Execute\n");
      console.log("   2. Supabase CLI (if linked):");
      console.log("      supabase db push\n");
      console.log("   3. psql (direct database connection):");
      console.log("      psql <connection_string> -f supabase/migrations/20260111200000_create_tier_list_meta.sql\n");
      console.log("   Migration file location:");
      console.log(`   ${migrationPath}\n`);
      console.log("   Migration SQL preview:");
      console.log("   " + "=".repeat(60));
      console.log(migrationSQL.substring(0, 500) + "...");
      console.log("   " + "=".repeat(60));
    } else {
      console.log("✅ Migration applied successfully!");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

applyMigration();
