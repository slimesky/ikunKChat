# ikunKChat 🏀

一个轻量、快速、优雅的聊天网页UI，专为低成本私有化部署而设计。

<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FWing900%2FikunKChat">
  <img src="https://vercel.com/button" alt="Deploy with Vercel" width="120">
</a>

---

## ✨ 在线体验

-   **演示地址:** [https://ikun-k-chat-demo.vercel.app/](https://ikun-k-chat-demo.vercel.app/)
-   **访问密码:** `ikuninlinuxdo`

## 🚀 部署

### 1. Vercel 一键部署 (推荐)

点击本文档顶部的 "Deploy with Vercel" 按钮，根据提示填入下方的环境变量即可。

### 2. Docker 部署

⚠️ **重要提示：不建议使用 Hugging Face Spaces 部署，因为可能导致静态资源（图片文件）损坏。**

```bash
# 克隆仓库
git clone https://github.com/Wing900/ikunKChat.git
cd ikunKChat

# 使用 docker-compose 部署
docker-compose up -d

# 访问 http://localhost:8080
```

### 3. 本地部署

**克隆仓库**

```bash
git clone https://github.com/Wing900/ikunKChat.git
cd ikunKChat
```

**安装依赖**

```bash
npm install
```

**配置环境变量**
复制 `.env.example` 文件为 `.env`，并参考下方说明进行配置。

```bash
cp .env.example .env
```

**启动项目**

```bash
npm run dev
```

---

## ⚙️ 环境变量

本仓库已经内置默认的 Gemini API 配置，开箱即用，无需再手动设置访问密码或额外的模型服务商信息。如果你在本地或 Vercel 中提供了同名环境变量，会自动覆盖默认值。

```bash
# 主要 Gemini 配置（可选，自定义时才需要覆盖）
# GEMINI_API_KEY
# VITE_API_BASE_URL

# 固定的模型列表（自定义时可覆盖）
# VITE_GEMINI_MODELS

# 专用标题生成功能（默认同样使用内置配置）
# VITE_TITLE_API_URL
# VITE_TITLE_MODEL_NAME
# VITE_TITLE_API_KEY
```



## 🙏 致谢

-   本项目基于 [KChat](https://github.com/KuekHaoYang/KChat) 二次开发。
-   感谢 Linux.do 社区。