import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { parseFile } from 'music-metadata';
import { prisma } from './db.js';
import { getAdminSession, getAdminSettings, loginAdmin, logoutAdmin, requireAdmin, updateAdminSettings } from './auth.js';
import { config, audioDir, storageDir } from './config.js';
import { uploadAudio } from './uploads.js';
import { enrichSongMetadata } from './metadata.js';
import {
  getNeteasePlayableUrl,
  getNeteasePlaylistSongs,
  getNeteaseUserPlaylists,
  hydrateOnlineSong,
  pickOnlineSongs,
  resolveOnlineMusic
} from './onlineMusic.js';
import {
  checkNeteaseQrLogin,
  clearNeteaseSession,
  createNeteaseQrLogin,
  getNeteaseAccountStatus,
  getNeteaseCookie
} from './neteaseAuth.js';

fs.mkdirSync(audioDir, { recursive: true });

const app = express();

app.use(cors({ origin: config.webOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/storage', express.static(storageDir));

function toPublicUrl(filePath) {
  const relative = path.relative(storageDir, filePath).replaceAll(path.sep, '/');
  return `${config.publicBaseUrl}/storage/${relative}`;
}

function mapSong(song) {
  return {
    ...song,
    coverUrl: song.coverUrl || null,
    audioUrl: song.audioUrl.startsWith('http') ? song.audioUrl : `${config.publicBaseUrl}${song.audioUrl}`
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/admin/login', loginAdmin);
app.post('/api/admin/logout', logoutAdmin);
app.get('/api/admin/session', getAdminSession);
app.get('/api/admin/settings', requireAdmin, getAdminSettings);
app.put('/api/admin/settings', requireAdmin, updateAdminSettings);

app.get('/api/admin/netease/status', requireAdmin, async (_req, res, next) => {
  try {
    res.json(await getNeteaseAccountStatus());
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/netease/qr', requireAdmin, async (_req, res, next) => {
  try {
    res.json(await createNeteaseQrLogin());
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/netease/qr/:key', requireAdmin, async (req, res, next) => {
  try {
    res.json(await checkNeteaseQrLogin(req.params.key));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/netease/session', requireAdmin, (_req, res) => {
  clearNeteaseSession();
  res.json({ ok: true });
});

app.get('/api/admin/netease/playlists', requireAdmin, async (_req, res, next) => {
  try {
    const status = await getNeteaseAccountStatus();
    if (!status.loggedIn || !status.profile?.userId) {
      return res.status(401).json({ message: '请先登录网易云' });
    }
    const playlists = await getNeteaseUserPlaylists(status.profile.userId, { cookie: getNeteaseCookie() || config.neteaseCookie });
    res.json({ playlists });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/netease/playlists/:id/songs', requireAdmin, async (req, res, next) => {
  try {
    const status = await getNeteaseAccountStatus();
    if (!status.loggedIn) return res.status(401).json({ message: '请先登录网易云' });
    const songs = await getNeteasePlaylistSongs(req.params.id, { cookie: getNeteaseCookie() || config.neteaseCookie });
    res.json({ songs });
  } catch (error) {
    next(error);
  }
});

app.get('/api/songs', async (_req, res, next) => {
  try {
    const songs = await prisma.song.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(songs.map(mapSong));
  } catch (error) {
    next(error);
  }
});

app.get('/api/songs/:id', async (req, res, next) => {
  try {
    const song = await prisma.song.findUnique({ where: { id: Number(req.params.id) } });
    if (!song) return res.status(404).json({ message: 'Song not found' });
    res.json(mapSong(song));
  } catch (error) {
    next(error);
  }
});

app.get('/api/audio/netease/:id', async (req, res, next) => {
  try {
    const playable = await getNeteasePlayableUrl(req.params.id, { cookie: getNeteaseCookie() || config.neteaseCookie });
    if (!playable?.url) {
      return res.status(404).json({
        message: config.neteaseCookie
          ? '当前网易云账号无权播放该歌曲或歌曲不可用'
          : '歌曲不可用；如为会员歌曲，请在 .env 配置 NETEASE_COOKIE'
      });
    }

    res.redirect(302, playable.url.replace(/^https:/, 'http:'));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/songs', requireAdmin, uploadAudio.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Audio file is required' });

    const parsed = await parseFile(req.file.path).catch(() => null);
    const common = parsed?.common || {};
    const format = parsed?.format || {};

    const fallback = {
      title: common.title || path.parse(req.file.originalname).name,
      artist: common.artist || common.albumartist || null,
      album: common.album || null,
      duration: format.duration ? Math.round(format.duration) : null
    };

    const metadata = await enrichSongMetadata({
      title: req.body.title || fallback.title,
      artist: req.body.artist || fallback.artist,
      fallback
    });

    const song = await prisma.song.create({
      data: {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        lyricist: metadata.lyricist,
        composer: metadata.composer,
        arranger: metadata.arranger,
        lyrics: metadata.lyrics,
        translatedLyrics: metadata.translatedLyrics,
        romanizedLyrics: metadata.romanizedLyrics,
        coverUrl: metadata.coverUrl,
        audioUrl: toPublicUrl(req.file.path),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        duration: fallback.duration,
        source: metadata.source,
        sourceSongId: metadata.sourceSongId,
        metadataStatus: metadata.metadataStatus
      }
    });

    res.status(201).json(mapSong(song));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/songs/:id/refresh', requireAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.song.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ message: 'Song not found' });

    if (['netease', 'tencent'].includes(existing.source)) {
      const hydrated = await hydrateOnlineSong(existing);
      const song = await prisma.song.update({
        where: { id: existing.id },
        data: {
          title: hydrated.title,
          artist: hydrated.artist,
          album: hydrated.album,
          lyricist: hydrated.lyricist,
          composer: hydrated.composer,
          arranger: hydrated.arranger,
          lyrics: hydrated.lyrics,
          translatedLyrics: hydrated.translatedLyrics,
          romanizedLyrics: hydrated.romanizedLyrics,
          coverUrl: hydrated.coverUrl,
          audioUrl: hydrated.audioUrl,
          duration: hydrated.duration,
          metadataStatus: hydrated.lyrics ? 'matched' : 'not_found'
        }
      });

      return res.json(mapSong(song));
    }

    const metadata = await enrichSongMetadata({
      title: req.body.title || existing.title,
      artist: req.body.artist || existing.artist,
      fallback: existing
    });

    const song = await prisma.song.update({
      where: { id: existing.id },
      data: {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        lyricist: metadata.lyricist,
        composer: metadata.composer,
        arranger: metadata.arranger,
        lyrics: metadata.lyrics,
        translatedLyrics: metadata.translatedLyrics,
        romanizedLyrics: metadata.romanizedLyrics,
        coverUrl: metadata.coverUrl,
        source: metadata.source,
        sourceSongId: metadata.sourceSongId,
        metadataStatus: metadata.metadataStatus
      }
    });

    res.json(mapSong(song));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/online/resolve', requireAdmin, async (req, res, next) => {
  try {
    const resolved = await resolveOnlineMusic(req.body.input, {
      source: req.body.source,
      type: req.body.type,
      id: req.body.id
    });
    res.json(resolved);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/online/import', requireAdmin, async (req, res, next) => {
  try {
    const resolved = await resolveOnlineMusic(req.body.input, {
      source: req.body.source,
      type: req.body.type,
      id: req.body.id
    });
    const selectedSongs = pickOnlineSongs(resolved, req.body.songIds).slice(0, 200);
    const imported = [];
    const skipped = [];

    for (const selected of selectedSongs) {
      const existing = await prisma.song.findFirst({
        where: {
          source: selected.source,
          sourceSongId: selected.sourceSongId
        }
      });

      if (existing) {
        skipped.push(mapSong(existing));
        continue;
      }

      const hydrated = await hydrateOnlineSong(selected);
      const song = await prisma.song.create({
        data: {
          title: hydrated.title,
          artist: hydrated.artist,
          album: hydrated.album,
          lyricist: hydrated.lyricist,
          composer: hydrated.composer,
          arranger: hydrated.arranger,
          lyrics: hydrated.lyrics,
          translatedLyrics: hydrated.translatedLyrics,
          romanizedLyrics: hydrated.romanizedLyrics,
          coverUrl: hydrated.coverUrl,
          audioUrl: hydrated.audioUrl,
          originalName: hydrated.originalName,
          mimeType: hydrated.mimeType,
          fileSize: hydrated.fileSize,
          duration: hydrated.duration,
          source: hydrated.source,
          sourceSongId: hydrated.sourceSongId,
          metadataStatus: hydrated.metadataStatus
        }
      });
      imported.push(mapSong(song));
    }

    res.status(201).json({
      provider: resolved.provider,
      type: resolved.type,
      imported,
      skipped
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/songs/:id', requireAdmin, async (req, res, next) => {
  try {
    const song = await prisma.song.delete({ where: { id: Number(req.params.id) } });
    res.json(mapSong(song));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: error.message || 'Server error' });
});

app.listen(config.port, () => {
  console.log(`Ayaka Music API listening on http://localhost:${config.port}`);
});
