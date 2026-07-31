# 🔮 HEXA LAB - 海克斯大乱斗 Patch 16.14 权威数据站 (GitHub Pages 静态网页)

基于英雄联盟 2026 最新版本 **Hexdata 官方真实比赛数据库** 构建的无后端纯静态网页工具。

## 🌟 核心特性
- **全量英雄与海克斯覆盖**：包含 173 位英雄、206 种强化符文与全套推荐装备。
- **支持常用别名搜索**：支持 `寒冰`、`男枪`、`劲夫`、`TF`、`大嘴`、`奶妈`、`狗头`、`老鼠`、`猫咪` 等全网别名实时联想搜索。
- **S1-S4 阶段胜率排名折线图**：自带 SVG 矢量折线图展示阶段胜率走势。
- **零后端依赖**：直接发布至 **GitHub Pages** 即可在线免登录访问。

---

## 🚀 部署到 GitHub Pages 指南 (3 步开启免费在线网站)

### 方法 1：在 GitHub 网页拖拽上传 (最简单)
1. 在 GitHub 创建一个新仓库，命名为 `hexalab-aram`；
2. 将本目录下的所有文件 (`index.html`, `style.css`, `app.js`, `all_heroes_data.json`, `.nojekyll`) 拖拽上传至仓库 `main` 分支；
3. 进入仓库 **Settings -> Pages**：
   - **Branch**: 选择 `main` / `/(root)`
   - 点击 **Save** 保存；
4. 等待 1 分钟后，即可通过 `https://<您的GitHub用户名>.github.io/hexalab-aram/` 访问免费网页！

---

### 方法 2：使用 Git 命令行推送到 GitHub
```bash
git init
git add .
git commit -m "Deploy HEXA LAB to GitHub Pages"
git branch -M main
git remote add origin https://github.com/<您的GitHub用户名>/hexalab-aram.git
git push -u origin main
```
在 GitHub 仓库的 **Settings -> Pages** 选择 `main` 分支部署即可！
