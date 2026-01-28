# Fix Git Index Lock File
# This script helps remove the .git/index.lock file when it's stuck

$lockFile = Join-Path $PSScriptRoot "..\.git\index.lock"

Write-Host "Checking for Git lock file..." -ForegroundColor Yellow

if (Test-Path $lockFile) {
    Write-Host "Lock file found at: $lockFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Attempting to remove lock file..." -ForegroundColor Yellow
    
    # Try to remove the file
    try {
        Remove-Item $lockFile -Force -ErrorAction Stop
        Write-Host "✓ Successfully removed lock file!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now use Git commands normally." -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to remove lock file: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "The lock file is being held by another process." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please try the following:" -ForegroundColor Yellow
        Write-Host "1. Close Cursor/VS Code completely" -ForegroundColor White
        Write-Host "2. Close any Git GUI applications (GitKraken, SourceTree, GitHub Desktop, etc.)" -ForegroundColor White
        Write-Host "3. Wait 5-10 seconds" -ForegroundColor White
        Write-Host "4. Run this script again, or manually delete: $lockFile" -ForegroundColor White
        Write-Host "5. Reopen Cursor and try your Git command again" -ForegroundColor White
        Write-Host ""
        Write-Host "If the problem persists, you may need to:" -ForegroundColor Yellow
        Write-Host "- Restart your computer" -ForegroundColor White
        Write-Host "- Run PowerShell as Administrator and try again" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "✓ No lock file found. Git should work normally." -ForegroundColor Green
}
