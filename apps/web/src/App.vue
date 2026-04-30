<template>
  <main class="shell" :class="{ 'admin-shell': isAdmin }">
    <section v-if="isAdmin" class="admin-page">
      <section v-if="!adminReady" class="admin-login">
        <div class="admin-login-card">
          <p class="admin-kicker">Ayaka Music</p>
          <h1>后台登录</h1>
          <form @submit.prevent="loginAdmin">
            <label>
              账号
              <input v-model.trim="loginForm.username" autocomplete="username" placeholder="请输入账号" />
            </label>
            <label>
              密码
              <input v-model="loginForm.password" autocomplete="current-password" type="password" placeholder="请输入密码" />
            </label>
            <div v-if="loginError" class="form-error">{{ loginError }}</div>
            <button class="primary-btn" :disabled="loginLoading">
              {{ loginLoading ? '登录中...' : '登录' }}
            </button>
          </form>
          <a class="back-link subtle" href="/">返回前台</a>
        </div>
      </section>

      <template v-else>
      <header class="admin-header">
        <div>
          <p class="admin-kicker">Ayaka Music</p>
          <h1>音乐后台</h1>
          <span>上传音频后自动搜索歌词、歌手、封面</span>
        </div>
        <div class="admin-header-actions">
          <button class="text-btn" @click="logoutAdmin">退出登录</button>
          <a class="back-link" href="/">返回前台</a>
        </div>
      </header>

      <section class="admin-surface">
        <form class="upload-form" @submit.prevent="uploadSong">
          <label>
            歌曲名称
            <input v-model.trim="uploadForm.title" placeholder="可留空，默认读取文件名" />
          </label>
          <label>
            歌手
            <input v-model.trim="uploadForm.artist" placeholder="用于提高匹配准确度" />
          </label>
          <label class="file-zone">
            <Upload />
            <span>{{ uploadForm.file?.name || '选择音频文件' }}</span>
            <input type="file" accept="audio/*" @change="onFileChange" />
          </label>
          <button class="primary-btn" :disabled="uploading">
            {{ uploading ? '上传与匹配中...' : '上传歌曲' }}
          </button>
        </form>
      </section>

      <section class="admin-surface cloud-login">
        <div class="table-head">
          <div>
            <h2>网易云登录</h2>
            <span>{{ neteaseStatusText }}</span>
          </div>
          <div class="result-actions">
            <button class="text-btn" @click="refreshNeteaseStatus">刷新状态</button>
            <button v-if="neteaseStatus.loggedIn" class="text-btn" @click="logoutNetease">退出网易云</button>
          </div>
        </div>

        <div class="netease-login-body">
          <div v-if="neteaseStatus.profile" class="netease-profile">
            <img v-if="neteaseStatus.profile.avatarUrl" :src="neteaseStatus.profile.avatarUrl" :alt="neteaseStatus.profile.nickname" />
            <div>
              <strong>{{ neteaseStatus.profile.nickname }}</strong>
              <small>等级：Lv.{{ neteaseStatus.profile.level ?? '未知' }} · VIP：{{ vipLabel(neteaseStatus.profile.vipType) }}</small>
              <small>已保存登录态，播放网易云受限歌曲时会由后端自动使用。</small>
            </div>
          </div>

          <div v-else class="netease-qr-box">
            <button v-if="!neteaseQr.qrImage" class="primary-btn" :disabled="neteaseLoading" @click="createNeteaseQr">
              {{ neteaseLoading ? '生成中...' : '扫码登录网易云' }}
            </button>
            <template v-else>
              <img class="netease-qr" :src="neteaseQr.qrImage" alt="网易云登录二维码" />
              <div>
                <strong>{{ neteaseQrMessage }}</strong>
                <small>使用网易云音乐 App 扫码并确认登录。</small>
              </div>
            </template>
          </div>
        </div>
      </section>

      <section v-if="neteaseStatus.loggedIn" class="admin-surface">
        <div class="table-head">
          <div>
            <h2>我的网易云歌单</h2>
            <span>选择歌单后勾选歌曲导入到播放器。</span>
          </div>
            <button class="text-btn" type="button" :disabled="neteasePlaylistsLoading" @click="loadNeteasePlaylists">
            {{ neteasePlaylistsLoading ? '加载中...' : '刷新歌单' }}
          </button>
        </div>

        <div class="playlist-picker">
          <button
            v-for="playlist in neteasePlaylists"
            :key="playlist.id"
            class="playlist-card"
            :class="{ selected: selectedNeteasePlaylist?.id === playlist.id }"
            @click="selectNeteasePlaylist(playlist)"
          >
            <img v-if="playlist.coverUrl" :src="playlist.coverUrl" :alt="playlist.name" />
            <div v-else class="mini-cover"><Music /></div>
            <span>{{ playlist.name }}</span>
            <small>{{ playlist.trackCount }} 首</small>
          </button>
        </div>

        <div v-if="neteaseSongsLoading" class="admin-empty inline-empty">
          <Music />
          <span>正在加载歌单歌曲...</span>
        </div>

        <div v-else-if="neteasePlaylistSongs.length" class="online-result">
          <div class="result-head">
            <span>{{ selectedNeteasePlaylist.name }} · 第 {{ neteasePage }} / {{ neteaseTotalPages }} 页 · 已选 {{ selectedNeteaseSongIds.length }} / {{ neteasePlaylistSongs.length }} 首</span>
            <div class="result-actions">
              <button class="text-btn" type="button" @click="toggleAllNeteaseSongs">
                {{ isCurrentNeteasePageAllSelected ? '取消本页' : '全选本页' }}
              </button>
              <button class="text-btn accent" type="button" :disabled="neteaseImporting || !selectedNeteaseSongIds.length" @click="importSelectedNeteaseSongs">
                {{ neteaseImporting ? '导入中...' : '导入选中' }}
              </button>
            </div>
          </div>
          <div class="online-preview">
            <article
              v-for="song in pagedNeteasePlaylistSongs"
              :key="song.sourceSongId"
              :class="{ selected: selectedNeteaseSongIds.includes(song.sourceSongId) }"
              @click="toggleNeteaseSong(song)"
            >
              <img v-if="song.coverUrl" :src="song.coverUrl" :alt="song.title" />
              <div v-else class="mini-cover"><Music /></div>
              <div>
                <strong>{{ song.title }}</strong>
                <small>{{ song.artist || '未知歌手' }} · {{ song.album || '未知专辑' }}</small>
              </div>
            </article>
          </div>
          <div class="pager">
            <button class="text-btn" type="button" :disabled="neteasePage <= 1" @click="neteasePage -= 1">上一页</button>
            <span>{{ neteasePage }} / {{ neteaseTotalPages }}</span>
            <button class="text-btn" type="button" :disabled="neteasePage >= neteaseTotalPages" @click="neteasePage += 1">下一页</button>
          </div>
        </div>
      </section>

      <section class="admin-surface">
        <div class="table-head">
          <div>
            <h2>在线音乐解析</h2>
            <span>支持网易云音乐、QQ 音乐的单曲、歌单、专辑和歌手链接。</span>
          </div>
        </div>

        <form class="online-form" @submit.prevent="resolveOnline">
          <label class="online-input">
            音乐链接或 ID
            <input v-model.trim="onlineForm.input" placeholder="粘贴 music.163.com 或 y.qq.com 链接" />
          </label>
          <label>
            平台
            <select v-model="onlineForm.source">
              <option value="netease">网易云音乐</option>
              <option value="tencent">QQ 音乐</option>
            </select>
          </label>
          <label>
            类型
            <select v-model="onlineForm.type">
              <option value="song">单曲</option>
              <option value="playlist">歌单</option>
              <option value="album">专辑</option>
              <option value="artist">歌手</option>
            </select>
          </label>
          <button class="primary-btn" :disabled="onlineLoading">
            {{ onlineLoading ? '解析中...' : '解析预览' }}
          </button>
        </form>

        <div v-if="onlineError" class="form-error">{{ onlineError }}</div>

        <div v-if="onlineResult" class="online-result">
          <div class="result-head">
            <span>{{ onlineResult.providerLabel }} · {{ onlineResult.typeLabel }} · 第 {{ onlinePage }} / {{ onlineTotalPages }} 页 · 已选 {{ selectedOnlineIds.length }} / {{ onlineResult.songs.length }} 首</span>
            <div class="result-actions">
              <button class="text-btn" type="button" @click="toggleAllOnline">
                {{ isCurrentOnlinePageAllSelected ? '取消本页' : '全选本页' }}
              </button>
              <button class="text-btn accent" type="button" :disabled="onlineImporting || !selectedOnlineIds.length" @click="importOnline">
                {{ onlineImporting ? '导入中...' : '导入选中' }}
              </button>
            </div>
          </div>
          <div class="online-preview">
            <article
              v-for="song in pagedOnlineSongs"
              :key="`${song.source}-${song.sourceSongId}`"
              :class="{ selected: selectedOnlineIds.includes(song.sourceSongId) }"
              @click="toggleOnlineSong(song)"
            >
              <img v-if="song.coverUrl" :src="song.coverUrl" :alt="song.title" />
              <div v-else class="mini-cover"><Music /></div>
              <div>
                <strong>{{ song.title }}</strong>
                <small>{{ song.artist || '未知歌手' }} · {{ song.album || '未知专辑' }}</small>
              </div>
            </article>
          </div>
          <div class="pager">
            <button class="text-btn" type="button" :disabled="onlinePage <= 1" @click="onlinePage -= 1">上一页</button>
            <span>{{ onlinePage }} / {{ onlineTotalPages }}</span>
            <button class="text-btn" type="button" :disabled="onlinePage >= onlineTotalPages" @click="onlinePage += 1">下一页</button>
          </div>
        </div>
      </section>

      <section class="admin-surface">
        <div class="table-head">
          <div>
            <h2>歌曲列表</h2>
            <span>{{ songs.length }} 首歌曲</span>
            <small v-if="songListNotice" class="admin-notice" :class="songListNoticeType">{{ songListNotice }}</small>
          </div>
          <div class="table-actions">
            <button class="text-btn refresh-list-btn" :disabled="metadataRefreshing || !songs.length" @click="refreshAllMetadata">
              <RefreshCw :class="{ spinning: metadataRefreshing }" />
              <span>{{ metadataRefreshing ? `刷新元数据 ${metadataRefreshDone}/${metadataRefreshTotal}` : '一键刷新元数据' }}</span>
            </button>
            <button class="text-btn refresh-list-btn" :disabled="songListRefreshing || metadataRefreshing" @click="refreshAdminSongs">
              <RefreshCw :class="{ spinning: songListRefreshing }" />
              <span>{{ songListRefreshing ? '刷新中...' : '刷新列表' }}</span>
            </button>
          </div>
        </div>

        <div class="admin-list">
          <article v-if="!songs.length" class="admin-empty">
            <Music />
            <span>暂无歌曲，先上传一个音频文件。</span>
          </article>
          <article v-for="song in songs" :key="song.id" class="admin-row">
            <img v-if="song.coverUrl" :src="song.coverUrl" :alt="song.title" />
            <div v-else class="mini-cover"><Music /></div>
            <div class="song-cell">
              <strong>{{ song.title }}</strong>
              <small>{{ song.artist || '未知歌手' }} · {{ statusLabel(song.metadataStatus) }}</small>
            </div>
            <div class="meta-cell">
              <span>{{ song.album || '未知专辑' }}</span>
              <small>{{ formatTime(song.duration || 0) }}</small>
            </div>
            <div class="row-actions">
              <button class="icon-btn dark" title="刷新元数据" @click="refreshSong(song)"><RefreshCw /></button>
              <button class="icon-btn danger" title="删除歌曲" @click="deleteSong(song)"><Trash2 /></button>
            </div>
          </article>
        </div>
      </section>
      </template>
    </section>

    <section v-else class="player-view" :style="backgroundStyle">
      <div v-if="!playerReady" class="loading-view">
        <div class="loading-card">
          <div class="loading-brand">
            <img src="https://eat.ayakacloud.cn/logo.png" alt="Ayaka Music" />
            <span>Ayaka Music</span>
          </div>
          <strong>Loading...</strong>
          <div class="loading-bar"><span></span></div>
        </div>
      </div>

      <template v-else>
      <div class="stage">
        <div class="left-column">
          <div class="cover-wrap" :class="{ playing: isPlaying }" title="播放/暂停" @click="togglePlay">
            <img v-if="currentSong?.coverUrl" class="cover" :src="currentSong.coverUrl" :alt="currentSong.title" />
            <div v-else class="cover placeholder">
              <Music class="placeholder-icon" />
            </div>
          </div>

          <aside class="playlist" :class="{ open: listOpen }" ref="playlistRef">
            <div v-if="!songs.length" class="empty-list">
              <Music />
              <span>暂无歌曲</span>
            </div>
            <button
              v-for="(song, index) in songs"
              :key="song.id"
              class="track"
              :class="{ active: song.id === currentSong?.id }"
              @click="selectSong(index)"
            >
              <span class="track-index">{{ index + 1 }}</span>
              <span class="track-copy">
                <strong>{{ song.title }}</strong>
                <small>{{ song.artist || '未知歌手' }}</small>
              </span>
            </button>
          </aside>
        </div>

        <section class="song-info">
          <div class="lyrics" ref="lyricsRef">
            <p
              v-for="(line, index) in lyricLines"
              :key="`${line.text}-${index}`"
              :class="{ current: index === activeLyricIndex }"
              @click="seekToLyric(index)"
            >
              <span>{{ line.text }}</span>
              <small v-if="line.secondary">{{ line.secondary }}</small>
            </p>
          </div>
        </section>
      </div>

      <footer class="controls">
        <div class="transport">
          <button class="icon-btn" title="上一首" @click="prevSong"><SkipBack /></button>
          <button class="play-btn" title="播放/暂停" @click="togglePlay">
            <Pause v-if="isPlaying" />
            <Play v-else />
          </button>
          <button class="icon-btn" title="下一首" @click="nextSong"><SkipForward /></button>
        </div>

        <div class="progress-row">
          <input
            class="progress"
            type="range"
            min="0"
            :max="duration || 0"
            step="0.1"
            :value="currentTime"
            @input="seek"
          />
          <time>{{ formatTime(currentTime) }} / {{ formatTime(duration || currentSong?.duration || 0) }}</time>
        </div>

        <div class="right-tools">
          <button
            v-if="lyricModeOptions.length > 1"
            class="icon-btn lyric-mode-btn"
            :title="lyricModeLabel"
            @click="cycleLyricMode"
          >
            <Languages />
          </button>
          <div class="volume-control" :class="{ dragging: volumeDragging }">
            <div class="volume-popover">
              <div class="volume-track" aria-label="音量大小" @pointerdown="setVolumeFromPointer" @pointermove="dragVolume">
                <div class="volume-fill" :style="{ height: `${volume * 100}%` }"></div>
              </div>
            </div>
            <button class="icon-btn" title="静音" @click="toggleMute">
              <Volume2 v-if="!muted && volume > 0" />
              <VolumeX v-else />
            </button>
          </div>
          <button class="icon-btn mode-btn" :class="{ active: playbackMode !== 'loop' }" :title="playbackModeLabel" @click="cyclePlaybackMode">
            <Repeat v-if="playbackMode === 'loop'" />
            <ListEnd v-else-if="playbackMode === 'none'" />
            <Repeat1 v-else-if="playbackMode === 'single'" />
            <Shuffle v-else />
          </button>
        </div>
      </footer>

      <audio
        ref="audioRef"
        :src="currentSong?.audioUrl"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @ended="handleEnded"
      />
      </template>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Languages,
  ListEnd,
  Music,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  VolumeX
} from 'lucide-vue-next';

