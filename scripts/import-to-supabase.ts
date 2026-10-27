// Moving to Supabase, step 2: load migration/firebase-export.json (made by scripts/firebase-legacy/export.ts) into
// the Supabase database. Safe to run again: rows are saved by id, so a second run updates instead of duplicating.
//
// Before running:
//   1. The tables exist (supabase/migrations/*.sql run in the Supabase SQL editor)
//   2. .env has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//
// Team members get a Supabase sign-in account with the same email. Passwords can't be moved from Firebase, so
// members sign in with Google, or use "Forgot?" on the sign-in page once to set a new password.
//
// Usage: npm run migrate:import
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../server/db';
import { Table, toRow } from '../src/lib/rows';

const file = path.join(process.cwd(), 'migration', 'firebase-export.json');
if (!fs.existsSync(file)) {
  console.error(`Missing ${file}. Run "npm run migrate:export" first (with the Firebase emulator running).`);
  process.exit(1);
}
const { collections, accounts } = JSON.parse(fs.readFileSync(file, 'utf8')) as {
  collections: Record<string, Record<string, any>[]>;
  accounts: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }[];
};
const docs = (name: string) => collections[name] || [];

// Firestore ids aren't uuids; these tables use uuid ids, so derive a stable one from the old id
const uuidFrom = (id: string) => {
  const h = crypto.createHash('md5').update(id).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

async function save(table: Table, records: Record<string, any>[]) {
  for (let i = 0; i < records.length; i += 200) {
    const rows = records.slice(i, i + 200).map((r) => toRow(table, r));
    const { error } = await supabaseAdmin.from(table).upsert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${records.length}`);
}

// ---------- Sign-in accounts for team members ----------

async function supabaseAccountsByEmail() {
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Listing Supabase accounts failed: ${error.message}`);
    const users = data.users as { id: string; email?: string }[];
    users.forEach((u) => u.email && byEmail.set(u.email.toLowerCase(), u.id));
    if (users.length < 1000) return byEmail;
  }
}

console.log('Sign-in accounts:');
const existing = await supabaseAccountsByEmail();
const firebaseAccount = new Map(accounts.map((a) => [a.uid, a]));
const members: Record<string, any>[] = [];
for (const user of docs('users')) {
  const email = String(user.email || firebaseAccount.get(user.id)?.email || '').toLowerCase();
  if (!email) {
    console.warn(`  skipped member ${user.id}: no email`);
    continue;
  }
  let authId = existing.get(email);
  if (!authId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: user.name || firebaseAccount.get(user.id)?.displayName || '', avatar_url: user.avatar || '' },
    });
    if (error) throw new Error(`Creating the account for ${email} failed: ${error.message}`);
    authId = data.user.id;
    console.log(`  created ${email}`);
  } else {
    console.log(`  ${email} already has an account`);
  }
  // The member keeps their old id, so projects, pins and notifications still point at them
  members.push({ ...user, email, authId });
}

// ---------- Data ----------

console.log('Data:');
await save('users', members);
await save('invites', docs('invites'));
await save('folders', docs('folders'));

// Pins record their project (older pins only had the page)
const projectByAsset = new Map<string, string>();
for (const p of docs('projects')) for (const a of p.assets || []) if (a?.id) projectByAsset.set(a.id, p.id);
await save('projects', docs('projects').map((p) => ({ ...p, assigneeIds: p.assigneeIds || [], assets: p.assets || [] })));
await save('pins', docs('pins').map((p) => ({ ...p, projectId: p.projectId || projectByAsset.get(p.assetId) || null, comments: p.comments || [] })));

await save('notifications', docs('notifications'));
// Settings rows hold the whole old document as their value
const settings = docs('settings').map(({ id, ...value }) => ({ id, value }));
if (settings.length) {
  const { error } = await supabaseAdmin.from('settings').upsert(settings);
  if (error) throw new Error(`settings: ${error.message}`);
}
console.log(`  settings: ${settings.length}`);

await save('ai_usage', docs('aiUsage').map((u) => ({ ...u, id: uuidFrom(u.id) })));
await save('audit_log', docs('auditLog').map((a) => ({ ...a, id: uuidFrom(a.id) })));
await save('wp_sites', docs('wpSites'));
await save('wp_site_secrets', docs('wpSiteSecrets'));
await save('wp_fixes', docs('wpFixes').map(({ check, ...fix }) => ({ ...fix, pageCheck: check ?? fix.pageCheck ?? null })));
await save('chat_webhooks', docs('chatWebhooks'));
await save('extension_keys', docs('extensionKeys'));

console.log('\nDone. Monthly AI totals are worked out from ai_usage, so aiUsageMonthly is not copied.');
console.log('Members: sign in with Google, or click "Forgot?" on the sign-in page to set a password.');
process.exit(0);
