$ErrorActionPreference = "Stop"

$contracts = @{
    "ZaibatsuWagies"  = "0x42bb0b25b7781a8e8a54184a9b774cdfafd17027"
    "OnChainHoodies"   = "0x9ec6c5b9f572a9b02138e553bc5f5882da735f45"
    "StonkBrokers"     = "0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0"
}

$allHolders = @{}  # keyed by lowercase address -> { address, collections[], totalTokens }

foreach ($name in $contracts.Keys) {
    $addr = $contracts[$name]
    Write-Host "`n=== Fetching $name ($addr) ==="
    $nextParams = ""
    $page = 0
    $collected = 0

    do {
        $page++
        $url = "https://robinhoodchain.blockscout.com/api/v2/tokens/$addr/holders$nextParams"
        try {
            $resp = Invoke-RestMethod -Uri $url -TimeoutSec 30
        } catch {
            Write-Host "  ERROR on page $page : $_"
            break
        }

        if (-not $resp.items -or $resp.items.Count -eq 0) {
            Write-Host "  No items on page $page — done."
            break
        }

        foreach ($item in $resp.items) {
            $wallet = $item.address.hash.ToLower()
            $tokenCount = [int]$item.value
            if ($allHolders.ContainsKey($wallet)) {
                $allHolders[$wallet].collections += $name
                $allHolders[$wallet].totalTokens += $tokenCount
            } else {
                $allHolders[$wallet] = @{
                    address     = $wallet
                    collections = @($name)
                    totalTokens = $tokenCount
                }
            }
            $collected++
        }

        Write-Host "  Page $page : $($resp.items.Count) items (running: $collected / ?)"

        # Build next page params
        if ($resp.next_page_params) {
            $params = ($resp.next_page_params.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join [char]38
            $nextParams = "?$params"
        } else {
            $nextParams = $null
        }
    } while ($nextParams)

    Write-Host "  Done: $collected holders for $name"
}

Write-Host "`n============================================="
Write-Host "Total unique holders: $($allHolders.Count)"
Write-Host "============================================="

# Convert to array sorted by address
$result = $allHolders.Values | Sort-Object address | ForEach-Object {
    [PSCustomObject]@{
        address     = $_.address
        collections = $_.collections -join ", "
        totalTokens = $_.totalTokens
    }
}

# Save to JSON
$outPath = Join-Path $PSScriptRoot ".." "backend" "data" "collab-holders.json"
$result | ConvertTo-Json -Depth 3 | Out-File -FilePath $outPath -Encoding utf8
Write-Host "Saved to: $outPath"

# Also output just the addresses for easy WL import
$addrList = $allHolders.Keys | Sort-Object
$addrPath = Join-Path $PSScriptRoot ".." "backend" "data" "collab-holders-addresses.txt"
$addrList | Out-File -FilePath $addrPath -Encoding utf8
Write-Host "Address list saved to: $addrPath"
Write-Host "Address count: $($addrList.Count)"
