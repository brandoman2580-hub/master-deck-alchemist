-- =============================================================================
-- PART D: Backfill cards.card_images from card_image_assets (AWS S3 URLs)
-- =============================================================================
-- Run AFTER Part C (04-update-card-image-urls.sql) and AWS upload verified.
-- Safe to re-run: overwrites card_images for rows that have card_image_assets.

-- Preview
SELECT c.id, c.name, c.card_images AS before
FROM cards c
JOIN card_image_assets a ON a.card_id = c.id
WHERE c.card_images::text LIKE '%ygoprodeck%'
LIMIT 3;

-- Backfill
UPDATE cards c
SET card_images = (
  SELECT jsonb_build_array(
    jsonb_build_object(
      'id', c.id,
      'image_url', a.public_url,
      'image_url_small', COALESCE(a.small_public_url, a.public_url)
    )
  )
  FROM card_image_assets a
  WHERE a.card_id = c.id
)
WHERE EXISTS (SELECT 1 FROM card_image_assets a WHERE a.card_id = c.id);

-- Verify
SELECT
  COUNT(*) FILTER (WHERE card_images::text LIKE '%amazonaws%') AS aws_urls,
  COUNT(*) FILTER (WHERE card_images::text LIKE '%ygoprodeck%') AS ygopro_urls,
  COUNT(*) AS total
FROM cards;