const isAdmin = computed(() => window.location.pathname.replace(/\/$/, '') === '/admin');
const songs = ref([]);
const currentIndex = ref(0);
const audioRef = ref(null);
const lyricsRef = ref(null);
const playlistRef = ref(null);
const isPlaying = ref(false);
const muted = ref(false);
const volume = ref(0.7);
const lastVolume = ref(0.7);
const volumeDragging = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const listOpen = ref(false);
const playbackMode = ref('loop');
const playerReady = ref(false);
const lyricMode = ref('auto');
const uploading = ref(false);
const onlineLoading = ref(false);
const onlineImporting = ref(false);
const adminReady = ref(false);
const loginLoading = ref(false);
const loginError = ref('');
const onlineError = ref('');
const onlineResult = ref(null);
const selectedOnlineIds = ref([]);
const onlinePage = ref(1);
const songListRefreshing = ref(false);
const songListNotice = ref('');
const songListNoticeType = ref('success');
const metadataRefreshing = ref(false);
const metadataRefreshDone = ref(0);
const metadataRefreshTotal = ref(0);
const pageSize = 30;
const neteaseLoading = ref(false);
const neteaseStatus = ref({ loggedIn: false, profile: null });
const neteaseQr = ref({ key: '', qrImage: '' });
const neteaseQrMessage = ref('');
const neteasePlaylists = ref([]);
const selectedNeteasePlaylist = ref(null);
const neteasePlaylistSongs = ref([]);
const selectedNeteaseSongIds = ref([]);
const neteasePage = ref(1);
const neteasePlaylistsLoading = ref(false);
const neteaseSongsLoading = ref(false);
const neteaseImporting = ref(false);
let neteasePollTimer = null;
const uploadForm = ref({ title: '', artist: '', file: null });
const onlineForm = ref({ input: '', source: 'netease', type: 'song' });
const loginForm = ref({ username: '', password: '' });

