<#
.SYNOPSIS
    FitnessForge Update Script - pull latest code + rebuild + restart containers + schema sync + health check
.DESCRIPTION
    Steps:
      1. git pull (from chenweihanfool/FitnessForge on GitHub)
      2. docker compose up -d --build (build + (re)create the app container in one shot --
         avoids a false-positive .hermes-tmp cleanup warning that `docker compose build`
         alone can emit on this Windows Docker Desktop setup even on a successful build;
         the health check at the end is the real success signal, not this step's exit code)
      3. pg_dump backup to .\backups (keeps last 14) -- BEFORE schema sync, since
         db:push has no undo. Aborts the deploy if the backup itself fails, on
         purpose: proceeding to db:push with no safety net defeats the point.
      4. docker compose exec app npm run db:push (drizzle-kit schema sync -- safe to run
         every deploy for additive changes; only prompts interactively if drizzle-kit
         detects an ambiguous rename, which a normal schema addition won't trigger)
      5. health check (verify the site responds under /fitness)

    Same pattern as pf-cwh's update.ps1 on this same host. Postgres itself is NOT
    managed by this docker-compose file -- it's an existing instance shared with
    tasktracker/pf-cwh (see DATABASE_URL in .env), so there's no "postgres" service
    to restart here.

    Prerequisite (one-time, not done by this script): a `.env` file must exist next to
    docker-compose.yml with real secrets (copy .env.example and fill in), since it's
    git-ignored and won't come from `git pull`.

    Usage:
      - Double-click this .ps1 file
      - Or run in PowerShell: & "F:\WEBAPP\SRC\FitnessForge\update.ps1"

    DEPLOYMENT RULE (2026-07-25 architecture review, applies to every app on this
    host): this script is the ONLY sanctioned way to change what's running in the
    container. Do not `docker exec` into the running container to hand-edit files
    as a "hotfix" -- a real incident already happened on a sibling project on this
    same host where that was done, the fix was never committed to git, and the
    next `git pull` there silently reverted it with no record it ever existed. If
    something is truly urgent enough to bypass this, commit + push the change to
    git immediately afterward so the repo stays the source of truth.
.NOTES
    Version: 1.2
#>

$ErrorActionPreference = "Continue"
$RepoDir = "F:\WEBAPP\SRC\FitnessForge"
$LogFile = "$RepoDir\update.log"
$StartTime = Get-Date
$HealthUrl = "https://cwh2023.synology.me/fitness"
$AppPort = 5138

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "      FitnessForge Update Script v1.2     " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Start: $($StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
Write-Host ""

# Shared deploy helpers (Test-PortListening / Wait-ForPort) -- see
# https://github.com/chenweihanfool/deploy-helpers-
$modulePath = "F:\WEBAPP\Deploy\deploy-helpers\DeployHelpers.psm1"
if (-not (Test-Path $modulePath)) {
    Write-Host "ERROR: Shared module not found at $modulePath" -ForegroundColor Red
    Write-Host "  Clone from: git@github.com:chenweihanfool/deploy-helpers-.git" -ForegroundColor Yellow
    exit 1
}
Import-Module $modulePath -Force

function Run-Native {
    param([scriptblock]$ScriptBlock)
    $output = & $ScriptBlock
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Exit code: $exitCode - $output"
    }
    return $output
}

# ==============================================
# Step 1: git pull
# ==============================================
Write-Host "[1/5] Pulling latest code from GitHub..." -ForegroundColor Yellow
try {
    Push-Location $RepoDir
    $gitResult = Run-Native { git pull 2>&1 }
    Write-Host $gitResult
    if ($gitResult -match "Updating") {
        Write-Host "  >> Changes pulled" -ForegroundColor Green
    } else {
        Write-Host "  >> Already up to date" -ForegroundColor Gray
    }
    Pop-Location
}
catch {
    Write-Host "ERROR git pull: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# ==============================================
# Step 2: docker compose up -d --build (build + start in one shot)
# ==============================================
Write-Host "[2/5] Building + starting containers..." -ForegroundColor Yellow
try {
    Push-Location $RepoDir
    $upResult = cmd /c "docker compose up -d --build 2>&1"
    Write-Host $upResult
    # Skip LASTEXITCODE here -- Docker Desktop on this Windows host can emit a
    # false-positive .hermes-tmp cleanup warning (non-zero exit) after an
    # otherwise successful build+start. Wait-ForPort + the health check below
    # are the real signals.
    Write-Host "  >> Containers built & started" -ForegroundColor Green

    if (-not (Wait-ForPort -Port $AppPort -Retries 15 -DelaySeconds 2)) {
        throw "App did not start listening on port $AppPort within 30s"
    }
    Write-Host "  >> App listening on port $AppPort" -ForegroundColor Green
    Pop-Location
}
catch {
    Write-Host "ERROR docker up --build: $_" -ForegroundColor Red
    Write-Host "Make sure Docker Desktop is running and .env exists (copy from .env.example)" -ForegroundColor Yellow
    Pop-Location
    exit 1
}

# ==============================================
# Step 3: Pre-migration backup (pg_dump)
# ==============================================
Write-Host "[3/5] Backing up database before schema sync..." -ForegroundColor Yellow
try {
    Push-Location $RepoDir
    $envLine = Get-Content ".env" | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
    if (-not $envLine) {
        throw ".env has no DATABASE_URL line"
    }
    $databaseUrl = ($envLine -replace "^DATABASE_URL=", "").Trim('"').Trim("'")

    $backupDir = "$RepoDir\backups"
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupFileName = "fitnessforge-$timestamp.dump"

    # Throwaway postgres:16 container for pg_dump -- no need for Postgres client
    # tools on the Windows host. Connects out via host.docker.internal, same as
    # the app container already does (see DATABASE_URL in .env).
    $dumpResult = cmd /c "docker run --rm -v `"$backupDir`":/backup postgres:16 pg_dump `"$databaseUrl`" -Fc -f /backup/$backupFileName 2>&1"
    Write-Host $dumpResult
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed (exit code: $LASTEXITCODE)"
    }
    $backupSize = (Get-Item "$backupDir\$backupFileName").Length / 1KB
    Write-Host "  >> Backup saved: backups\$backupFileName ($([math]::Round($backupSize, 1)) KB)" -ForegroundColor Green

    # Keep only the most recent 14 backups
    Get-ChildItem $backupDir -Filter "fitnessforge-*.dump" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 14 |
        Remove-Item -Force

    Pop-Location
}
catch {
    Write-Host "ERROR backup: $_" -ForegroundColor Red
    Write-Host "  Aborting deploy -- db:push (next step) would have no safety net without" -ForegroundColor Yellow
    Write-Host "  a successful backup. Fix the backup issue and re-run." -ForegroundColor Yellow
    Pop-Location
    exit 1
}

# ==============================================
# Step 4: schema sync (drizzle-kit push)
# ==============================================
Write-Host "[4/5] Syncing database schema..." -ForegroundColor Yellow
try {
    Push-Location $RepoDir
    $pushResult = cmd /c "docker compose exec -T app npm run db:push 2>&1"
    Write-Host $pushResult
    if ($LASTEXITCODE -ne 0) {
        throw "npm run db:push failed (exit code: $LASTEXITCODE)"
    }
    Write-Host "  >> Schema synced" -ForegroundColor Green
    Pop-Location
}
catch {
    Write-Host "ERROR schema sync: $_" -ForegroundColor Red
    Write-Host "  If this hung or prompted for input, drizzle-kit likely detected an" -ForegroundColor Yellow
    Write-Host "  ambiguous rename -- run it manually: docker compose exec app npm run db:push" -ForegroundColor Yellow
    Pop-Location
}

# ==============================================
# Step 5: Health check
# ==============================================
Write-Host "[5/5] Health check..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $statusCode = (Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 15).StatusCode
    if ($statusCode -eq 200) {
        Write-Host "  >> PASS - FitnessForge is running (HTTP $statusCode)" -ForegroundColor Green
    } else {
        Write-Host "  >> WARNING - HTTP $statusCode, verify manually" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "  >> FAILED - $_" -ForegroundColor Red
    Write-Host "     Try: docker compose logs --tail=50 app" -ForegroundColor Yellow
}

# ==============================================
# Done
# ==============================================
$EndTime = Get-Date
$Duration = ($EndTime - $StartTime).TotalSeconds
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Update complete! ($($Duration.ToString('0.0'))s)" -ForegroundColor Cyan
Write-Host $HealthUrl -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$LogLine = "$($StartTime.ToString('yyyy-MM-dd HH:mm:ss')) | ${Duration:0.0}s | Done"
Add-Content -Path $LogFile -Value $LogLine -Encoding UTF8
