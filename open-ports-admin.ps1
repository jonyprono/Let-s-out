# ============================================================
# LetsOut - Ouverture des ports dans le pare-feu Windows
# Doit etre execute en tant qu'Administrateur
# ============================================================

Write-Host ""
Write-Host "Configuration du pare-feu pour LetsOut..." -ForegroundColor Cyan
Write-Host ""

# Supprimer les anciennes regles si elles existent
netsh advfirewall firewall delete rule name="LetsOut Frontend 3000" 2>$null | Out-Null
netsh advfirewall firewall delete rule name="LetsOut API 3001" 2>$null | Out-Null

# Regle pour le frontend (port 3000)
netsh advfirewall firewall add rule name="LetsOut Frontend 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,public
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Port 3000 (Frontend) ouvert" -ForegroundColor Green
} else {
    Write-Host "ERREUR - Port 3000 non ouvert" -ForegroundColor Red
}

# Regle pour l'API (port 3001)
netsh advfirewall firewall add rule name="LetsOut API 3001" dir=in action=allow protocol=TCP localport=3001 profile=private,public
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Port 3001 (API) ouvert" -ForegroundColor Green
} else {
    Write-Host "ERREUR - Port 3001 non ouvert" -ForegroundColor Red
}

Write-Host ""

# Trouver l'IP WiFi (pas Docker/WSL)
$wifiIP = $null

# Chercher l'adaptateur Wi-Fi en priorite
$wifiAdapter = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -like "192.168.*" -and $_.PrefixOrigin -ne "WellKnown"
} | Select-Object -First 1

if ($wifiAdapter) {
    $wifiIP = $wifiAdapter.IPAddress
} else {
    # Fallback: n'importe quelle IP privee non-loopback
    $anyAdapter = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.*" -and
        $_.IPAddress -ne "0.0.0.0" -and
        $_.PrefixOrigin -ne "WellKnown"
    } | Select-Object -First 1
    if ($anyAdapter) {
        $wifiIP = $anyAdapter.IPAddress
    }
}

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "Adresse IP WiFi : $wifiIP" -ForegroundColor White
Write-Host "Frontend (navigateur) : http://$($wifiIP):3000" -ForegroundColor White
Write-Host "API : http://$($wifiIP):3001/health" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Lance 'pnpm dev' puis ouvre http://$($wifiIP):3000 sur ton telephone" -ForegroundColor Green
Write-Host ""

Read-Host "Appuie sur Entree pour fermer"