const currentSong = computed(() => songs.value[currentIndex.value] || null);
const displayTitle = computed(() => {
  if (!currentSong.value) return 'Ayaka Music';
  return [currentSong.value.title, currentSong.value.artist].filter(Boolean).join('-');
});

const lyricLines = computed(() => {
  const mainLines = parseTimedLyrics(currentSong.value?.lyrics);
  const translatedLines = parseTimedLyrics(currentSong.value?.translatedLyrics);
  const romanizedLines = parseTimedLyrics(currentSong.value?.romanizedLyrics);
  const hasTimedMain = mainLines.some((line) => line.time !== null);
  const mode = activeLyricMode.value;
  const primaryLines = mode === 'translation' && translatedLines.length ? translatedLines : mainLines;
  const secondaryLines = mode === 'dual-roman'
    ? romanizedLines
    : mode === 'dual-translation'
      ? translatedLines
      : [];

  const lines = primaryLines.map((line, index) => {
    const secondary = line.time !== null
      ? findNearestLyric(line.time, secondaryLines)
      : secondaryLines[index]?.text || '';
    return {
      ...line,
      secondary: secondary && secondary !== line.text ? secondary : ''
    };
  });

  if (!lines.length) return [{ time: null, text: '暂无歌词', secondary: '' }];
  return hasTimedMain ? lines : lines.map((line, index) => ({ ...line, time: index }));
});

