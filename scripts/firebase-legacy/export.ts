// Moving to Supabase, step 1: save everything in the local Firebase emulator to migration/firebase-export.json
// (every Firestore collection and the sign-in accounts). Step 2 is scripts/import-to-supabase.ts.
//
// The emulator must be running: npm run firebase:emulators
// Usage: npm run migrate:export
import fs from 'fs';
import path from 'path';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const { initializeApp } = await import('firebase-admin/app');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');

const app = initializeApp({ projectId: 'demo-markup' });
const db = getFirestore(app);

// Firestore timestamps become ISO text
const plain = (value: any): any => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
};

const collections: Record<string, Record<string, any>[]> = {};
for (const col of await db.listCollections()) {
  // One document at a time: some old pins are very large
  const ids = (await col.select().get()).docs.map((d) => d.id);
  collections[col.id] = [];
  for (const id of ids) {
    const snap = await col.doc(id).get();
    if (snap.exists) collections[col.id].push({ ...plain(snap.data()), id });
  }
}

const accounts: any[] = [];
let pageToken: string | undefined;
do {
  const page = await getAuth(app).listUsers(1000, pageToken);
  for (const u of page.users) {
    accounts.push({
      uid: u.uid,
      email: u.email || null,
      emailVerified: u.emailVerified,
      displayName: u.displayName || null,
      photoURL: u.photoURL || null,
      providers: u.providerData.map((p) => p.providerId),
      createdAt: u.metadata.creationTime,
    });
  }
  pageToken = page.pageToken;
} while (pageToken);

const out = path.join(process.cwd(), 'migration', 'firebase-export.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), collections, accounts }, null, 1));
console.log(`Saved ${out}`);
for (const [name, docs] of Object.entries(collections)) console.log(`  ${name}: ${docs.length}`);
console.log(`  sign-in accounts: ${accounts.length}`);
process.exit(0);
