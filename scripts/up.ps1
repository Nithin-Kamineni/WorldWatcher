<#
.SYNOPSIS
    Starts the WorldWatcher stack and prints the URLs to reach it, including
    a LAN URL for other devices (phone, another PC) on the same network.
#>
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    docker compose up -d
    Write-Host ""
    docker compose ps

    $lanIp = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -First 1 -ExpandProperty IPAddress

    Write-Host ""
    Write-Host "WorldWatcher is up:" -ForegroundColor Green
    Write-Host "  This PC:        http://localhost/campaigns  (also http://localhost:5173/campaigns)"
    if ($lanIp) {
        Write-Host "  Other devices:  http://${lanIp}/campaigns  (same WiFi/LAN only)"
    } else {
        Write-Host "  Other devices:  couldn't auto-detect a LAN IP - run 'ipconfig' to find it manually."
    }
}
finally {
    Pop-Location
}
