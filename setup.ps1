param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot
function Run-Npm {
    & npm.cmd @args
    if ($LASTEXITCODE -ne 0) { throw "npm failed ($LASTEXITCODE). Fix the error above, then rerun setup.ps1." }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 22.12+ (LTS recommended), reopen PowerShell, then retry.'
}
$nodeVersion = [version](& node -p process.versions.node)
if ($nodeVersion -lt [version]'22.12.0') { throw 'Node.js 22.12 or newer is required.' }
Write-Host 'Nozhan setup: MySQL must already be running; create an EMPTY database first (see README.fa.md).'
if (-not $SkipInstall) { Run-Npm ci --no-audit --no-fund }
if (-not (Test-Path -LiteralPath '.env')) { Run-Npm run setup:env }
else { Write-Host 'Existing .env preserved.' }
Run-Npm run db:generate
Run-Npm run db:deploy
Run-Npm run db:admin -- --if-missing
Run-Npm run typecheck
Run-Npm run build
Write-Host ''
Write-Host 'Setup complete. Run: npm.cmd start -- --hostname 127.0.0.1'
Write-Host 'Then open http://localhost:3000 (keep this terminal open).'
Write-Host 'For network deployment, configure HTTPS and COOKIE_SECURE=true. See README.fa.md.'
