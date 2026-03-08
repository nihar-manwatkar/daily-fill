# Push DailyFill to GitHub
# Run this AFTER creating the repo at https://github.com/new

$username = Read-Host "Enter your GitHub username"
if ([string]::IsNullOrWhiteSpace($username)) {
    Write-Host "No username entered. Exiting." -ForegroundColor Red
    exit 1
}

$repoName = "daily-fill"
$remoteUrl = "https://github.com/$username/$repoName.git"

Write-Host "`nAdding remote: $remoteUrl" -ForegroundColor Cyan
git remote add origin $remoteUrl

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDone! Your code is on GitHub." -ForegroundColor Green
    Write-Host "Repo URL: https://github.com/$username/$repoName" -ForegroundColor Green
} else {
    Write-Host "`nPush failed. Common causes:" -ForegroundColor Yellow
    Write-Host "1. Repo doesn't exist yet - create it at https://github.com/new?name=daily-fill" -ForegroundColor Yellow
    Write-Host "2. Wrong username - run: git remote set-url origin https://github.com/YOUR_USERNAME/daily-fill.git" -ForegroundColor Yellow
    Write-Host "3. Need to sign in - GitHub may prompt for credentials" -ForegroundColor Yellow
}
