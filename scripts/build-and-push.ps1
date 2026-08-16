<#
.SYNOPSIS
    Builds the WorldWatcher client and server images and pushes them to Docker Hub.

.DESCRIPTION
    Run this from anywhere; paths are resolved relative to the repo root.
    Requires `docker login` to have been run already for the nihtin account.

.PARAMETER Tag
    Version suffix appended to each image tag, e.g. "v1" -> server_v1 / client_v1.
    Must match (or be updated in) the image: fields in docker-compose.yml.

.PARAMETER SkipPush
    Build and tag locally only; don't push to Docker Hub.

.EXAMPLE
    ./scripts/build-and-push.ps1 -Tag v1
#>
param(
    [string]$Tag = "v1",
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$namespace = "nihtin/worldwatcher"

$serverImage = "${namespace}:server_${Tag}"
$clientImage = "${namespace}:client_${Tag}"

Write-Host "Building server image: $serverImage" -ForegroundColor Cyan
docker build -t $serverImage -f (Join-Path $repoRoot "Server\Dockerfile") (Join-Path $repoRoot "Server")

Write-Host "Building client image: $clientImage" -ForegroundColor Cyan
docker build -t $clientImage -f (Join-Path $repoRoot "Client\Dockerfile") (Join-Path $repoRoot "Client")

if ($SkipPush) {
    Write-Host "Skipping push (-SkipPush passed). Images built and tagged locally." -ForegroundColor Yellow
    exit 0
}

Write-Host "Pushing $serverImage" -ForegroundColor Cyan
docker push $serverImage

Write-Host "Pushing $clientImage" -ForegroundColor Cyan
docker push $clientImage

Write-Host "Done. Update docker-compose.yml image tags if this Tag differs from what's already there." -ForegroundColor Green
