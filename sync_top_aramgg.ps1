param(
  [Parameter(Mandatory = $true)][string]$ApiKey,
  [int]$TopCount = 20
)

$ErrorActionPreference = 'Stop'
$base = 'https://data.dtodo.cn/api/v1/zh-CN'
$headers = @{ Authorization = "Bearer $ApiKey" }
function Get-ApiJson([string]$path) {
  (Invoke-WebRequest -Uri "$base/$path" -Headers $headers -UseBasicParsing -TimeoutSec 60).Content | ConvertFrom-Json
}

$config = Get-ApiJson 'config.json'
$champions = (Get-ApiJson 'champions.json').data |
  Where-Object { $_.stats -and $null -ne $_.stats.winRate } |
  Sort-Object { $_.stats.winRate } -Descending |
  Select-Object -First $TopCount
$legacy = Get-Content -Raw -Encoding UTF8 'all_heroes_data.json' | ConvertFrom-Json
$legacyById = @{}; $legacy | ForEach-Object { $legacyById[[string]$_.id] = $_ }

$result = foreach ($champion in $champions) {
  $detail = (Get-ApiJson "champions/$($champion.id).json").data
  $previous = $legacyById[[string]$champion.id]
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
  [PSCustomObject]@{
    id = $champion.id; slug = if ($previous) { $previous.slug } else { $champion.alias }
    name = if ($previous) { $previous.name } else { $champion.name }
    display_name = if ($previous) { $previous.display_name } else { "$($champion.name) ($($champion.alias))" }
    aliases = if ($previous) { $previous.aliases } else { @($champion.alias) }
    search_aliases = if ($previous) { $previous.search_aliases } else { $champion.alias }
    tier = $champion.stats.tier; base_win_rate = $baseWinRate; base_sample = $null
    augments = $augments; items = $items; data_patch = $config.gamePatch; data_version = $config.dataVersion
  }
}

$result | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 'latest_top_heroes.json'
Write-Output "Synced $($result.Count) heroes for Patch $($config.gamePatch) ($($config.dataVersion))."
