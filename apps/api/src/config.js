import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '../../..');
export const storageDir = path.join(rootDir, 'storage');
export const audioDir = path.join(storageDir, 'audio');
export const coverDir = path.join(storageDir, 'covers');

export const config = {
  port: Number(process.env.PORT || 3000),
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET || 'ayaka-music-dev-secret',
  neteaseCookie: process.env.NETEASE_COOKIE || '',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
};