const lyricLanguage = computed(() => detectLyricLanguage(currentSong.value?.lyrics || ''));
const hasTranslationLyrics = computed(() => parseTimedLyrics(currentSong.value?.translatedLyrics).length > 0);
const hasRomanizedLyrics = computed(() => parseTimedLyrics(currentSong.value?.romanizedLyrics).length > 0);
const lyricModeOptions = computed(() => {
  if (!currentSong.value?.lyrics || lyricLanguage.value === 'zh') return [];

  const options = [{ value: 'original', label: '仅显示原文' }];
  if (hasTranslationLyrics.value) {
    options.push({ value: 'translation', label: '仅显示译文' });
    options.push({
      value: 'dual-translation',
      label: lyricLanguage.value === 'ja' ? '日文 / 中文对照' : '原文 / 中文对照'
    });
  }
  if (lyricLanguage.value === 'ja' && hasRomanizedLyrics.value) {
    options.push({ value: 'dual-roman', label: '日文 / 罗马音对照' });
  }
  return options;
});
const activeLyricMode = computed(() => {
  const options = lyricModeOptions.value;
  if (!options.length) return 'original';
  if (options.some((option) => option.value === lyricMode.value)) return lyricMode.value;
  return options.find((option) => option.value === 'dual-translation')?.value || options[0].value;
});
const lyricModeLabel = computed(() => lyricModeOptions.value.find((option) => option.value === activeLyricMode.value)?.label || '歌词显示模式');

const activeLyricIndex = computed(() => {
  if (!currentSong.value?.duration || lyricLines.value.length <= 1) return -1;
  const timedIndex = lyricLines.value.findLastIndex((line) => line.time !== null && line.time <= currentTime.value + 0.2);
  if (timedIndex >= 0) return timedIndex;
  const ratio = Math.min(currentTime.value / currentSong.value.duration, 0.999);
  return Math.floor(ratio * lyricLines.value.length);
});

const backgroundStyle = computed(() => {
  if (!currentSong.value?.coverUrl) return {};
  return { '--cover-bg': `url("${currentSong.value.coverUrl}")` };
});

