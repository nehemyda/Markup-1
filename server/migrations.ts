// One-time data fixes, safe to run on every start.
import { adminDb } from './firebaseAdmin';

// Pins record their project (projectId) so security rules can limit guests to their shared project.
export async function addProjectIdToPins() {
  const [pins, projects] = await Promise.all([adminDb.collection('pins').get(), adminDb.collection('projects').get()]);
  const projectByAsset = new Map<string, string>();
  projects.forEach((p) => (p.data().assets || []).forEach((a: any) => a?.id && projectByAsset.set(a.id, p.id)));
  const batch = adminDb.batch();
  let count = 0;
  pins.forEach((pin) => {
    const data = pin.data();
    const projectId = projectByAsset.get(data.assetId);
    if (!data.projectId && projectId) {
      batch.update(pin.ref, { projectId });
      count++;
    }
  });
  if (count) await batch.commit();
  return count;
}

// Files used to be embedded in pins as data URLs (screenshots and attachments). Move them to stored files and keep
// links, so pins stay small. Reads one pin at a time because some of the old pins are very large.
export async function moveEmbeddedFilesOut() {
  const { saveDataUrl } = await import('./uploads');
  const ids = (await adminDb.collection('pins').select().get()).docs.map((d) => d.id);
  let moved = 0;
  for (const id of ids) {
    const ref = adminDb.collection('pins').doc(id);
    const pin = (await ref.get()).data();
    if (!pin) continue;
    let changed = false;
    const fix = (url: unknown) => {
      if (typeof url === 'string' && url.startsWith('data:')) {
        try {
          changed = true;
          moved++;
          return saveDataUrl(url);
        } catch {
          return url;
        }
      }
      return url;
    };
    const fixList = (list: any[] | undefined) => (Array.isArray(list) ? list.map((a) => (a && a.url ? { ...a, url: fix(a.url) } : a)) : list);
    const update: Record<string, unknown> = {};
    if (pin.screenshotUrl) update.screenshotUrl = fix(pin.screenshotUrl);
    if (pin.attachments) update.attachments = fixList(pin.attachments);
    if (pin.comments) update.comments = pin.comments.map((c: any) => (c?.attachments ? { ...c, attachments: fixList(c.attachments) } : c));
    if (changed) await ref.update(update);
  }
  return moved;
}
