$base = "c:\Users\yasha\vsCode\GoogleStockNFT\backend\data"

$master = [ordered]@{}

# GTD: Google Sheet
$d1 = Get-Content (Join-Path $base "gtd-wl.json") -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($e in $d1) {
    $a = $e.address.ToLower()
    if (-not $master[$a]) { $master[$a] = @{ gtd = $false; fcfs = $false } }
    $master[$a].gtd = $true
}

# GTD: also the surviving Twitter submissions
$d3 = Get-Content (Join-Path $base "whitelist-backup-20260809.json") -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($e in $d3) {
    $a = $e.walletAddress.ToLower()
    if (-not $master[$a]) { $master[$a] = @{ gtd = $false; fcfs = $false } }
    $master[$a].gtd = $true
}

# FCFS: Collab holders only
$d2 = Get-Content (Join-Path $base "collab-holders.json") -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($e in $d2) {
    $a = $e.address.ToLower()
    if (-not $master[$a]) { $master[$a] = @{ gtd = $false; fcfs = $false } }
    $master[$a].fcfs = $true
}

# Build output
$result = @()
$gtdOnly = 0; $fcfsOnly = 0; $both = 0
foreach ($addr in $master.Keys) {
    $flags = $master[$addr]
    $tag = ""
    if ($flags.gtd -and $flags.fcfs) { $tag = "GTD+FCFS"; $both++ }
    elseif ($flags.gtd) { $tag = "GTD"; $gtdOnly++ }
    else { $tag = "FCFS"; $fcfsOnly++ }
    $result += [PSCustomObject]@{ address = $addr; list = $tag }
}

$result = $result | Sort-Object address
$result | ConvertTo-Json -Depth 2 | Out-File -FilePath (Join-Path $base "wl-master.json") -Encoding utf8
($result | ForEach-Object { $_.address }) | Out-File -FilePath (Join-Path $base "wl-master-addresses.txt") -Encoding utf8

Write-Host "=== Final WL ==="
Write-Host "GTD only (Sheet + Submissions): $gtdOnly"
Write-Host "FCFS only (Collab): $fcfsOnly"
Write-Host "Both GTD+FCFS: $both"
Write-Host "Total unique: $($result.Count)"
Write-Host "`nSaved: wl-master.json + wl-master-addresses.txt"
