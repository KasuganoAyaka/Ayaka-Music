import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { audioDir } from './config.js';

fs.mkdirSync(audioDir, { recursive: true });

const storage = multer.diskStorage({
  destination: audioDir,
  filename(_req, file, cb) {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.mp3';
    cb(null, `${Date.now()}-${nanoid(8)}${extension}`);
  }
});

export const uploadAudio = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype?.startsWith('audio/')) return cb(null, true);
    cb(new Error('Only audio files are supported'));
  }
});
