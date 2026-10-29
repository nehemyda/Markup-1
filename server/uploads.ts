// Files attached to pins and comments (screenshots, images, PDFs...). They used to be embedded in the pin documents as
// data URLs, which made pins huge (slow to load and save). Now each file
// is stored once and pins keep a short link (/api/uploads/<random id>.<ext>).
// Locally files live in ./uploads. On Cloudflare (R2_* settings) they live in an R2 bucket, because a container's own
// disk is emptied whenever it restarts.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AwsClient } from 'aws4fetch';

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

const contentType = (name: string) => CONTENT_TYPES[name.split('.').pop()!] || 'application/octet-stream';

// ---------- Where files are kept ----------
// R2 (S3 API): R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. Otherwise the local uploads folder.

interface Storage {
  put(name: string, data: Uint8Array): Promise<void>;
  get(name: string): Promise<Buffer | null>;
  remove(name: string): Promise<void>;
}

const disk: Storage = {
  async put(name, data) {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(UPLOAD_DIR, name), data);
  },
  async get(name) {
    return fs.promises.readFile(path.join(UPLOAD_DIR, name)).catch(() => null);
  },
  async remove(name) {
    await fs.promises.rm(path.join(UPLOAD_DIR, name), { force: true });
  },
};

function r2(): Storage | null {
  const { R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  if (!account || !bucket || !accessKeyId || !secretAccessKey) return null;
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const objectUrl = (name: string) => `https://${account}.r2.cloudflarestorage.com/${bucket}/${name}`;
  const call = async (name: string, init: RequestInit, okMissing = false) => {
    const res = await client.fetch(objectUrl(name), init);
    if (res.ok || (okMissing && res.status === 404)) return res;
    throw new Error(`File storage answered ${res.status} for ${name}.`);
  };
  return {
    async put(name, data) {
      await call(name, { method: 'PUT', body: data, headers: { 'Content-Type': contentType(name) } });
    },
    async get(name) {
      const res = await call(name, { method: 'GET' }, true);
      return res.status === 404 ? null : Buffer.from(await res.arrayBuffer());
    },
    async remove(name) {
      await call(name, { method: 'DELETE' }, true);
    },
  };
}

const storage = r2() || disk;

// ---------- Saving and reading ----------

export function parseDataUrl(dataUrl: string): { mime: string; data: Buffer } | null {
  const m = /^data:([a-z0-9.+/-]+)(;[a-z0-9=.+-]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), data: Buffer.from(m[3], 'base64') };
}

// Save a data URL as a file; returns its link
export async function saveDataUrl(dataUrl: string): Promise<string> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Not a file.');
  if (parsed.data.length > MAX_UPLOAD_BYTES) throw new Error('The file is too large (max 15 MB).');
  return saveFile(parsed.data, EXTENSIONS[parsed.mime] || 'bin');
}

// Save bytes made by the server (e.g. a page preview); returns its link
export async function saveFile(data: Buffer | Uint8Array, ext: string): Promise<string> {
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await storage.put(name, data);
  return `${UPLOAD_PREFIX}${name}`;
}

// A saved file by its name (null when there is none)
export async function readUpload(name: string): Promise<{ mime: string; data: Buffer } | null> {
  if (!SAFE_FILE.test(name)) return null;
  const data = await storage.get(name);
  return data ? { mime: contentType(name), data } : null;
}

// Remove a file saved here (ignored for anything else)
export async function removeFile(url: string | null | undefined) {
  const name = String(url || '').startsWith(UPLOAD_PREFIX) ? String(url).slice(UPLOAD_PREFIX.length) : '';
  if (SAFE_FILE.test(name)) await storage.remove(name);
}

// Read an attached file for server use (e.g. images sent to the AI): data URL or uploaded link
export async function readAttachment(url: string): Promise<{ mime: string; data: Buffer } | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return parseDataUrl(url);
  const name = url.startsWith(UPLOAD_PREFIX) ? url.slice(UPLOAD_PREFIX.length) : '';
  return readUpload(name).catch(() => null);
}
