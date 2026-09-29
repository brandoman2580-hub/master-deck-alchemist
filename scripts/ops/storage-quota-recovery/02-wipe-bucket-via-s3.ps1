# =============================================================================
# STEP 2: PHYSICALLY DELETE ALL FILES (fixes orphaned Supabase storage)
# =============================================================================
# Run:  .\scripts\storage-quota-recovery\02-wipe-bucket-via-s3.ps1
# When prompted, type DELETE (do not pass DELETE on the command line)
#
# Prerequisites:
#   1. AWS CLI v2
#   2. Supabase S3 keys: Project Settings -> Storage -> S3 Connection
#   3. Profile: aws configure --profile supabase-md-alchemist

$PROFILE_NAME = "supabase-md-alchemist"
$PROJECT_REF  = "izshwywgfaozmisedwxm"
$REGION       = "us-east-1"
$BUCKET       = "card-images"
$ENDPOINT     = "https://$PROJECT_REF.storage.supabase.co/storage/v1/s3"

$emptyDir = Join-Path $env:TEMP "supabase-empty-dir"
New-Item -ItemType Directory -Force -Path $emptyDir | Out-Null

Write-Host "Counting objects in bucket (may take 1-2 minutes)..."
$objectLines = aws s3 ls "s3://$BUCKET/" --recursive --profile $PROFILE_NAME --endpoint-url $ENDPOINT --region $REGION
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to list bucket. Check supabase-md-alchemist profile and Pro plan status."
}
$objectCount = ($objectLines | Measure-Object -Line).Lines
Write-Host "Found $objectCount objects in s3://$BUCKET"
Write-Host "Preview (first 5):"
$objectLines | Select-Object -First 5

Write-Host ""
Write-Host "WARNING: This will permanently delete ALL files in s3://$BUCKET"
$confirm = Read-Host "Type DELETE to continue"
if ($confirm -ne "DELETE") {
  Write-Host "Aborted."
  exit 1
}

Write-Host "Syncing empty directory to bucket (deletes ALL $objectCount objects, not just the preview)..."
aws s3 sync "$emptyDir/" "s3://$BUCKET/" --delete --profile $PROFILE_NAME --endpoint-url $ENDPOINT --region $REGION
if ($LASTEXITCODE -ne 0) {
  Write-Error "Sync delete failed (exit $LASTEXITCODE)."
}

$remaining = (aws s3 ls "s3://$BUCKET/" --recursive --profile $PROFILE_NAME --endpoint-url $ENDPOINT --region $REGION | Measure-Object -Line).Lines
Write-Host "Remaining objects: $remaining"

Write-Host ""
Write-Host "Done. Next: run scripts/image-migration/05-wipe-supabase-metadata-only.sql in SQL Editor."
Write-Host "Then check Supabase Usage in 15-60 minutes."
