<div align="center">
  <img src="https://eat.ayakacloud.cn/logo.png" width="96" alt="Ayaka Music Logo" />
  <h1>Ayaka Music</h1>
  <p>A private music player and admin system built with Vue, Express, and MySQL.</p>

  <p>
    <a href="README.md">中文</a>
    ·
    <a href="http://localhost:5173">Local Player</a>
    ·
    <a href="http://localhost:5173/admin">Admin Panel</a>
  </p>

  <p>
    <img alt="Vue 3" src="https://img.shields.io/badge/Vue-3-42b883?style=for-the-badge&logo=vuedotjs&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646cff?style=for-the-badge&logo=vite&logoColor=white" />
    <img alt="Express" src="https://img.shields.io/badge/Express-4-333333?style=for-the-badge&logo=express&logoColor=white" />
    <img alt="Prisma" src="https://img.shields.io/badge/Prisma-5-2d3748?style=for-the-badge&logo=prisma&logoColor=white" />
    <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8-4479a1?style=for-the-badge&logo=mysql&logoColor=white" />
    <img alt="MIT" src="https://img.shields.io/badge/License-MIT-black?style=for-the-badge" />
  </p>

  <p>Online music resolver · WangYY QR login · QQ/WangYY import · lyric translation/romanization · admin upload · self-hosting</p>
</div>

## Overview

Ayaka Music is a personal music site. The frontend is an immersive HeoMusic-inspired player, and the `/admin` page lets you upload local audio, resolve online music, log in to WangYY, import playlist tracks, and store metadata in MySQL.

This project does not ship third-party music assets. Online resolving, lyrics, covers, and playable URLs depend on the corresponding platform APIs and your account permissions.

## Features

- Player UI with cover art, lyrics, playlist, progress bar, volume control, and playback mode switcher.
- Playback modes: list loop, stop after list ends, single repeat, and shuffle.
- Lyrics: timed scrolling, click-to-seek, foreign-language Chinese translation, and Japanese romanization display.
- Admin login with fixed username `admin`; the password is stored in MySQL as a salted hash.
- Local audio upload with embedded tag reading and metadata lookup.
- Online resolving for WangYY and QQ Music songs, playlists, albums, and artists.
- WangYY QR login in the admin panel for playlist access and restricted playable URLs.
- Batch management: paginated playlist selection, slow one-click metadata refresh, and list refresh feedback.
- MySQL storage for songs, lyrics, translated lyrics, romanized lyrics, covers, and source metadata.

## Stack

- Frontend: Vue 3, Vite, lucide-vue-next
- Backend: Express, Multer, cookie-parser, NeteaseCloudMusicApi
- Database: MySQL 8, Prisma
- Metadata: music-metadata, WangYY APIs, QQ Music APIs

## Project Structure

```text
Ayaka_Music/
  apps/
    api/              # Express API
    web/              # Vue/Vite frontend
  prisma/
    schema.prisma     # MySQL schema
  storage/
    audio/            # uploaded audio, ignored by git
    covers/           # local covers, ignored by git
  docker-compose.yml  # MySQL dev container
```

## Quick Start

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env
```

If you use the MySQL service from `docker-compose.yml`, update `DATABASE_URL` in `.env`:

```env
DATABASE_URL="mysql://ayaka:ayaka_password@localhost:3306/ayaka_music"
```

Start MySQL:

```bash
docker compose up -d
```

Sync the database schema:

```bash
npx prisma db push
npm run prisma:generate
```

Start the dev servers:

```bash
npm run dev
```

URLs:

- Player: `http://localhost:5173`
- Admin: `http://localhost:5173/admin`
- API: `http://localhost:3000`

## Environment Variables

```env
DATABASE_URL="mysql://root:password@localhost:3306/ayaka_music"
PORT=3000
WEB_ORIGIN="http://localhost:5173"
SESSION_SECRET="change-this-session-secret"
NETEASE_COOKIE=""
PUBLIC_BASE_URL="http://localhost:3000"
```

Notes:

- `DATABASE_URL`: MySQL connection string.
- `SESSION_SECRET`: cookie signing secret. Change it in production.
- `NETEASE_COOKIE`: optional. The admin QR login flow is recommended.
- `PUBLIC_BASE_URL`: public backend URL used to generate local upload URLs.

## Admin Workflow

Open `/admin` and log in with username `admin`. On first startup, the database admin password defaults to `admin123`; change it in the admin settings after logging in.

Typical flow:

1. Log in to the admin panel.
2. Scan the QR code in the WangYY login section.
3. Refresh and select your WangYY playlists.
4. Select tracks from paginated results, 30 songs per page.
5. Import selected songs and refresh metadata if needed.

The one-click metadata refresh runs sequentially with a delay between songs to reduce the chance of triggering platform rate limits.

## Lyric Display

The project stores three lyric variants when available:

- `lyrics`: original lyrics
- `translatedLyrics`: Chinese translation
- `romanizedLyrics`: romanized lyrics

The frontend automatically shows a lyric mode button when the current song is not Chinese:

- Chinese songs: no mode button.
- Other foreign-language songs: original only, translation only, or original/Chinese dual lines.
- Japanese songs: Japanese/Chinese and Japanese/romanization modes when available.

## Privacy and Git

The following files are ignored by `.gitignore` and should not be committed:

- `.env`
- `storage/netease-session.json`
- `storage/audio/*`
- `storage/covers/*`
- `node_modules/`
- `apps/web/dist/`

`storage/audio/.gitkeep` and `storage/covers/.gitkeep` are safe placeholder files for empty directories.

## Scripts

```bash
npm run dev              # start API and Web together
npm run dev:api          # start backend only
npm run dev:web          # start frontend only
npm run build            # build frontend
npm run start            # start API in production mode
npm run prisma:generate  # generate Prisma Client
npx prisma db push       # sync database schema
```

## License

[MIT](LICENSE)
