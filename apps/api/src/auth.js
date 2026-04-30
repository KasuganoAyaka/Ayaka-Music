import crypto from 'node:crypto';
import { config } from './config.js';

const COOKIE_NAME = 'ayaka_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

function sign(value) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(value)
    .digest('hex');
}

function createSessionValue(username) {
  const payload = JSON.stringify({
    username,
    exp: Date.now() + SESSION_TTL_MS
  });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function readSessionValue(value) {
  if (!value) return null;

  const [encoded, signature] = value.split('.');
  if (!encoded || !signature || signature !== sign(encoded)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.username !== config.adminUsername) return null;
    return payload;
  } catch {
    return null;
  }
}

export function loginAdmin(req, res) {
  const { username, password } = req.body || {};
  if (username !== config.adminUsername || password !== config.adminPassword) {
    return res.status(401).json({ message: '账号或密码错误' });
  }

  res.cookie(COOKIE_NAME, createSessionValue(username), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
  return res.json({ username });
}

export function logoutAdmin(_req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ ok: true });
}

export function getAdminSession(req, res) {
  const session = readSessionValue(req.cookies?.[COOKIE_NAME]);
  if (!session) return res.status(401).json({ message: '未登录' });
  return res.json({ username: session.username });
}

export function requireAdmin(req, res, next) {
  const session = readSessionValue(req.cookies?.[COOKIE_NAME]);
  if (!session) return res.status(401).json({ message: '未登录' });
  req.admin = session;
  return next();
}
