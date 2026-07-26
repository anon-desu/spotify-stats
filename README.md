# 🎵 My Spotify Stats — 个人听歌数据可视化看板

![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?logo=tailwindcss)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Deployed-F38020?logo=cloudflare)
![AI Generated](https://img.shields.io/badge/Code_Generated_By-Gemini_3.6_Flash-8E75FF?logo=google-gemini)

一个纯前端、无后端服务器依赖的个人 Spotify 音乐品味分析仪表盘。基于 **OAuth 2.0 PKCE 安全模式** 直接调用 Spotify Web API，展示你最真实的听歌偏好、核心流派分布与热听榜单。

---

## ✨ 核心特性

- 🔒 **纯前端 PKCE 安全鉴权**：无需配置客户端 Secret，密钥不离本地，纯客户端直连 Spotify 官方 API。
- 📊 **Zipf 音乐自然衰减模型**：摒弃死板的等分算法，采用拟合人类真实听歌习惯的衰减分布与确定性微浮动。
- 🎨 **大厂暗黑设计语言**：针对移动端与桌面端深度调优，包含毛玻璃质感、交互式流派圆环图与等宽字体（Monospace）数据对齐。
- 🔍 **绝对固定排名与实时搜索**：搜索过滤时保持歌曲与歌手的真实绝对名次不变。
- ⚡ **无缝时间切片**：支持在 `近 4 周`、`近 6 个月` 与 `近 1 年` 间自由切换。

---

## 🚀 极简部署教程 (Fork + Cloudflare Pages)

无需写任何代码、无需本地安装环境，**直接 Fork 本项目即可一键部署到 Cloudflare Pages**，全程免费！

### 第一步：Fork 本仓库

点击本页面右上角的 **[Fork]** 按钮，将本项目直接复制（Fork）一份到你自己的 GitHub 账号下。

---

### 第二步：创建 Spotify 开发者应用（需要Premium会员）

1. 用浏览器打开 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) 并登录你的账号。
2. 点击 **Create App**：
   - **App Name**：`My Spotify Stats`
   - **App Description**：`Personal Spotify listening analytics dashboard.`
   - **Redirect URIs**：先填入 `https://test.bocchi.us.kg`（下一步部署完 Cloudflare 后替换）。
3. 保存后进入 App **Settings** 页面，复制保存你的 **`Client ID`**（客户 ID）。

---

### 第三步：在 Cloudflare Pages 完成构建

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/) 并登录。
2. 进入 **Workers 和 Pages** -> 点击 **创建应用程序 (Create application)** -> 选择 **Pages** 页签 -> 点击 **连接至 Git (Connect to Git)**。
3. 授权连接你的 GitHub 账号，并选择你刚才 Fork 的 `spotify-stats` 仓库，点击 **开始设置 (Begin setup)**。
4. **构建配置**：
   - **框架预设 (Framework preset)**：选择 **`无`**（或保留默认）。
   - **构建命令 (Build command)**：填入 `npm run build`
   - **构建输出目录 (Build output directory)**：填入 `dist`
5. **配置环境变量（关键）**：
   - 展开下方 **环境变量（高级） / Environment variables**。
   - 添加变量名：`VITE_SPOTIFY_CLIENT_ID`
   - 变量值：粘贴第二步获取的 Spotify **`Client ID`**。
6. 点击 **保存并部署 (Save and Deploy)**。Cloudflare 会在云端自动安装依赖并完成打包！

---

### 第四步：配置回调地址 (Redirect URI)

1. 部署完成后，Cloudflare 会生成一个默认网址（如 `https://spotify-stats.pages.dev`）。
2. 回到 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) -> 点击你的 App -> **Settings**。
3. 在 **Redirect URIs** 中点击 **Add**，把 Cloudflare 生成的网址替换进去并点击最下方的 **Save** 保存。

---

### 🌐 第五步：推荐绑定自定义域名 (Custom Domain)

为了避免 `pages.dev` 默认域名遭受网络污染，获得更稳定的访问体验与更优雅的网址，**强烈推荐绑定你自己的自定义域名**！

1. 在 Cloudflare Pages 项目控制台中，切换到 **自定义域 (Custom domains)** 选项卡。
2. 点击 **设置自定义域 (Set up a custom domain)**。
3. 输入你的二级域名（例如：`spotify.yourdomain.com`），按照提示自动完成 DNS 解析绑定。
4. **非常重要**：绑定自定义域名后，请再次回到 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)，将你的自定义域名（如 `https://spotify.yourdomain.com`）添加到 **Redirect URIs** 白名单中并保存！

---

## 🤖 项目声明 (Disclaimer)

本项目（包含 `src/App.jsx`、`src/spotify.js`、`vite.config.js` 等全部核心源代码、算法逻辑、数据处理以及 UI/UX 设计与样式适配）**全量由 Google Gemini 3.6 Flash 生成**。

- **算法与逻辑指导**：Gemini 3.6 Flash
- **界面设计与优化**：Gemini 3.6 Flash
- **API 兼容与调试**：Gemini 3.6 Flash

*本源码仅供学习交流与个人数据可视化使用，请勿用于商业用途。*
