import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { storageDir } from './config.js';

const NETEASE_ORIGIN = 'https://music.163.com';
const sessionFile = path.join(storageDir, 'netease-session.json');
const require = createRequire(import.meta.url);
const neteaseApi = require('NeteaseCloudMusicApi');

function timestamp() {
  return Date.now();
}

function cookieHeaderFromSetCookie(setCookie = []) {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  return values
    .flatMap((cookie) => String(cookie || '').split(/,(?=\s*[\w-]+=)/))
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

async function fetchNetease(pathname, options = {}) {
  const response = await fetch(`${NETEASE_ORIGIN}${pathname}`, {
    ...options,
    headers: {
      accept: 'application/json, text/plain, */*',
      referer: `${NETEASE_ORIGIN}/`,
      'user-agent': 'Mozilla/5.0 AyakaMusic/0.1',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = JSON.parse(text.trim());
  return { response, data };
}

export function readNeteaseSession() {
  try {
    return JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  } catch {
    return null;
  }
}

export function getNeteaseCookie() {
  return readNeteaseSession()?.cookie || '';
}

export function clearNeteaseSession() {
  if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
}

export async function createNeteaseQrLogin() {
  const keyResult = await neteaseApi.login_qr_key({ timestamp: timestamp() });
  const key = keyResult?.body?.data?.unikey;
  if (keyResult?.body?.code !== 200 || !key) throw new Error(keyResult?.body?.message || '创建网易云登录二维码失败');

  const qrResult = await neteaseApi.login_qr_create({ key, qrimg: true, timestamp: timestamp() });
  const qrData = qrResult?.body?.data;
  if (qrResult?.body?.code !== 200 || !qrData?.qrimg) throw new Error(qrResult?.body?.message || '创建网易云二维码图片失败');

  return {
    key,
    qrUrl: qrData.qrurl,
    qrImage: qrData.qrimg
  };
}

export async function checkNeteaseQrLogin(key) {
  const result = await neteaseApi.login_qr_check({ key, noCookie: true, timestamp: timestamp() });
  const data = result?.body || {};

  if (data.code === 803) {
    const cookie = data.cookie || cookieHeaderFromSetCookie(result.cookie || []);
    if (!cookie) {
      return {
        code: 803,
        saved: false,
        message: '授权成功，但网易云没有返回登录 Cookie，请重新生成二维码再试'
      };
    }
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify({
      cookie,
      loginAt: new Date().toISOString()
    }, null, 2));
  }

  return {
    code: data.code,
    saved: data.code === 803,
    message: data.message || (data.code === 801 ? '等待扫码' : data.code === 802 ? '等待确认' : data.code === 803 ? '授权登录成功' : '未知状态')
  };
}

export async function getNeteaseAccountStatus(cookie = getNeteaseCookie()) {
  if (!cookie) return { loggedIn: false };

  const { data } = await fetchNetease(`/api/nuser/account/get?timestamp=${timestamp()}`, {
    headers: { cookie }
  });
  const profile = data.profile || null;
  let level = null;
  let vip = null;

  if (profile) {
    const detail = await fetchNetease(`/api/v1/user/detail/${profile.userId}?timestamp=${timestamp()}`, {
      headers: { cookie }
    }).catch(() => null);
    level = detail?.data?.level ?? null;
    vip = detail?.data?.profile?.vipType ?? profile.vipType ?? null;
  }

  return {
    loggedIn: Boolean(profile),
    profile: profile ? {
      userId: profile.userId,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
      vipType: vip,
      level
    } : null,
    loginAt: readNeteaseSession()?.loginAt || null
  };
}
