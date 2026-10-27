// Files attached to pins and comments (screenshots, images, PDFs...). They used to be embedded in the pin documents as
// data URLs, which made pins huge (slow to load and save). Now each file
// is stored once on the server and pins keep a short link (/api/uploads/<random id>.<ext>).
// Locally files live in ./uploads; in production this would move to cloud storage.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
export const UPLOAD_PREFIX = '/api/uploads/';
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
};

export const CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type])
);

// Random, unguessable file names; only these characters are ever served
export const SAFE_FILE = /^[a-f0-9]{32}\.[a-z0-9]{2,5}$/;

export function parseDataUrl(dataUrl: string): { mime: string; data: Buffer } | null {
  const m = /^data:([a-z0-9.+/-]+)(;[a-z0-9=.+-]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), data: Buffer.from(m[3], 'base64') };
}

// Save a data URL as a file; returns its link
export function saveDataUrl(dataUrl: string): string {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Not a file.');
  if (parsed.data.length > MAX_UPLOAD_BYTES) throw new Error('The file is too large (max 15 MB).');
  const ext = EXTENSIONS[parsed.mime] || 'bin';
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), parsed.data);
  return `${UPLOAD_PREFIX}${name}`;
}

// Save bytes made by the server (e.g. a page preview); returns its link
export function saveFile(data: Buffer | Uint8Array, ext: string): string {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), data);
  return `${UPLOAD_PREFIX}${name}`;
}

// Remove a file saved here (ignored for anything else)
export function removeFile(url: string | null | undefined) {
  const name = String(url || '').startsWith(UPLOAD_PREFIX) ? String(url).slice(UPLOAD_PREFIX.length) : '';
  if (SAFE_FILE.test(name)) fs.rmSync(path.join(UPLOAD_DIR, name), { force: true });
}

// Read an attached file for server use (e.g. images sent to the AI): data URL or uploaded link
export function readAttachment(url: string): { mime: string; data: Buffer } | null {
  if (!url) return null;
  if (url.startsWith('data:')) return parseDataUrl(url);
  const name = url.startsWith(UPLOAD_PREFIX) ? url.slice(UPLOAD_PREFIX.length) : '';
  if (!SAFE_FILE.test(name)) return null;
  try {
    const data = fs.readFileSync(path.join(UPLOAD_DIR, name));
    return { mime: CONTENT_TYPES[name.split('.').pop()!] || 'application/octet-stream', data };
  } catch {
    return null;
  }
}
