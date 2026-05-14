import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from './db.js';
import { config } from './config.js';

const COOKIE_NAME = 'ayaka_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const ADMIN_ID = 1;
const ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const scryptAsync = promisify(crypto.scrypt);

function normalizePassword(value) {
  return String(value || '');
}

function sign(value) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(value)
    .digest('hex');
}

function createSessionValue(admin) {
  const payload = JSON.stringify({
    id: admin.id,
    username: admin.username,
    exp: Date.now() + SESSION_TTL_MS
  });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function setAdminCookie(res, admin) {
  res.cookie(COOKIE_NAME, createSessionValue(admin), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = String(storedHash || '').split(':');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;

  const derivedKey = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(hash, 'base64url');
  return expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey);
}

async function ensureAdminAccount() {
  const existing = await prisma.adminAccount.findUnique({ where: { id: ADMIN_ID } });
  if (existing) {
    if (existing.username === ADMIN_USERNAME) return existing;
    return prisma.adminAccount.update({
      where: { id: ADMIN_ID },
      data: { username: ADMIN_USERNAME }
    });
  }

  return prisma.adminAccount.create({
    data: {
      id: ADMIN_ID,
      username: ADMIN_USERNAME,
      passwordHash: await hashPassword(DEFAULT_ADMIN_PASSWORD)
    }
  });
}

async function readSessionValue(value) {
  if (!value) return null;

  const [encoded, signature] = value.split('.');
  if (!encoded || !signature || signature !== sign(encoded)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;

    const admin = await ensureAdminAccount();
    if (payload.id !== admin.id || payload.username !== admin.username) return null;
    return { id: admin.id, username: admin.username };
  } catch {
    return null;
  }
}

export async function loginAdmin(req, res, next) {
  try {
    const { username, password } = req.body || {};
    const admin = await ensureAdminAccount();
    const passwordOk = await verifyPassword(normalizePassword(password), admin.passwordHash);

    if (String(username || '').trim() !== admin.username || !passwordOk) {
      return res.status(401).json({ message: '账号或密码错误' });
    }

    setAdminCookie(res, admin);
    return res.json({ username: admin.username });
  } catch (error) {
    return next(error);
  }
}

export function logoutAdmin(_req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ ok: true });
}

export async function getAdminSession(req, res, next) {
  try {
    const session = await readSessionValue(req.cookies?.[COOKIE_NAME]);
    if (!session) return res.status(401).json({ message: '未登录' });
    return res.json({ username: session.username });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminSettings(_req, res, next) {
  try {
    const admin = await ensureAdminAccount();
    return res.json({ username: admin.username });
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminSettings(req, res, next) {
  try {
    const currentPassword = normalizePassword(req.body?.currentPassword);
    const newPassword = normalizePassword(req.body?.newPassword);

    const admin = await ensureAdminAccount();
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      return res.status(401).json({ message: '当前密码错误' });
    }

    if (newPassword.length < 6 || newPassword.length > 72) {
      return res.status(400).json({ message: '新密码需为 6-72 个字符' });
    }

    const updated = await prisma.adminAccount.update({
      where: { id: ADMIN_ID },
      data: { passwordHash: await hashPassword(newPassword) }
    });

    setAdminCookie(res, updated);
    return res.json({ username: updated.username });
  } catch (error) {
    return next(error);
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const session = await readSessionValue(req.cookies?.[COOKIE_NAME]);
    if (!session) return res.status(401).json({ message: '未登录' });
    req.admin = session;
    return next();
  } catch (error) {
    return next(error);
  }
}
