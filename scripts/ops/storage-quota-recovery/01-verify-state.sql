-- =============================================================================
-- STEP 1: VERIFY (run in Supabase Dashboard → SQL Editor)
-- Project: supabase-md-alchemist (izshwywgfaozmisedwxm)
-- =============================================================================
-- If "metadata_total" is ~370 MB but Dashboard → Usage still shows ~3+ GB,
-- physical files were orphaned by prior SQL DELETEs. Use S3/API cleanup next.

SELECT
  COUNT(*) AS object_count,
  pg_size_pretty(COALESCE(SUM((metadata->>'size')::bigint), 0)) AS metadata_total
FROM storage.objects
WHERE bucket_id = 'card-images';

SELECT
  CASE
    WHEN name LIKE 'cards_small/%' THEN 'cards_small'
    WHEN name LIKE 'cards/%' THEN 'cards_full'
    WHEN name ~ '^[0-9]+\.jpg$' THEN 'orphan_root'
    ELSE 'other'
  END AS category,
  COUNT(*) AS file_count,
  pg_size_pretty(COALESCE(SUM((metadata->>'size')::bigint), 0)) AS metadata_size
FROM storage.objects
WHERE bucket_id = 'card-images'
GROUP BY 1
ORDER BY 1;

SELECT COUNT(*) AS asset_rows,
       COUNT(*) FILTER (WHERE storage_path LIKE 'cards_small/%') AS small_paths,
       COUNT(*) FILTER (WHERE storage_path LIKE 'cards/%') AS full_paths
FROM card_image_assets;
