// Encryption for secrets kept on the server (e.g. WordPress Application Passwords): AES-256-GCM with a key from
// WEBREVIEW_SECRET_KEY. Locally the key is generated into .env on first use; in production set it in the
// hosting environment (or a secret manager) and never commit it.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function secretKey(): Buffer {
  let key = process.env.WEBREVIEW_SECRET_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') throw new Error('WEBREVIEW_SECRET_KEY is not set.');
    key = crypto.randomBytes(32).toString('base64');
    fs.appendFileSync(path.join(process.cwd(), '.env'), `\n# Encryption key for secrets stored by the server (keep private)\nWEBREVIEW_SECRET_KEY=${key}\n`);
    process.env.WEBREVIEW_SECRET_KEY = key;
    console.warn('Generated WEBREVIEW_SECRET_KEY and saved it to .env');
  }
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) throw new Error('WEBREVIEW_SECRET_KEY must be 32 bytes, base64-encoded.');
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(':');
  if (version !== 'v1') throw new Error('Unknown secret format.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
