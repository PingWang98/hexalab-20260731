# HEXA LAB

海克斯大乱斗英雄与海克斯胜率查询站：[在线访问](https://pingwang98.github.io/hexalab-20260731/)。

当前数据来自 [AramHex 数据](https://github.com/czgreat/aramhex-data) 的国服常规规则，版本、样本时间及快照时间显示在页面顶部。只包含采集到的对局；海克斯胜率按结算时持有统计，胜率差是与英雄基准胜率的差值，不能解释为因果收益。小样本结果波动较大。当前数据源不提供装备统计。

数据许可：[CC BY-NC 4.0](https://github.com/czgreat/aramhex-data/blob/main/LICENSE)，需署名，禁止商业用途。

## 更新数据

在项目同级目录克隆或更新数据仓库，然后运行：

```bash
git clone https://github.com/czgreat/aramhex-data.git
cd hexalab-20260731
node sync_aramhex.mjs ../aramhex-data
```

已有数据仓库时先在该仓库执行 `git pull`。脚本读取 `latest.json` 指向的最新常规数据，校验 SHA-256，并生成 `latest_top_heroes.json` 和 `data_meta.json`。提交并推送网站仓库后由 GitHub Pages 发布。
