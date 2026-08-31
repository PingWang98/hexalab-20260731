# 🔮 HEXA LAB

海克斯大乱斗英雄与海克斯胜率查询站。

在线站点：[pingwang98.github.io/hexalab-20260731](https://pingwang98.github.io/hexalab-20260731/)

## 当前数据范围

- 数据版本：Patch 16.17 / 数据版本 16.17.2。
- 当前静态快照：胜率前 51 位英雄，按英雄基准胜率降序展示。
- 未完成当前详情同步的英雄不会在网站中显示，避免新旧数据混用。
- 页面只展示海克斯名称、等阶、组合胜率、相对英雄基准胜率的增益（ΔWR）和比赛样本。

## 数据获取方式

数据来自 [ARAMGG 数据 API 文档](https://data.dtodo.cn/api/v1/zh-CN/docs/cf-data-api.md)。同步流程如下：

1. 请求 `champions.json`，读取全部英雄的当前基准胜率并按胜率降序排序。
2. 对榜单中的英雄请求 `champions/{id}.json`，取得该英雄的海克斯组合统计。
3. 将 API 的海克斯名称、稀有度、组合胜率与比赛样本写入 `latest_top_heroes.json`。
4. `ΔWR` 在构建快照时计算：`海克斯组合胜率 − 该英雄基准胜率`。
5. 浏览器只加载 `latest_top_heroes.json`；旧的 `all_heroes_data.json` 不会进入当前列表。

`排名`是页面按 ΔWR 排序后的名次，并非 API 原始排名。页面已移除自定义 HexScore、装备推荐和 S1–S4 趋势，避免把非源字段当作统计数据。

## 手动同步

需要先在 ARAMGG 数据平台申请自己的 API Key。**请勿把 Key 写入脚本、JSON、README 或提交到 Git。**

在 PowerShell 中通过临时环境变量运行：

```powershell
$env:ARAMGG_API_KEY = '替换为你自己的 API Key'
.\sync_top_aramgg.ps1 -ApiKey $env:ARAMGG_API_KEY -TopCount 20
```

`sync_top_aramgg.ps1` 会从榜首开始重新生成指定数量英雄的快照。需要在已有快照基础上继续向后同步时，使用：

```powershell
.\sync_remaining_aramgg.ps1 -ApiKey $env:ARAMGG_API_KEY
```

该脚本会跳过已存在的英雄，按当前胜率继续请求；API 返回额度或速率限制时会停止，并保留成功写入的结果。额度规则和各接口消耗以 [官方 API 文档](https://data.dtodo.cn/api/v1/zh-CN/docs/cf-data-api.md) 为准。

同步完成后，检查 `latest_top_heroes.json`，再提交并推送静态文件即可发布。

## 仓库文件

- `latest_top_heroes.json`：网站实际展示的当前数据快照。
- `sync_top_aramgg.ps1`：从榜首生成一个指定数量的快照。
- `sync_remaining_aramgg.ps1`：在已有快照后继续增量同步。
- `all_heroes_data.json`：历史数据存档，不用于当前网站列表。
