param(
  [Parameter(Mandatory = $true)][string]$ApiKey
)

$ErrorActionPreference = 'Stop'
$base = 'https://data.dtodo.cn/api/v1/zh-CN'
$headers = @{ Authorization = "Bearer $ApiKey" }

function Get-ApiJson([string]$path) {
  (Invoke-WebRequest -Uri "$base/$path" -Headers $headers -UseBasicParsing -TimeoutSec 60).Content | ConvertFrom-Json
}

function Save-Snapshot([hashtable]$byId, $rankedChampions) {
  $snapshot = @($rankedChampions | ForEach-Object { $byId[[string]$_.id] } | Where-Object { $_ })
  $snapshot | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 'latest_top_heroes.json'
  return $snapshot.Count
}

# Keep the existing current snapshot, then spend quota only on the next ranks.
$existing = @(Get-Content -Raw -Encoding UTF8 'latest_top_heroes.json' | ConvertFrom-Json)
$byId = @{}
$existing | ForEach-Object { $byId[[string]$_.id] = $_ }

$legacy = Get-Content -Raw -Encoding UTF8 'all_heroes_data.json' | ConvertFrom-Json
$legacyById = @{}
$legacy | ForEach-Object { $legacyById[[string]$_.id] = $_ }

$rankedChampions = (Get-ApiJson 'champions.json').data |
  Where-Object { $_.stats -and $null -ne $_.stats.winRate } |
  Sort-Object { $_.stats.winRate } -Descending

$syncedNow = 0
foreach ($champion in $rankedChampions) {
  $id = [string]$champion.id
  if ($byId.ContainsKey($id)) { continue }

  try {
    $detail = (Get-ApiJson "champions/$id.json").data
  } catch {
    # An exhausted daily quota is expected. Preserve every completed record.
    Write-Warning "Stopped: $($_.Exception.Message)"
    break
  }

  $previous = $legacyById[$id]
  $baseWinRate = [math]::Round($champion.stats.winRate * 100, 2)
  $augments = @($detail.augments | ForEach-Object {
    $stats = $_.stats
    $winRate = if ($null -eq $stats.winRate) { $null } else { [math]::Round($stats.winRate * 100, 2) }
    $games = if ($null -eq $stats.games) { 0 } else { [int]$stats.games }
    [PSCustomObject]@{
      slug = [string]$_.id; name = $_.name; tier = $_.rarityDisplayName
      hexscore = if ($stats.rank -and $stats.total) { [math]::Round((1 - (($stats.rank - 1) / $stats.total)) * 100, 1) } else { 0 }
      hex_label = if ($stats.rank) { "推荐 #$($stats.rank)/$($stats.total)" } else { '暂无统计' }
      win_rate = $winRate; sample = $games
      delta = if ($null -eq $winRate) { 0 } else { [math]::Round($winRate - $baseWinRate, 2) }
      stage_ranks = $null; timing_tag = ''; timing_class = ''; source_rank = $stats.rank
    }
  })
  $items = @($detail.builds | ForEach-Object { $_.coreItems } | ForEach-Object {
    $winRate = [math]::Round($_.winRate * 100, 2)
    [PSCustomObject]@{
      name = ($_.items.name -join ' · '); hexscore = [math]::Round($winRate, 1)
      win_rate = $winRate; sample = [int]$_.games; delta = [math]::Round($winRate - $baseWinRate, 2)
    }
  } | Group-Object name | ForEach-Object { $_.Group | Sort-Object sample -Descending | Select-Object -First 1 })
  $byId[$id] = [PSCustomObject]@{
    id = $champion.id; slug = if ($previous) { $previous.slug } else { $champion.alias }
    name = if ($previous) { $previous.name } else { $champion.name }
    display_name = if ($previous) { $previous.display_name } else { "$($champion.name) ($($champion.alias))" }
    aliases = if ($previous) { $previous.aliases } else { @($champion.alias) }
    search_aliases = if ($previous) { $previous.search_aliases } else { $champion.alias }
    tier = $champion.stats.tier; base_win_rate = $baseWinRate; base_sample = $null
    augments = $augments; items = $items; data_patch = '16.17'; data_version = '16.17.2'
  }
  $syncedNow++
  if ($syncedNow % 5 -eq 0) { [void](Save-Snapshot $byId $rankedChampions) }
  Write-Output "Synced: $($champion.name) ($baseWinRate%)"
}

$total = Save-Snapshot $byId $rankedChampions
Write-Output "Snapshot complete: $total current heroes; $syncedNow added this run."
