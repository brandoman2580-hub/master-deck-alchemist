/**
 * Phase 1 storage cleanup: remove duplicate orphan JPGs and full-size cards/ copies.
 * Keeps only cards_small/ thumbnails (~370 MB).
 *
 * Usage: npx tsx --env-file=.env.local scripts/prune-card-image-storage.ts
 * Dry run: npx tsx --env-file=.env.local scripts/prune-card-image-storage.ts --dry-run
 *
 * If Storage API is blocked (exceed_storage_size_quota), run in Supabase SQL editor:
 *   SET storage.allow_delete_query = 'true';
 *   DELETE FROM storage.objects WHERE bucket_id = 'card-images'
 *     AND name NOT LIKE 'cards/%' AND name NOT LIKE 'cards_small/%';
 *   DELETE FROM storage.objects WHERE bucket_id = 'card-images' AND name LIKE 'cards/%';
 *   UPDATE card_image_assets SET public_url = small_public_url,
 *     storage_path = REPLACE(storage_path, 'cards/', 'cards_small/')
 *   WHERE storage_path LIKE 'cards/%';
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "card-images";
const BATCH_SIZE = 500;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isDryRun = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function shouldDelete(path: string): boolean {
  if (path.startsWith("cards_small/")) return false;
  if (path.startsWith("cards/")) return true;
  // Legacy root-level duplicates (e.g. 12345.jpg)
  return /^[0-9]+\.jpg$/i.test(path);
}

async function listPathsViaStorageApi(): Promise<string[]> {
  const paths: string[] = [];

  async function walk(prefix: string): Promise<void> {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        throw new Error(`Failed to list ${prefix || "(root)"}: ${error.message}`);
      }

      if (!data || data.length === 0) break;

      for (const item of data) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) {
          await walk(fullPath);
          continue;
        }
        if (shouldDelete(fullPath)) paths.push(fullPath);
      }

      if (data.length < 1000) break;
      offset += 1000;
    }
  }

  await walk("");
  return paths;
}

async function deleteInBatches(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      throw new Error(`Delete batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
    }
    const removed = data?.length ?? batch.length;
    console.log(`Removed ${removed} objects (${Math.min(i + BATCH_SIZE, paths.length)}/${paths.length})`);
  }
}

async function main(): Promise<void> {
  console.log(isDryRun ? "DRY RUN — no deletions" : "LIVE RUN — deleting storage objects");
  console.log("Listing objects to prune...");

  const paths = await listPathsViaStorageApi();
  const orphans = paths.filter((p) => /^[0-9]+\.jpg$/i.test(p)).length;
  const fullCards = paths.filter((p) => p.startsWith("cards/")).length;

  console.log(`Found ${paths.length} objects to delete (${orphans} orphans, ${fullCards} cards/ full-size)`);

  if (paths.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (isDryRun) {
    console.log("Sample paths:", paths.slice(0, 5));
    return;
  }

  await deleteInBatches(paths);
  console.log("Storage prune complete.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
