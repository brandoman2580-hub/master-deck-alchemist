# Copy card thumbnails from Supabase Storage to AWS S3 via local cache.
# See MIGRATION-GUIDE.txt for full instructions.
#
# Usage (from repo root):
#   .\scripts\image-migration\migrate-supabase-to-aws-s3.ps1 -AwsBucket "your-bucket-name"
#
# Optional:
#   -DryRun         Count only, no download/upload
#   -SkipDownload   Upload existing cache only (cache must already have files)

param(
  [Parameter(Mandatory = $true)]
  [string]$AwsBucket,

  [string]$SupabaseProfile = "supabase-md-alchemist",
  [string]$AwsProfile = "mda-aws",
  [string]$ProjectRef = "izshwywgfaozmisedwxm",
  [string]$Region = "us-east-1",
  [string]$SupabaseBucket = "card-images",
  [string]$Prefix = "cards_small",
  [switch]$DryRun,
  [switch]$SkipDownload
)

function Invoke-Aws {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$AwsArgs
  )

  & aws @AwsArgs
  if ($LASTEXITCODE -ne 0) {
    throw "aws command failed (exit $LASTEXITCODE): aws $($AwsArgs -join ' ')"
  }
}

function Get-S3ObjectCount {
  param(
    [string[]]$AwsArgs
  )

  $output = & aws @AwsArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "aws ls failed (exit $LASTEXITCODE): $output"
  }

  if (-not $output) {
    return 0
  }

  return @($output).Count
}

$SupabaseEndpoint = "https://$ProjectRef.storage.supabase.co/storage/v1/s3"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$CacheDir = Join-Path $RepoRoot ".image-migration-cache\$Prefix"
$SupabaseS3Path = "s3://$SupabaseBucket/$Prefix/"
$AwsS3Path = "s3://$AwsBucket/$Prefix/"

Write-Host "Supabase source: $SupabaseS3Path"
Write-Host "AWS destination: $AwsS3Path"
Write-Host "Local cache:      $CacheDir"
Write-Host "Supabase profile: $SupabaseProfile"
Write-Host "AWS profile:      $AwsProfile"
Write-Host ""

Write-Host "Counting objects on Supabase..."
$supabaseCount = Get-S3ObjectCount @(
  "s3", "ls", $SupabaseS3Path,
  "--recursive",
  "--profile", $SupabaseProfile,
  "--endpoint-url", $SupabaseEndpoint,
  "--region", $Region
)
Write-Host "Supabase $Prefix objects: $supabaseCount"

if ($DryRun) {
  Write-Host "Dry run — stopping before transfer."
  exit 0
}

if (-not $SkipDownload) {
  New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
  Write-Host ""
  Write-Host "Step 1/2: Downloading from Supabase to cache (may take several minutes)..."
  Invoke-Aws @(
    "s3", "sync",
    $SupabaseS3Path, $CacheDir,
    "--profile", $SupabaseProfile,
    "--endpoint-url", $SupabaseEndpoint,
    "--region", $Region
  )
} else {
  Write-Host ""
  Write-Host "Skipping download (-SkipDownload). Using existing cache."
  if (-not (Test-Path $CacheDir)) {
    throw "Cache directory does not exist: $CacheDir. Run without -SkipDownload first."
  }
}

$localCount = (Get-ChildItem -Path $CacheDir -File -Recurse | Measure-Object).Count
Write-Host "Local cache files: $localCount"

if ($localCount -eq 0) {
  throw "No files in cache at $CacheDir. Download failed or Supabase path is empty."
}

Write-Host ""
Write-Host "Step 2/2: Uploading to AWS S3..."
Invoke-Aws @(
  "s3", "sync",
  $CacheDir, $AwsS3Path,
  "--profile", $AwsProfile,
  "--region", $Region
)

Write-Host ""
Write-Host "Counting objects on AWS..."
$awsCount = Get-S3ObjectCount @(
  "s3", "ls", $AwsS3Path,
  "--recursive",
  "--profile", $AwsProfile,
  "--region", $Region
)
Write-Host "AWS $Prefix objects: $awsCount"

$baseUrl = "https://$AwsBucket.s3.$Region.amazonaws.com/$Prefix"
Write-Host ""
Write-Host "Sample URL: $baseUrl/483.jpg"
Write-Host ""

if ($awsCount -ge $supabaseCount -and $awsCount -gt 0) {
  Write-Host "SUCCESS — Next steps:"
  Write-Host "  1. Open sample URL in browser"
  Write-Host "  2. Run scripts/image-migration/04-update-card-image-urls.sql"
  Write-Host "  3. Run scripts/storage-quota-recovery/02-wipe-bucket-via-s3.ps1"
  Write-Host "  4. Run scripts/image-migration/05-wipe-supabase-metadata-only.sql"
} else {
  Write-Warning "Counts differ (Supabase: $supabaseCount, AWS: $awsCount)."
  Write-Host "Common fixes:"
  Write-Host "  - Run: aws configure list-profiles   (confirm '$AwsProfile' exists)"
  Write-Host "  - Run: aws s3 ls s3://$AwsBucket/ --profile $AwsProfile --region $Region"
  Write-Host "  - Check IAM user has s3:PutObject on the bucket"
  exit 1
}
