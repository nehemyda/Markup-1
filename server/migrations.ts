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
