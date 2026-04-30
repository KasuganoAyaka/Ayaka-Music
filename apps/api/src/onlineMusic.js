const NETEASE_API = 'https://music.163.com/api';
const QQ_API = 'https://c.y.qq.com';

const providerLabels = {
  netease: '网易云音乐',
  tencent: 'QQ 音乐'
};

const typeLabels = {
  song: '单曲',
  playlist: '歌单',
  album: '专辑',
  artist: '歌手'
};

function compact(value) {
  return String(value || '').trim();
}

function normalize(value) {
  return compact(value)
    .toLowerCase()
    .replace(/[《》「」『』()[\]\s._\-·・]/g, '');
}

function firstArtist(value) {
  return compact(value).split(/\s*\/\s*|\s*,\s*|、/)[0] || '';
}

function uniqueSongs(songs) {
  const seen = new Set();
  return songs.filter((song) => {
    const key = `${song.source}:${song.sourceSongId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripLyrics(raw) {
  if (!raw) return null;
  return raw
    .split('\n')
    .map((line) => line.replace(/\[[^\]]+\]/g, '').trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeLyricBundle(raw) {
  if (!raw) return { raw: null, plain: null };
  return {
    raw,
    plain: stripLyrics(raw)
  };
}

function parseCredits(raw) {
  const lines = stripLyrics(raw)?.split('\n') || [];
  const credit = {};

  for (const line of lines.slice(0, 12)) {
    const [label, ...rest] = line.split(/[:：]/);
    const value = rest.join(':').trim();
    if (!value) continue;
    if (/^词|作词|填词/.test(label)) credit.lyricist = value;
    if (/^曲|作曲/.test(label)) credit.composer = value;
    if (/^编曲/.test(label)) credit.arranger = value;
  }

  return credit;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json, text/plain, */*',
      referer: options.referer || 'https://y.qq.com/',
      'user-agent': 'Mozilla/5.0 AyakaMusic/0.1',
      ...(options.headers || {})
    }
  });

  if (!response.ok) throw new Error(`online music request failed: ${response.status}`);
  const text = await response.text();
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith('{') || trimmed.startsWith('[')
    ? trimmed
    : trimmed.replace(/^[\w$]+\(([\s\S]*)\);?$/, '$1');
  return JSON.parse(jsonText);
}

async function fetchNeteaseJson(path, options = {}) {
  return fetchJson(`${NETEASE_API}${path}`, {
    ...options,
    referer: 'https://music.163.com/',
    headers: {
      cookie: options.cookie || '',
      ...(options.headers || {})
    }
  });
}

function parseOnlineInput(input, fallback = {}) {
  const raw = compact(input || fallback.id);
  const source = fallback.source || fallback.server;
  const type = fallback.type || 'song';

  const rules = [
    [/music\.163\.com.*song.*id=(\d+)/i, 'netease', 'song'],
    [/music\.163\.com.*album.*id=(\d+)/i, 'netease', 'album'],
    [/music\.163\.com.*artist.*id=(\d+)/i, 'netease', 'artist'],
    [/music\.163\.com.*playlist.*id=(\d+)/i, 'netease', 'playlist'],
    [/music\.163\.com.*discover\/toplist.*id=(\d+)/i, 'netease', 'playlist'],
    [/y\.qq\.com.*song\/(\w+)\.html/i, 'tencent', 'song'],
    [/y\.qq\.com.*album\/(\w+)\.html/i, 'tencent', 'album'],
    [/y\.qq\.com.*singer\/(\w+)\.html/i, 'tencent', 'artist'],
    [/y\.qq\.com.*playsquare\/(\w+)\.html/i, 'tencent', 'playlist'],
    [/y\.qq\.com.*playlist\/(\w+)\.html/i, 'tencent', 'playlist'],
    [/songmid=(\w+)/i, 'tencent', 'song'],
    [/[?&]id=(\d+)/i, source || 'netease', type]
  ];

  for (const [pattern, provider, matchedType] of rules) {
    const match = pattern.exec(raw);
    if (match) {
      return { provider, type: matchedType, id: match[1], input: raw };
    }
  }

  if (/^\d+$/.test(raw)) return { provider: source || 'netease', type, id: raw, input: raw };
  if (/^\w+$/.test(raw)) return { provider: source || 'tencent', type, id: raw, input: raw };

  throw new Error('无法识别链接或 ID');
}

export function formatNeteaseSong(item) {
  const album = item.al || item.album || {};
  const artists = item.ar || item.artists || [];
  return {
    title: item.name,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || null,
    album: album.name || null,
    coverUrl: album.picUrl || null,
    audioUrl: `/api/audio/netease/${item.id}`,
    originalName: `netease:${item.id}`,
    source: 'netease',
    sourceSongId: String(item.id),
    duration: item.dt ? Math.round(item.dt / 1000) : item.duration ? Math.round(item.duration / 1000) : null,
    metadataStatus: 'matched'
  };
}

function formatTencentSong(item) {
  const data = item.musicData || item;
  const album = data.album || {};
  const mid = data.mid || data.songmid;
  const mediaMid = data.file?.media_mid || mid;
  return {
    title: data.name || data.songname,
    artist: (data.singer || []).map((artist) => artist.name).filter(Boolean).join(' / ') || null,
    album: album.title || album.name || null,
    coverUrl: album.mid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${album.mid}.jpg` : null,
    audioUrl: mediaMid ? `https://isure.stream.qqmusic.qq.com/C400${mediaMid}.m4a?guid=0&vkey=&uin=0&fromtag=66` : '',
    originalName: `tencent:${mid}`,
    source: 'tencent',
    sourceSongId: String(mid),
    duration: data.interval || null,
    metadataStatus: 'matched'
  };
}

async function getNeteaseSongs(type, id) {
  if (type === 'song') {
    const data = await fetchNeteaseJson(`/song/detail?ids=[${id}]`);
    return data?.songs || [];
  }
  if (type === 'playlist') {
    const data = await fetchNeteaseJson(`/v6/playlist/detail?id=${id}&n=1000`);
    const tracks = data?.playlist?.tracks || [];
    const trackIds = (data?.playlist?.trackIds || []).map((item) => item.id).filter(Boolean);

    if (!trackIds.length || tracks.length >= trackIds.length) return tracks;

    const songs = [];
    for (let index = 0; index < trackIds.length; index += 200) {
      const ids = trackIds.slice(index, index + 200);
      const detail = await fetchNeteaseJson(`/song/detail?ids=[${ids.join(',')}]`);
      songs.push(...(detail?.songs || []));
    }
    return songs.length ? songs : tracks;
  }
  if (type === 'album') {
    const data = await fetchNeteaseJson(`/v1/album/${id}`);
    return data?.songs || [];
  }
  if (type === 'artist') {
    const data = await fetchNeteaseJson(`/v1/artist/${id}`);
    return data?.hotSongs || [];
  }
  return [];
}

async function searchNeteaseSongs(keyword, limit = 8) {
  const body = new URLSearchParams({
    s: keyword,
    type: '1',
    limit: String(limit),
    offset: '0'
  });
  const data = await fetchJson(`${NETEASE_API}/search/get/web`, {
    method: 'POST',
    referer: 'https://music.163.com/',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  return data?.result?.songs || [];
}

async function getTencentSongs(type, id) {
  if (type === 'song') {
    const data = await fetchJson(`${QQ_API}/v8/fcg-bin/fcg_play_single_song.fcg?songmid=${id}&platform=yqq&format=json`);
    return data?.data || [];
  }
  if (type === 'playlist') {
    const data = await fetchJson(`${QQ_API}/v8/fcg-bin/fcg_v8_playlist_cp.fcg?id=${id}&format=json&newsong=1&platform=jqspaframe.json`);
    return data?.data?.cdlist?.[0]?.songlist || [];
  }
  if (type === 'album') {
    const data = await fetchJson(`${QQ_API}/v8/fcg-bin/fcg_v8_album_detail_cp.fcg?albummid=${id}&platform=mac&format=json&newsong=1`);
    return data?.data?.getSongInfo || [];
  }
  if (type === 'artist') {
    const data = await fetchJson(`${QQ_API}/v8/fcg-bin/fcg_v8_singer_track_cp.fcg?singermid=${id}&begin=0&num=50&order=listen&platform=mac&newsong=1&format=json`);
    return (data?.data?.list || []).map((item) => item.musicData || item);
  }
  return [];
}

async function searchTencentSongs(keyword, limit = 8) {
  const params = new URLSearchParams({
    format: 'json',
    p: '1',
    n: String(limit),
    w: keyword,
    aggr: '1',
    lossless: '1',
    cr: '1',
    new_json: '1'
  });
  const data = await fetchJson(`${QQ_API}/soso/fcgi-bin/client_search_cp?${params.toString()}`);
  return data?.data?.song?.list || [];
}

async function getNeteaseLyric(id) {
  const data = await fetchNeteaseJson(`/song/lyric?id=${id}&lv=1&kv=1&tv=-1`);
  return {
    lyric: data?.lrc?.lyric || null,
    translatedLyric: data?.tlyric?.lyric || null,
    romanizedLyric: data?.romalrc?.lyric || null
  };
}

export async function getNeteasePlayableUrl(id, { cookie = '' } = {}) {
  const data = await fetchNeteaseJson(`/song/enhance/player/url?id=${id}&ids=[${id}]&br=320000`, { cookie });
  const item = data?.data?.[0];
  if (!item?.url) return null;
  return {
    url: item.url,
    br: item.br ? Math.round(item.br / 1000) : null,
    size: item.size || null,
    code: item.code || null,
    fee: item.fee ?? null
  };
}

export async function getNeteaseUserPlaylists(userId, { cookie = '' } = {}) {
  const data = await fetchNeteaseJson(`/user/playlist?uid=${userId}&limit=1000&offset=0`, { cookie });
  return (data?.playlist || []).map((playlist) => ({
    id: String(playlist.id),
    name: playlist.name,
    coverUrl: playlist.coverImgUrl,
    trackCount: playlist.trackCount || 0,
    creator: playlist.creator?.nickname || null
  }));
}

export async function getNeteasePlaylistSongs(id, { cookie = '' } = {}) {
  const songs = await getNeteaseSongs('playlist', id);
  return songs.map(formatNeteaseSong).filter((song) => song.title && song.sourceSongId);
}

async function getTencentLyric(id) {
  const data = await fetchJson(`${QQ_API}/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${id}&format=json&nobase64=0&g_tk=5381`, {
    referer: 'https://y.qq.com/',
    headers: { origin: 'https://y.qq.com' }
  });
  return {
    lyric: data?.lyric ? Buffer.from(data.lyric, 'base64').toString('utf8') : null,
    translatedLyric: data?.trans ? Buffer.from(data.trans, 'base64').toString('utf8') : null,
    romanizedLyric: data?.roma ? Buffer.from(data.roma, 'base64').toString('utf8') : null
  };
}

function scoreCandidate(target, candidate) {
  const targetTitle = normalize(target.title);
  const candidateTitle = normalize(candidate.title);
  const targetArtist = normalize(firstArtist(target.artist));
  const candidateArtist = normalize(candidate.artist);
  let score = 0;

  if (targetTitle && candidateTitle === targetTitle) score += 8;
  else if (targetTitle && candidateTitle.includes(targetTitle)) score += 4;
  else if (targetTitle && targetTitle.includes(candidateTitle)) score += 2;

  if (targetArtist && candidateArtist.includes(targetArtist)) score += 4;
  if (candidate.sourceSongId === target.sourceSongId) score += 10;

  return score;
}

async function searchSimilarSongOnSameProvider(song) {
  const keyword = [song.title, firstArtist(song.artist)].filter(Boolean).join(' ');
  if (!keyword) return null;

  const rawSongs = song.source === 'tencent'
    ? await searchTencentSongs(keyword)
    : await searchNeteaseSongs(keyword);
  const candidates = rawSongs
    .map((item) => song.source === 'tencent' ? formatTencentSong(item) : formatNeteaseSong(item))
    .filter((candidate) => candidate.title && candidate.sourceSongId);

  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(song, candidate) }))
    .sort((a, b) => b.score - a.score)[0]?.candidate || null;
}

