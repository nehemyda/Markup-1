// Moving to Cloudflare: copy the files in ./uploads (pin screenshots, attachments, card previews) to the R2 bucket, so
// the links in existing pins keep working. Safe to run again: files already in the bucket are skipped.
//
// Needs R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env.
// Usage: npx tsx scripts/copy-uploads-to-r2.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { AwsClient } from 'aws4fetch';
import { CONTENT_TYPES, SAFE_FILE, UPLOAD_DIR } from '../server/uploads';

const { R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
if (!account || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env first.');
  process.exit(1);
}
const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
const objectUrl = (name: string) => `https://${account}.r2.cloudflarestorage.com/${bucket}/${name}`;

const names = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).filter((n) => SAFE_FILE.test(n)) : [];
let copied = 0;
let skipped = 0;
for (const name of names) {
  if ((await client.fetch(objectUrl(name), { method: 'HEAD' })).ok) {
    skipped++;
    continue;
  }
  const res = await client.fetch(objectUrl(name), {
    method: 'PUT',
    body: fs.readFileSync(path.join(UPLOAD_DIR, name)),
    headers: { 'Content-Type': CONTENT_TYPES[name.split('.').pop()!] || 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`Copying ${name} failed: ${res.status} ${await res.text()}`);
  copied++;
}
console.log(`Copied ${copied} files to ${bucket}; ${skipped} were already there.`);
