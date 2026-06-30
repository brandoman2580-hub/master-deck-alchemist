-- =============================================================================
-- PART C: Point card_image_assets at AWS S3 (run AFTER AWS upload verified)
-- =============================================================================
-- 1. Replace YOUR_BUCKET_NAME below (e.g. mda-card-images-prod)
-- 2. Run in Supabase SQL Editor

-- Preview
SELECT card_id, storage_path, public_url
FROM card_image_assets
LIMIT 3;

-- Update all rows to AWS S3 URLs (thumbnails only)
UPDATE card_image_assets
SET
  storage_path = 'cards_small/' || card_id::text || '.jpg',
  public_url = 'https://mda-card-images-prod.s3.us-east-1.amazonaws.com/cards_small/' || card_id::text || '.jpg',
  small_public_url = 'https://mda-card-images-prod.s3.us-east-1.amazonaws.com/cards_small/' || card_id::text || '.jpg',
  updated_at = NOW()
WHERE card_id IS NOT NULL;

-- Verify
SELECT card_id, public_url, small_public_url
FROM card_image_assets
LIMIT 5;

SELECT COUNT(*) AS updated_rows FROM card_image_assets;
