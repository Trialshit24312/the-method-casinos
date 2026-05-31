# Push to GitHub and open Render deploy (run after: gh auth login)
param(
    [string]$RepoName = "the-method-casinos",
    [ValidateSet("public", "private")]
    [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }

Write-Host "Checking GitHub login..."
& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run: gh auth login"
    Write-Host "Then run this script again."
    exit 1
}

if (-not (Test-Path ".git")) {
    git init
    git add .
    git commit -m "Initial commit: The Method Casinos"
    git branch -M main
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host "Creating GitHub repo: $RepoName ($Visibility)..."
    & $gh repo create $RepoName --$Visibility --source=. --remote=origin --push
} else {
    Write-Host "Pushing to origin..."
    git push -u origin main
}

$repoUrl = (& $gh repo view --json url -q .url)
Write-Host ""
Write-Host "GitHub repo: $repoUrl"
Write-Host ""
Write-Host "Next — deploy live (free, all-in-one):"
Write-Host "  1. Open https://dashboard.render.com/select-repo?type=blueprint"
Write-Host "  2. Connect GitHub and select this repo (uses render.yaml)"
Write-Host "  3. Set secret env vars: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,"
Write-Host "     ADMIN_DISCORD_IDS, DISCORD_GUILD_ID, DISCORD_INVITE_URL"
Write-Host "  4. After first deploy, set PUBLIC_SITE_URL, DASHBOARD_URL, API_URL to your Render URL"
Write-Host "  5. Set DISCORD_REDIRECT_URI to https://YOUR-URL.onrender.com/auth/discord/callback"
Write-Host "     (same value in Discord Developer Portal OAuth2 redirects)"
Write-Host "  6. Redeploy, then run: npm run register-commands"
Write-Host ""
Write-Host "Full guide: DEPLOYMENT.md"
