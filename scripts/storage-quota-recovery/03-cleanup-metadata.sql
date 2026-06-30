-- =============================================================================
-- STEP 3: CLEAN METADATA (run AFTER Step 2 S3 wipe completes)
-- =============================================================================
-- Safe to run now because physical files are already gone via S3/API.
-- This only removes database rows; it does not create new orphans.

-- Preview rows to remove
SELECT COUNT(*) AS rows_to_delete
FROM storage.objects
WHERE bucket_id = 'card-images';

-- Delete storage metadata for card-images bucket
SET storage.allow_delete_query = 'true';

DELETE FROM storage.objects
WHERE bucket_id = 'card-images';

-- Reset asset index (Phase 2 will re-sync thumbnails via Storage API)
TRUNCATE card_image_assets;

-- Verify
SELECT COUNT(*) AS remaining_objects
FROM storage.objects
WHERE bucket_id = 'card-images';

SELECT COUNT(*) AS remaining_assets FROM card_image_assets;
