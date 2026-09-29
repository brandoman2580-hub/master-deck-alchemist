-- =============================================================================
-- STEP 3: CLEAN METADATA (run AFTER physical wipe via S3/API or Support purge)
-- =============================================================================
-- Safe to run when physical files are already gone.
-- This only removes storage.* rows; it does NOT create new orphans.
--
-- IMPORTANT (AWS migration already complete):
-- Do NOT truncate public.card_image_assets — it holds S3 public URLs the app needs.
-- =============================================================================

-- Preview rows to remove
SELECT COUNT(*) AS rows_to_delete
FROM storage.objects
WHERE bucket_id = 'card-images';

-- Delete storage metadata for card-images bucket (no-op if already empty)
SET storage.allow_delete_query = 'true';

DELETE FROM storage.objects
WHERE bucket_id = 'card-images';

-- Remove empty bucket row if it still exists
DELETE FROM storage.buckets
WHERE id = 'card-images';

-- Verify
SELECT COUNT(*) AS remaining_objects
FROM storage.objects
WHERE bucket_id = 'card-images';

SELECT COUNT(*) AS remaining_buckets
FROM storage.buckets
WHERE id = 'card-images';

-- Asset index should still point at AWS S3
SELECT COUNT(*) AS asset_rows,
       COUNT(*) FILTER (WHERE small_public_url ILIKE '%amazonaws%') AS s3_urls
FROM card_image_assets;