const playbackModeLabel = computed(() => ({
  loop: '列表循环',
  none: '列表播完暂停',
  single: '单曲循环',
  random: '随机播放'
}[playbackMode.value]));

const neteaseStatusText = computed(() => {
  if (neteaseStatus.value.loggedIn && neteaseStatus.value.profile) {
    return `已登录：${neteaseStatus.value.profile.nickname}`;
  }
  return '未登录。登录后，后端会保存网易云登录态用于获取受限歌曲播放地址。';
});

const neteasePageSize = pageSize;
const neteaseTotalPages = computed(() => Math.max(1, Math.ceil(neteasePlaylistSongs.value.length / neteasePageSize)));
const pagedNeteasePlaylistSongs = computed(() => {
  const start = (neteasePage.value - 1) * neteasePageSize;
  return neteasePlaylistSongs.value.slice(start, start + neteasePageSize);
});
const isCurrentNeteasePageAllSelected = computed(() => {
  const pageSongs = pagedNeteasePlaylistSongs.value;
  return Boolean(pageSongs.length) && pageSongs.every((song) => selectedNeteaseSongIds.value.includes(song.sourceSongId));
});
const onlineTotalPages = computed(() => Math.max(1, Math.ceil((onlineResult.value?.songs?.length || 0) / pageSize)));
const pagedOnlineSongs = computed(() => {
  const start = (onlinePage.value - 1) * pageSize;
  return (onlineResult.value?.songs || []).slice(start, start + pageSize);
});
const isCurrentOnlinePageAllSelected = computed(() => {
  const pageSongs = pagedOnlineSongs.value;
  return Boolean(pageSongs.length) && pageSongs.every((song) => selectedOnlineIds.value.includes(song.sourceSongId));
});

