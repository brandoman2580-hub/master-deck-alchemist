# Integration Test Runner for Deck Assistant (PowerShell)
# Run with: .\tests\run-integration-tests.ps1

Write-Host "🧪 Running Deck Assistant Integration Tests" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check for required environment variables
if (-not $env:GROQ_API_KEY) {
    Write-Host "⚠️  Warning: GROQ_API_KEY not set" -ForegroundColor Yellow
    Write-Host "   Some tests will be skipped" -ForegroundColor Yellow
}

if (-not $env:SUPABASE_URL) {
    Write-Host "⚠️  Warning: SUPABASE_URL not set" -ForegroundColor Yellow
    Write-Host "   Some tests will be skipped" -ForegroundColor Yellow
}

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set" -ForegroundColor Yellow
    Write-Host "   Some tests will be skipped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Running tests..." -ForegroundColor Green
Write-Host ""

# Run integration tests
deno test --allow-net --allow-env --allow-read tests/integration-full.test.ts

Write-Host ""
Write-Host "✅ Integration tests completed" -ForegroundColor Green