async function getBestSameProviderLyric(song) {
  const directLyricBundle = song.source === 'tencent'
    ? await getTencentLyric(song.sourceSongId).catch(() => null)
    : await getNeteaseLyric(song.sourceSongId).catch(() => null);

  if (directLyricBundle?.lyric) {
    return { lyricBundle: directLyricBundle, matchedSong: song, matchType: 'id' };
  }

  const similarSong = await searchSimilarSongOnSameProvider(song).catch(() => null);
  if (!similarSong) {
    return { rawLyric: null, matchedSong: song, matchType: 'none' };
  }

  const searchedLyric = similarSong.source === 'tencent'
    ? await getTencentLyric(similarSong.sourceSongId).catch(() => null)
    : await getNeteaseLyric(similarSong.sourceSongId).catch(() => null);

  return {
    lyricBundle: searchedLyric,
    matchedSong: searchedLyric?.lyric ? similarSong : song,
    matchType: searchedLyric?.lyric ? 'search' : 'none'
  };
}

export function parseOnlineMusicInput(input, options = {}) {
  const parsed = parseOnlineInput(input, options);
  return {
    ...parsed,
    providerLabel: providerLabels[parsed.provider] || parsed.provider,
    typeLabel: typeLabels[parsed.type] || parsed.type
  };
}

