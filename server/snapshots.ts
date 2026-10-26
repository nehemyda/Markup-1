// Local development only: save the emulator's data every 10 minutes, so a crash of the Firestore emulator (it can't
// be read once it runs out of memory) loses at most a few minutes of work. Each snapshot goes to
// emulator-data-autosave/<date-time>; the last 12 are kept. Once a snapshot is complete it also replaces
// ./emulator-data, which `npm run emulators` loads on start. A failed save never touches ./emulator-data.
import fs from 'fs';
import path from 'path';
import { useEmulator } from './firebaseAdmin';

const EVERY_MS = 10 * 60 * 1000;
const KEEP = 12;
const HUB = process.env.FIREBASE_EMULATOR_HUB || '127.0.0.1:4400';
const ROOT = process.cwd();
const AUTOSAVE_DIR = path.join(ROOT, 'emulator-data-autosave');
const LIVE_DIR = path.join(ROOT, 'emulator-data');

let running = false;

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}

// A snapshot is usable when the export metadata and the Firestore data file are there
function isComplete(dir: string) {
  const data = path.join(dir, 'firestore_export', 'all_namespaces', 'all_kinds', 'output-0');
  return fs.existsSync(path.join(dir, 'firebase-export-metadata.json')) && fs.existsSync(data) && fs.statSync(data).size > 0;
}

export async function saveSnapshot(): Promise<string | null> {
  if (running) return null;
  running = true;
  const target = path.join(AUTOSAVE_DIR, stamp());
  try {
    fs.mkdirSync(AUTOSAVE_DIR, { recursive: true });
    const res = await fetch(`http://${HUB}/_admin/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: target, initiatedBy: 'auto-snapshot' }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok || !isComplete(target)) throw new Error(`export failed (${res.status})`);

    // Make it the data the emulators load next time: copy aside, then swap in one step
    const staging = `${LIVE_DIR}.next`;
    const previous = `${LIVE_DIR}.prev`;
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(previous, { recursive: true, force: true });
    fs.cpSync(target, staging, { recursive: true });
    if (fs.existsSync(LIVE_DIR)) fs.renameSync(LIVE_DIR, previous);
    fs.renameSync(staging, LIVE_DIR);
    fs.rmSync(previous, { recursive: true, force: true });

    // Keep the newest snapshots only
    const all = fs.readdirSync(AUTOSAVE_DIR).filter((n) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/.test(n)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
      fs.rmSync(path.join(AUTOSAVE_DIR, old), { recursive: true, force: true });
    }
    return target;
  } catch (err: any) {
    fs.rmSync(target, { recursive: true, force: true });
    console.warn(`Auto-snapshot skipped: ${err?.message || err} (./emulator-data was not changed)`);
    return null;
  } finally {
    running = false;
  }
}

export function startAutoSnapshots() {
  if (!useEmulator) return;
  const run = () => saveSnapshot().then((dir) => dir && console.log(`Auto-snapshot saved: ${path.relative(ROOT, dir)}`));
  setTimeout(run, 60_000);
  setInterval(run, EVERY_MS).unref();
}
