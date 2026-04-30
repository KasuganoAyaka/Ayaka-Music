const NETEASE_SEARCH = 'https://music.163.com/api/search/get/web';
const NETEASE_DETAIL = 'https://music.163.com/api/song/detail';
const NETEASE_LYRIC = 'https://music.163.com/api/song/lyric';

function normalizeText(value) {
  return String(value || '').trim();
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

function parseCredits(lyrics) {
  const lines = stripLyrics(lyrics)?.split('\n') || [];
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
      'user-agent': 'Mozilla/5.0 AyakaMusic/0.1',
      referer: 'https://music.163.com/',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`metadata request failed: ${response.status}`);
  }

  return response.json();
}

async function searchNetease(title, artist) {
  const keyword = normalizeText([title, artist].filter(Boolean).join(' '));
  if (!keyword) return null;

  const body = new URLSearchParams({
    s: keyword,
    type: '1',
    limit: '8',
    offset: '0'
  });

  const data = await fetchJson(NETEASE_SEARCH, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });

  const songs = data?.result?.songs || [];
  if (!songs.length) return null;

  const normalizedTitle = normalizeText(title).toLowerCase();
  const normalizedArtist = normalizeText(artist).toLowerCase();

  return songs.find((song) => {
    const songName = normalizeText(song.name).toLowerCase();
    const artistNames = (song.artists || []).map((item) => normalizeText(item.name).toLowerCase());
    const titleMatches = songName === normalizedTitle || songName.includes(normalizedTitle);
    const artistMatches = !normalizedArtist || artistNames.some((name) => name.includes(normalizedArtist));
    return titleMatches && artistMatches;
  }) || songs[0];
}

async function getNeteaseDetail(id) {
  const detail = await fetchJson(`${NETEASE_DETAIL}?ids=[${id}]`);
  return detail?.songs?.[0] || null;
}

async function getNeteaseLyric(id) {
  const lyric = await fetchJson(`${NETEASE_LYRIC}?id=${id}&lv=1&kv=1&tv=-1`);
  return {
    lyric: lyric?.lrc?.lyric || null,
    translatedLyric: lyric?.tlyric?.lyric || null,
    romanizedLyric: lyric?.romalrc?.lyric || null
  };
}

export async function enrichSongMetadata({ title, artist, fallback = {} }) {
  const safeTitle = normalizeText(title || fallback.title);
  const safeArtist = normalizeText(artist || fallback.artist);

  try {
    const found = await searchNetease(safeTitle, safeArtist);
    if (!found) {
      return {
        ...fallback,
        title: safeTitle || fallback.title || '未命名歌曲',
        artist: safeArtist || fallback.artist || null,
        metadataStatus: 'not_found'
      };
    }

    const [detail, lyricBundle] = await Promise.all([
      getNeteaseDetail(found.id),
      getNeteaseLyric(found.id).catch(() => null)
    ]);

    const rawLyrics = lyricBundle?.lyric || null;
    const mainLyrics = normalizeLyricBundle(rawLyrics);
    const translatedLyrics = normalizeLyricBundle(lyricBundle?.translatedLyric);
    const romanizedLyrics = normalizeLyricBundle(lyricBundle?.romanizedLyric);
    const artists = (detail?.artists || found.artists || []).map((item) => item.name).filter(Boolean);
    const credits = parseCredits(rawLyrics);

    return {
      title: detail?.name || found.name || safeTitle,
      artist: artists.join(' / ') || safeArtist || fallback.artist || null,
      album: detail?.album?.name || found.album?.name || fallback.album || null,
      coverUrl: detail?.album?.picUrl || found.album?.picUrl || fallback.coverUrl || null,
      lyrics: mainLyrics.raw || mainLyrics.plain || fallback.lyrics || null,
      translatedLyrics: translatedLyrics.raw || translatedLyrics.plain || fallback.translatedLyrics || null,
      romanizedLyrics: romanizedLyrics.raw || romanizedLyrics.plain || fallback.romanizedLyrics || null,
      lyricist: credits.lyricist || fallback.lyricist || null,
      composer: credits.composer || fallback.composer || null,
      arranger: credits.arranger || fallback.arranger || null,
      source: 'netease',
      sourceSongId: String(found.id),
      metadataStatus: 'matched'
    };
  } catch (error) {
    return {
      ...fallback,
      title: safeTitle || fallback.title || '未命名歌曲',
      artist: safeArtist || fallback.artist || null,
      metadataStatus: 'failed'
    };
  }
}
