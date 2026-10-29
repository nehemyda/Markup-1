// Prints the server's private settings from .env as JSON for `wrangler secret bulk`, so they reach Cloudflare without
// being typed or shown:   node scripts/cloudflare-secrets.mjs | npx wrangler secret bulk
// Public settings (APP_URL, R2_ACCOUNT_ID, R2_BUCKET, SMTP_PORT) are in wrangler.jsonc instead.
import fs from 'fs';
import dotenv from 'dotenv';

const NAMES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_ADMIN_EMAILS',
  'GEMINI_API_KEY',
  // Must stay the same: saved WordPress passwords are encrypted with it
  'VPIN_SECRET_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];

const env = dotenv.parse(fs.readFileSync('.env'));
env.VPIN_SECRET_KEY ||= env.WEBREVIEW_SECRET_KEY;
const missing = NAMES.filter((n) => !env[n] && !n.startsWith('SMTP_') && n !== 'MAIL_FROM');
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}
process.stdout.write(JSON.stringify(Object.fromEntries(NAMES.filter((n) => env[n]).map((n) => [n, env[n]]))));
