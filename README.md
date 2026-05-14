<div align="center">
  <img src="https://eat.ayakacloud.cn/logo.png" width="96" alt="Ayaka Music Logo" />
  <h1>Ayaka Music</h1>
  <p>一个 Vue + Express + MySQL 的私有音乐播放器和后台管理系统。</p>

  <p>
    <a href="README.en.md">English</a>
    ·
    <a href="http://localhost:5173">本地前台</a>
    ·
    <a href="http://localhost:5173/admin">后台管理</a>
  </p>

  <p>
    <img alt="Vue 3" src="https://img.shields.io/badge/Vue-3-42b883?style=for-the-badge&logo=vuedotjs&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646cff?style=for-the-badge&logo=vite&logoColor=white" />
    <img alt="Express" src="https://img.shields.io/badge/Express-4-333333?style=for-the-badge&logo=express&logoColor=white" />
    <img alt="Prisma" src="https://img.shields.io/badge/Prisma-5-2d3748?style=for-the-badge&logo=prisma&logoColor=white" />
    <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8-4479a1?style=for-the-badge&logo=mysql&logoColor=white" />
    <img alt="MIT" src="https://img.shields.io/badge/License-MIT-black?style=for-the-badge" />
  </p>

  <p>在线音乐解析 · 网YY扫码登录 · QQ/网YY导入 · 歌词翻译/罗马音对照 · 后台上传 · 私有化部署</p>
</div>

## 简介

Ayaka Music 是一个面向个人使用的音乐站点。前台是仿 HeoMusic 风格的沉浸式播放器，后台提供 `/admin` 管理页面，用于上传本地音频、解析在线歌曲、登录网YY账号、导入歌单歌曲并写入 MySQL。

项目不会内置任何第三方音乐资源。在线解析、歌词、封面和播放地址依赖对应平台接口和你的账号权限。

## 功能

- 前台播放器：封面、歌词、播放列表、进度条、音量条、播放模式切换。
- 播放模式：列表循环、列表播完暂停、单曲循环、随机播放。
- 歌词体验：时间轴滚动、点击歌词跳转、外语歌词中文翻译对照、日文罗马音对照。
- 后台登录：固定管理名 `admin`，密码以加盐哈希保存到 MySQL，首次默认密码为 `admin123`。
- 本地上传：上传音频后自动读取标签，并搜索歌词、歌手、专辑、封面等元数据。
- 在线解析：支持网YY、QQ 音乐的单曲、歌单、专辑和歌手链接。
- 网YY扫码：后台扫码登录后保存登录态，用于读取收藏歌单和获取受限歌曲播放地址。
- 批量操作：后台歌单分页选择、一键慢速刷新元数据、刷新列表状态提示。
- 数据库存储：歌曲、歌词、翻译歌词、罗马音歌词、封面、来源信息保存到 MySQL。

## 技术栈

- 前端：Vue 3、Vite、lucide-vue-next
- 后端：Express、Multer、cookie-parser、NeteaseCloudMusicApi
- 数据库：MySQL 8、Prisma
- 元数据：music-metadata、网YY接口、QQ 音乐接口

## 项目结构

```text
Ayaka_Music/
  apps/
    api/              # Express API
    web/              # Vue/Vite 前端
  prisma/
    schema.prisma     # MySQL 数据模型
  storage/
    audio/            # 本地上传音频，已被 gitignore 忽略
    covers/           # 本地封面，已被 gitignore 忽略
  docker-compose.yml  # MySQL 开发容器
```

## 快速开始

安装依赖：

```bash
npm install
```

复制环境变量：

```bash
cp .env.example .env
```

如果使用 `docker-compose.yml` 里的 MySQL，建议把 `.env` 的数据库地址改成：

```env
DATABASE_URL="mysql://ayaka:ayaka_password@localhost:3306/ayaka_music"
```

启动 MySQL：

```bash
docker compose up -d
```

同步数据库结构：

```bash
npx prisma db push
npm run prisma:generate
```

启动开发环境：

```bash
npm run dev
```

访问地址：

- 前台：`http://localhost:5173`
- 后台：`http://localhost:5173/admin`
- API：`http://localhost:3000`

## 环境变量

```env
DATABASE_URL="mysql://root:password@localhost:3306/ayaka_music"
PORT=3000
WEB_ORIGIN="http://localhost:5173"
SESSION_SECRET="change-this-session-secret"
NETEASE_COOKIE=""
PUBLIC_BASE_URL="http://localhost:3000"
```

说明：

- `DATABASE_URL`：MySQL 连接地址。
- `SESSION_SECRET`：后台登录 cookie 签名密钥，生产环境必须修改。
- `NETEASE_COOKIE`：可选。当前项目更推荐使用后台扫码登录。
- `PUBLIC_BASE_URL`：后端公开访问地址，用于生成本地上传文件 URL。

## 后台使用

打开 `/admin` 后使用管理名 `admin` 登录。首次启动时会在数据库中创建默认密码 `admin123`，登录后请在后台设置中修改密码。

常用流程：

1. 登录后台。
2. 在“网YY登录”中扫码登录。
3. 刷新并选择你的网YY歌单。
4. 每页 30 首，勾选需要导入的歌曲。
5. 导入后可在歌曲列表中刷新元数据。

一键刷新元数据会逐首慢速处理，每首之间有延迟，避免请求过快触发平台风控。

## 歌词对照

项目会尽量保存三份歌词：

- `lyrics`：原文歌词
- `translatedLyrics`：中文翻译歌词
- `romanizedLyrics`：罗马音歌词

前台会根据当前歌曲自动显示歌词模式按钮：

- 中文歌：不显示模式按钮。
- 外语歌：可切换仅原文、仅译文、原文/中文对照。
- 日文歌：如果有罗马音，可额外切换日文/罗马音对照。

## 隐私和 Git

以下文件已在 `.gitignore` 中忽略，不会提交到仓库：

- `.env`
- `storage/netease-session.json`
- `storage/audio/*`
- `storage/covers/*`
- `node_modules/`
- `apps/web/dist/`

`storage/audio/.gitkeep` 和 `storage/covers/.gitkeep` 只是目录占位文件，可以提交。

## 常用命令

```bash
npm run dev              # 同时启动 API 和 Web
npm run dev:api          # 只启动后端
npm run dev:web          # 只启动前端
npm run build            # 构建前端
npm run start            # 生产方式启动 API
npm run prisma:generate  # 生成 Prisma Client
npx prisma db push       # 同步数据库结构
```

## License

[MIT](LICENSE)
