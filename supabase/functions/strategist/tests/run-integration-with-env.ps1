# Integration Test Runner with Environment Variable Setup
# Usage: .\tests\run-integration-with-env.ps1

param(
    [string]$MasterDeckAlchemistApiKey = "",
    [string]$SupabaseUrl = "",
    [string]$SupabaseServiceKey = ""
)

Write-Host "🧪 Deck Assistant Integration Tests" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check for .env file
if (Test-Path ".env") {
    Write-Host "📄 Loading environment variables from .env file..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
            Write-Host "   ✓ $key" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# Use parameters if provided
if ($MasterDeckAlchemistApiKey) {
    $env:GROQ_API_KEY = $MasterDeckAlchemistApiKey
}
if ($SupabaseUrl) {
    $env:SUPABASE_URL = $SupabaseUrl
}
if ($SupabaseServiceKey) {
    $env:SUPABASE_SERVICE_ROLE_KEY = $SupabaseServiceKey
}

# Check required variables
$missing = @()
if (-not $env:GROQ_API_KEY) { $missing += "GROQ_API_KEY" }
if (-not $env:SUPABASE_URL) { $missing += "SUPABASE_URL" }
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    $missing += "SUPABASE_SERVICE_ROLE_KEY"
}

if ($missing.Count -gt 0) {
    Write-Host "⚠️  Missing environment variables:" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "Set them using:" -ForegroundColor Yellow
    Write-Host '   $env:GROQ_API_KEY = "your-key"' -ForegroundColor Gray
    Write-Host '   $env:SUPABASE_URL = "https://your-project.supabase.co"' -ForegroundColor Gray
    Write-Host '   $env:SUPABASE_SERVICE_ROLE_KEY = "your-key"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or create a .env file with:" -ForegroundColor Yellow
    Write-Host "   GROQ_API_KEY=your-key" -ForegroundColor Gray
    Write-Host "   SUPABASE_URL=https://your-project.supabase.co" -ForegroundColor Gray
    Write-Host "   SUPABASE_SERVICE_ROLE_KEY=your-key" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Running integration tests..." -ForegroundColor Green
Write-Host ""

# Run tests
deno test --allow-net --allow-env --allow-read --no-check supabase/functions/deck-assistant/tests/integration-full.test.ts

Write-Host ""
Write-Host "Integration tests completed" -ForegroundColor Green
