-- =============================================================================
-- PART D step 2: Remove Supabase Storage metadata ONLY (after AWS + DB URLs set)
-- =============================================================================
-- Does NOT truncate card_image_assets — URLs already point to AWS.
-- Run AFTER 02-wipe-bucket-via-s3.ps1 completes with 0 remaining objects.

SET storage.allow_delete_query = 'true';

DELETE FROM storage.objects
WHERE bucket_id = 'card-images';

SELECT COUNT(*) AS remaining_storage_objects
FROM storage.objects
WHERE bucket_id = 'card-images';

SELECT COUNT(*) AS card_image_assets_rows FROM card_image_assets;