export async function resolveOnlineMusic(input, options = {}) {
  const parsed = parseOnlineMusicInput(input, options);
  const rawSongs = parsed.provider === 'tencent'
    ? await getTencentSongs(parsed.type, parsed.id)
    : await getNeteaseSongs(parsed.type, parsed.id);

  const songs = rawSongs
    .map((song) => parsed.provider === 'tencent' ? formatTencentSong(song) : formatNeteaseSong(song))
    .filter((song) => song.title && song.sourceSongId);

  return {
    ...parsed,
    count: songs.length,
    songs: uniqueSongs(songs)
  };
}

export async function hydrateOnlineSong(song) {
  const { lyricBundle, matchedSong } = await getBestSameProviderLyric(song);
  const rawLyric = lyricBundle?.lyric || null;
  const credits = parseCredits(rawLyric);
  const mainLyrics = normalizeLyricBundle(rawLyric);
  const translatedLyrics = normalizeLyricBundle(lyricBundle?.translatedLyric);
  const romanizedLyrics = normalizeLyricBundle(lyricBundle?.romanizedLyric);

  return {
    ...song,
    album: song.album || matchedSong.album || null,
    coverUrl: song.coverUrl || matchedSong.coverUrl || null,
    audioUrl: song.audioUrl || matchedSong.audioUrl || '',
    lyrics: mainLyrics.raw || mainLyrics.plain,
    translatedLyrics: translatedLyrics.raw || translatedLyrics.plain,
    romanizedLyrics: romanizedLyrics.raw || romanizedLyrics.plain,
    lyricist: credits.lyricist || null,
    composer: credits.composer || null,
    arranger: credits.arranger || null,
    mimeType: song.source === 'tencent' ? 'audio/mp4' : 'audio/mpeg',
    fileSize: null,
    duration: song.duration || matchedSong.duration || null,
    originalName: song.originalName || `${song.source}:${song.sourceSongId}`
  };
}

export function pickOnlineSongs(resolved, ids = []) {
  const selected = new Set(ids.map(String));
  if (!selected.size) return resolved.songs;
  return resolved.songs.filter((song) => selected.has(String(song.sourceSongId)));
}
