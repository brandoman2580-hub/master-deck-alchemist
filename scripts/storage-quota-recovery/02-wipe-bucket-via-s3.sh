#!/usr/bin/env bash
# =============================================================================
# STEP 2: PHYSICALLY DELETE ALL FILES (macOS / Linux)
# =============================================================================
set -euo pipefail

PROFILE_NAME="supabase-md-alchemist"
PROJECT_REF="izshwywgfaozmisedwxm"
REGION="us-east-1"
BUCKET="card-images"
ENDPOINT="https://${PROJECT_REF}.storage.supabase.co/storage/v1/s3"

# One-time: aws configure --profile "$PROFILE_NAME"

EMPTY_DIR="$(mktemp -d)"
trap 'rm -rf "$EMPTY_DIR"' EXIT

echo "Listing current bucket objects (first 20)..."
aws s3 ls "s3://${BUCKET}/" --recursive --profile "$PROFILE_NAME" --endpoint-url "$ENDPOINT" --region "$REGION" | head -20

echo ""
echo "WARNING: This will permanently delete ALL files in s3://${BUCKET}"
read -r -p "Type DELETE to continue: " confirm
[[ "$confirm" == "DELETE" ]] || { echo "Aborted."; exit 1; }

aws s3 sync "${EMPTY_DIR}/" "s3://${BUCKET}/" --delete \
  --profile "$PROFILE_NAME" \
  --endpoint-url "$ENDPOINT" \
  --region "$REGION"

echo "Done. Run 03-cleanup-metadata.sql in SQL Editor, then check Usage in ~15-60 min."