function parseTimestamp(value) {
  const match = /^(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?$/.exec(value);
  if (!match) return null;
  const [, minutes, seconds, fraction = '0'] = match;
  return Number(minutes) * 60 + Number(seconds) + Number(`0.${fraction.padEnd(3, '0').slice(0, 3)}`);
}

function parseTimedLyrics(raw) {
  return String(raw || '')
    .split('\n')
    .flatMap((line) => {
      const tags = [...line.matchAll(/\[([0-9:.]+)\]/g)];
      const text = line.replace(/\[[^\]]+\]/g, '').trim();
      if (!text) return [];
      if (!tags.length) return [{ time: null, text }];
      return tags
        .map((tag) => ({ time: parseTimestamp(tag[1]), text }))
        .filter((item) => item.time !== null);
    })
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

function findNearestLyric(time, lines) {
  if (!lines.length) return '';
  let best = null;
  for (const line of lines) {
    if (line.time === null) continue;
    const distance = Math.abs(line.time - time);
    if (distance <= 0.75 && (!best || distance < best.distance)) {
      best = { text: line.text, distance };
    }
  }
  return best?.text || '';
}

function detectLyricLanguage(raw) {
  const text = String(raw || '').replace(/\[[^\]]+\]/g, '');
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const jaKana = (text.match(/[\u3040-\u30ff]/g) || []).length;
  const hangul = (text.match(/[\uac00-\ud7af]/g) || []).length;
  const cyrillic = (text.match(/[\u0400-\u04ff]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;

  if (jaKana > 0) return 'ja';
  if (hangul > 0) return 'ko';
  if (cyrillic > 0) return 'ru';
  if (latin > zh) return 'en';
  if (zh > 0) return 'zh';
  return 'other';
}

function cycleLyricMode() {
  const options = lyricModeOptions.value;
  if (!options.length) return;
  const index = options.findIndex((option) => option.value === activeLyricMode.value);
  lyricMode.value = options[(index + 1) % options.length].value;
}

watch(currentSong, async () => {
  currentTime.value = 0;
  duration.value = 0;
  lyricMode.value = 'auto';
  updateMediaSession();
  await nextTick();
  scrollPlaylistToCurrent();
  if (isPlaying.value) audioRef.value?.play().catch(() => {});
});

function scrollPlaylistToCurrent() {
  if (!playlistRef.value || currentIndex.value < 0) return;
  const item = playlistRef.value.querySelectorAll('.track')[currentIndex.value];
  item?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

watch(activeLyricIndex, async (index) => {
  if (index < 0 || !lyricsRef.value) return;
  await nextTick();
  const item = lyricsRef.value.children[index];
  item?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  updateMediaSession();
});

async function loadSongs() {
  try {
    const response = await fetch('/api/songs');
    if (!response.ok) throw new Error('songs request failed');
    const data = await response.json();
    songs.value = Array.isArray(data) ? data : [];
    return true;
  } catch {
    songs.value = [];
    return false;
  } finally {
    if (!isAdmin.value) playerReady.value = true;
  }
}

async function refreshAdminSongs() {
  if (songListRefreshing.value) return;
  songListRefreshing.value = true;
  songListNotice.value = '';
  const ok = await loadSongs();
  songListNoticeType.value = ok ? 'success' : 'error';
  songListNotice.value = ok ? `刷新成功，共 ${songs.value.length} 首歌曲` : '刷新失败，请稍后重试';
  songListRefreshing.value = false;
  window.setTimeout(() => {
    songListNotice.value = '';
  }, 2600);
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function refreshSongMetadata(song) {
  const response = await fetch(`/api/admin/songs/${song.id}/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title: song.title, artist: song.artist })
  });
  return response.ok;
}

async function refreshAllMetadata() {
  if (metadataRefreshing.value || !songs.value.length) return;

  metadataRefreshing.value = true;
  metadataRefreshDone.value = 0;
  metadataRefreshTotal.value = songs.value.length;
  songListNotice.value = '开始刷新元数据，将逐首慢速处理';
  songListNoticeType.value = 'success';

  let successCount = 0;
  for (const song of [...songs.value]) {
    const ok = await refreshSongMetadata(song).catch(() => false);
    if (ok) successCount += 1;
    metadataRefreshDone.value += 1;
    if (metadataRefreshDone.value < metadataRefreshTotal.value) {
      await sleep(1800);
    }
  }

  await loadSongs();
  metadataRefreshing.value = false;
  songListNoticeType.value = successCount === metadataRefreshTotal.value ? 'success' : 'error';
  songListNotice.value = `元数据刷新完成：成功 ${successCount} / ${metadataRefreshTotal.value}`;
  window.setTimeout(() => {
    songListNotice.value = '';
  }, 3200);
}

function selectSong(index) {
  currentIndex.value = index;
  isPlaying.value = true;
  listOpen.value = false;
  nextTick(() => audioRef.value?.play().catch(() => {}));
}

function togglePlay() {
  if (!currentSong.value) return;
  if (audioRef.value.paused) {
    audioRef.value.play();
    isPlaying.value = true;
  } else {
    audioRef.value.pause();
    isPlaying.value = false;
  }
  updateMediaSession();
}

function prevSong() {
  if (!songs.value.length) return;
  if (playbackMode.value === 'random') {
    currentIndex.value = randomSongIndex();
    return;
  }
  currentIndex.value = (currentIndex.value - 1 + songs.value.length) % songs.value.length;
}

function nextSong() {
  if (!songs.value.length) return;
  if (playbackMode.value === 'random') {
    currentIndex.value = randomSongIndex();
    if (isPlaying.value) nextTick(() => audioRef.value?.play().catch(() => {}));
    return;
  }
  currentIndex.value = (currentIndex.value + 1) % songs.value.length;
  if (isPlaying.value) nextTick(() => audioRef.value?.play().catch(() => {}));
}

function randomSongIndex() {
  if (songs.value.length <= 1) return 0;
  let nextIndex = currentIndex.value;
  while (nextIndex === currentIndex.value) {
    nextIndex = Math.floor(Math.random() * songs.value.length);
  }
  return nextIndex;
}

function cyclePlaybackMode() {
  const modes = ['loop', 'none', 'single', 'random'];
  const index = modes.indexOf(playbackMode.value);
  playbackMode.value = modes[(index + 1) % modes.length];
}

function handleEnded() {
  if (!songs.value.length) return;

  if (playbackMode.value === 'single') {
    currentTime.value = 0;
    if (audioRef.value) audioRef.value.currentTime = 0;
    nextTick(() => audioRef.value?.play().catch(() => {}));
    return;
  }

  const isLastSong = currentIndex.value >= songs.value.length - 1;
  if (playbackMode.value === 'none' && isLastSong) {
    isPlaying.value = false;
    currentTime.value = duration.value || 0;
    updateMediaSession();
    return;
  }

  if (playbackMode.value === 'random') {
    currentIndex.value = randomSongIndex();
  } else {
    currentIndex.value = (currentIndex.value + 1) % songs.value.length;
  }

  isPlaying.value = true;
  nextTick(() => audioRef.value?.play().catch(() => {}));
}

function seek(event) {
  const value = Number(event.target.value);
  audioRef.value.currentTime = value;
  currentTime.value = value;
}

function seekToLyric(index) {
  if (!currentSong.value?.duration || lyricLines.value.length <= 1) return;
  const lineTime = lyricLines.value[index]?.time;
  const target = lineTime !== null && lineTime !== undefined
    ? lineTime
    : (index / lyricLines.value.length) * currentSong.value.duration;
  audioRef.value.currentTime = target;
  currentTime.value = target;
  if (audioRef.value.paused) togglePlay();
}

function onTimeUpdate() {
  currentTime.value = audioRef.value?.currentTime || 0;
}

function onLoadedMetadata() {
  duration.value = audioRef.value?.duration || 0;
  if (currentSong.value && !currentSong.value.duration && duration.value) {
    currentSong.value.duration = Math.round(duration.value);
  }
  applyAudioVolume();
  updateMediaSession();
}

function toggleMute() {
  if (muted.value || volume.value === 0) {
    muted.value = false;
    volume.value = lastVolume.value || 0.7;
  } else {
    lastVolume.value = volume.value;
    muted.value = true;
  }
  applyAudioVolume();
}

function setVolumeValue(value) {
  volume.value = Math.min(1, Math.max(0, value));
  if (volume.value > 0) {
    lastVolume.value = volume.value;
    muted.value = false;
  } else {
    muted.value = true;
  }
  applyAudioVolume();
}

function setVolumeFromPointer(event) {
  volumeDragging.value = true;
  updateVolumeFromPointer(event);
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function dragVolume(event) {
  if (!volumeDragging.value || event.buttons !== 1) {
    volumeDragging.value = false;
    return;
  }
  updateVolumeFromPointer(event);
}

function updateVolumeFromPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  setVolumeValue(1 - (event.clientY - rect.top) / rect.height);
}

function applyAudioVolume() {
  if (!audioRef.value) return;
  audioRef.value.volume = muted.value ? 0 : volume.value;
  audioRef.value.muted = muted.value || volume.value === 0;
}

function onFileChange(event) {
  uploadForm.value.file = event.target.files?.[0] || null;
}

async function checkAdminSession() {
  if (!isAdmin.value) return;
  const response = await fetch('/api/admin/session', { credentials: 'include' }).catch(() => null);
  adminReady.value = !!response?.ok;
  if (adminReady.value) {
    await Promise.all([loadSongs(), refreshNeteaseStatus()]);
  }
}

async function loginAdmin() {
  loginLoading.value = true;
  loginError.value = '';

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(loginForm.value)
    });
    if (!response.ok) throw new Error((await response.json()).message || '登录失败');
    loginForm.value.password = '';
    adminReady.value = true;
    await loadSongs();
  } catch (error) {
    loginError.value = error.message || '登录失败';
  } finally {
    loginLoading.value = false;
  }
}

async function logoutAdmin() {
  await fetch('/api/admin/logout', {
    method: 'POST',
    credentials: 'include'
  }).catch(() => null);
  adminReady.value = false;
}

async function refreshNeteaseStatus() {
  const response = await fetch('/api/admin/netease/status', { credentials: 'include' }).catch(() => null);
  if (response?.ok) {
    neteaseStatus.value = await response.json();
    if (neteaseStatus.value.loggedIn && !neteasePlaylists.value.length) {
      await loadNeteasePlaylists();
    }
  }
}

async function createNeteaseQr() {
  neteaseLoading.value = true;
  neteaseQrMessage.value = '';
  try {
    const response = await fetch('/api/admin/netease/qr', {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error((await response.json()).message || '生成二维码失败');
    neteaseQr.value = await response.json();
    neteaseQrMessage.value = '等待扫码';
    startNeteasePolling();
  } catch (error) {
    neteaseQrMessage.value = error.message || '生成二维码失败';
  } finally {
    neteaseLoading.value = false;
  }
}

function startNeteasePolling() {
  if (neteasePollTimer) clearInterval(neteasePollTimer);
  neteasePollTimer = setInterval(async () => {
    if (!neteaseQr.value.key) return;
    const response = await fetch(`/api/admin/netease/qr/${neteaseQr.value.key}`, { credentials: 'include' }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    neteaseQrMessage.value = data.message;
    if (data.code === 803 && data.saved !== false) {
      clearInterval(neteasePollTimer);
      neteasePollTimer = null;
      neteaseQr.value = { key: '', qrImage: '' };
      await refreshNeteaseStatus();
    }
    if (data.code === 800) {
      clearInterval(neteasePollTimer);
      neteasePollTimer = null;
      neteaseQrMessage.value = '二维码已过期，请重新生成';
    }
  }, 2200);
}

function vipLabel(vipType) {
  if (vipType === null || vipType === undefined) return '未知';
  if (Number(vipType) > 0) return `会员(${vipType})`;
  return '非会员';
}

async function logoutNetease() {
  await fetch('/api/admin/netease/session', {
    method: 'DELETE',
    credentials: 'include'
  }).catch(() => null);
  neteaseStatus.value = { loggedIn: false, profile: null };
  neteaseQr.value = { key: '', qrImage: '' };
  neteasePlaylists.value = [];
  selectedNeteasePlaylist.value = null;
  neteasePlaylistSongs.value = [];
  selectedNeteaseSongIds.value = [];
  neteasePage.value = 1;
}

async function loadNeteasePlaylists() {
  neteasePlaylistsLoading.value = true;
  try {
    const response = await fetch('/api/admin/netease/playlists', { credentials: 'include' });
    if (!response.ok) throw new Error((await response.json()).message || '加载歌单失败');
    const data = await response.json();
    neteasePlaylists.value = data.playlists || [];
  } finally {
    neteasePlaylistsLoading.value = false;
  }
}

async function selectNeteasePlaylist(playlist) {
  selectedNeteasePlaylist.value = playlist;
  neteasePage.value = 1;
  neteaseSongsLoading.value = true;
  neteasePlaylistSongs.value = [];
  selectedNeteaseSongIds.value = [];
  try {
    const response = await fetch(`/api/admin/netease/playlists/${playlist.id}/songs`, { credentials: 'include' });
    if (!response.ok) throw new Error((await response.json()).message || '加载歌曲失败');
    const data = await response.json();
    neteasePlaylistSongs.value = data.songs || [];
    selectedNeteaseSongIds.value = [];
  } finally {
    neteaseSongsLoading.value = false;
  }
}

function toggleNeteaseSong(song) {
  const id = song.sourceSongId;
  selectedNeteaseSongIds.value = selectedNeteaseSongIds.value.includes(id)
    ? selectedNeteaseSongIds.value.filter((item) => item !== id)
    : [...selectedNeteaseSongIds.value, id];
}

function toggleAllNeteaseSongs() {
  const pageIds = pagedNeteasePlaylistSongs.value.map((song) => song.sourceSongId);
  selectedNeteaseSongIds.value = isCurrentNeteasePageAllSelected.value
    ? selectedNeteaseSongIds.value.filter((id) => !pageIds.includes(id))
    : Array.from(new Set([...selectedNeteaseSongIds.value, ...pageIds]));
}

async function importSelectedNeteaseSongs() {
  if (!selectedNeteasePlaylist.value || !selectedNeteaseSongIds.value.length) return;
  neteaseImporting.value = true;
  try {
    const response = await fetch('/api/admin/online/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        input: selectedNeteasePlaylist.value.id,
        source: 'netease',
        type: 'playlist',
        songIds: selectedNeteaseSongIds.value
      })
    });
    if (!response.ok) throw new Error((await response.json()).message || '导入失败');
    await loadSongs();
  } finally {
    neteaseImporting.value = false;
  }
}

async function uploadSong() {
  if (!uploadForm.value.file) return;
  uploading.value = true;

  const body = new FormData();
  body.append('audio', uploadForm.value.file);
  if (uploadForm.value.title) body.append('title', uploadForm.value.title);
  if (uploadForm.value.artist) body.append('artist', uploadForm.value.artist);

  try {
    const response = await fetch('/api/admin/songs', {
      method: 'POST',
      credentials: 'include',
      body
    });
    if (!response.ok) throw new Error(await response.text());
    uploadForm.value = { title: '', artist: '', file: null };
    await loadSongs();
  } finally {
    uploading.value = false;
  }
}

async function refreshSong(song) {
  if (await refreshSongMetadata(song)) await loadSongs();
}

async function resolveOnline() {
  if (!onlineForm.value.input) return;
  onlineLoading.value = true;
  onlineError.value = '';
  onlineResult.value = null;
  selectedOnlineIds.value = [];
  onlinePage.value = 1;

  try {
    const response = await fetch('/api/admin/online/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(onlineForm.value)
    });
    if (!response.ok) throw new Error((await response.json()).message || '解析失败');
    onlineResult.value = await response.json();
    selectedOnlineIds.value = [];
  } catch (error) {
    onlineError.value = error.message || '解析失败';
  } finally {
    onlineLoading.value = false;
  }
}

function toggleOnlineSong(song) {
  const id = song.sourceSongId;
  selectedOnlineIds.value = selectedOnlineIds.value.includes(id)
    ? selectedOnlineIds.value.filter((item) => item !== id)
    : [...selectedOnlineIds.value, id];
}

function toggleAllOnline() {
  if (!onlineResult.value?.songs?.length) return;
  const pageIds = pagedOnlineSongs.value.map((song) => song.sourceSongId);
  selectedOnlineIds.value = isCurrentOnlinePageAllSelected.value
    ? selectedOnlineIds.value.filter((id) => !pageIds.includes(id))
    : Array.from(new Set([...selectedOnlineIds.value, ...pageIds]));
}

async function importOnline() {
  if (!onlineResult.value?.songs?.length || !selectedOnlineIds.value.length) return;
  onlineImporting.value = true;
  onlineError.value = '';

  try {
    const response = await fetch('/api/admin/online/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...onlineForm.value,
        songIds: selectedOnlineIds.value
      })
    });
    if (!response.ok) throw new Error((await response.json()).message || '导入失败');
    await loadSongs();
  } catch (error) {
    onlineError.value = error.message || '导入失败';
  } finally {
    onlineImporting.value = false;
  }
}

async function deleteSong(song) {
  if (!window.confirm(`确定删除《${song.title}》吗？`)) return;
  const response = await fetch(`/api/admin/songs/${song.id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (response.ok) await loadSongs();
}

function formatTime(value) {
  const total = Number.isFinite(value) ? Math.floor(value) : 0;
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function statusLabel(status) {
  return {
    matched: '已匹配',
    failed: '匹配失败',
    not_found: '未找到',
    pending: '待匹配'
  }[status] || status;
}

function updateMediaSession() {
  const song = currentSong.value;
  if (isAdmin.value || !song || !('mediaSession' in navigator)) return;

  const currentLyric = lyricLines.value[activeLyricIndex.value];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: isPlaying.value && currentLyric ? currentLyric : song.title,
    artist: isPlaying.value && currentLyric ? [song.artist, song.title].filter(Boolean).join(' / ') : song.artist || '',
    album: song.album || '',
    artwork: song.coverUrl ? [
      { src: song.coverUrl, sizes: '96x96', type: 'image/jpeg' },
      { src: song.coverUrl, sizes: '128x128', type: 'image/jpeg' },
      { src: song.coverUrl, sizes: '256x256', type: 'image/jpeg' },
      { src: song.coverUrl, sizes: '512x512', type: 'image/jpeg' }
    ] : []
  });
  navigator.mediaSession.playbackState = isPlaying.value ? 'playing' : 'paused';
}

function bindMediaSession() {
  if (isAdmin.value || !('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', togglePlay);
  navigator.mediaSession.setActionHandler('pause', togglePlay);
  navigator.mediaSession.setActionHandler('previoustrack', prevSong);
  navigator.mediaSession.setActionHandler('nexttrack', nextSong);
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (typeof details.seekTime === 'number' && audioRef.value) {
      audioRef.value.currentTime = details.seekTime;
    }
  });
}

function onKeydown(event) {
  if (isAdmin.value) return;
  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
  }
  if (event.code === 'ArrowLeft') prevSong();
  if (event.code === 'ArrowRight') nextSong();
}

onMounted(() => {
  if (isAdmin.value) {
    checkAdminSession();
  } else {
    loadSongs();
  }
  bindMediaSession();
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  if (neteasePollTimer) clearInterval(neteasePollTimer);
  window.removeEventListener('keydown', onKeydown);
});
</script>
