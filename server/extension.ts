// Markup Chrome extension: connecting it to a member's account, and what it shows (unread notifications, the
// member's open pins). The extension never sees a password: the member approves it in the app and the extension
// gets its own access key, which can be disconnected at any time.
//
//   extensionConnect/{hash of state}  a pending approval (2 minutes), holding the new key until the extension claims it
//   extensionKeys/{hash of key}       a connected extension: whose it is, when it was last used
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';

const CONNECT_TTL_MS = 2 * 60 * 1000;
const KEY_PREFIX = 'mkx_';
const DONE = ['resolved', 'archived'];

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const validState = (state: unknown) => typeof state === 'string' && /^[A-Za-z0-9_-]{24,100}$/.test(state);

export interface ExtensionRequest extends Request {
  extensionUser?: { uid: string; name: string; email: string };
  extensionKeyId?: string;
}

// The member approves the extension in the app: a new key waits for the extension to claim it
export async function approveConnection(state: unknown, member: { uid: string; name: string; email: string }, browser: string) {
  if (!validState(state)) throw new Error('This connect link is not valid. Click Connect in the extension again.');
  const key = KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
  await adminDb.collection('extensionConnect').doc(hash(String(state))).set({
    key,
    uid: member.uid,
    browser: browser.slice(0, 120),
    expiresAt: Date.now() + CONNECT_TTL_MS,
  });
}

// The extension picks up its key (once)
export async function claimConnection(state: unknown) {
  if (!validState(state)) return null;
  const ref = adminDb.collection('extensionConnect').doc(hash(String(state)));
  const pending = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data() as any;
  });
  if (!pending || pending.expiresAt < Date.now()) return null;
  const user = (await adminDb.collection('users').doc(pending.uid).get()).data();
  if (!user || user.removed === true) return null;
  await adminDb.collection('extensionKeys').doc(hash(pending.key)).set({
    uid: pending.uid,
    browser: pending.browser || '',
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: FieldValue.serverTimestamp(),
  });
  return { key: pending.key as string, name: String(user.name || ''), email: String(user.email || '') };
}

// Requests from the extension carry "Authorization: Bearer mkx_…"
export async function requireExtension(req: ExtensionRequest, res: Response, next: NextFunction) {
  const key = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!key.startsWith(KEY_PREFIX)) return res.status(401).json({ error: 'Not connected.' });
  const id = hash(key);
  const ref = adminDb.collection('extensionKeys').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(401).json({ error: 'This extension was disconnected. Connect it again.' });
  const uid = String(snap.data()!.uid);
  const user = (await adminDb.collection('users').doc(uid).get()).data();
  if (!user || user.removed === true) {
    await ref.delete();
    return res.status(401).json({ error: 'This account no longer has access.' });
  }
  // Record use at most every 10 minutes
  const last = snap.data()!.lastUsedAt?.toMillis?.() || 0;
  if (Date.now() - last > 10 * 60 * 1000) ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});
  req.extensionUser = { uid, name: String(user.name || ''), email: String(user.email || '') };
  req.extensionKeyId = id;
  next();
}

export async function disconnect(keyId: string) {
  await adminDb.collection('extensionKeys').doc(keyId).delete();
}

const isClient = (author: any) => author?.role === 'Guest' || String(author?.id || '').startsWith('guest_');

// What the extension shows: unread count, latest notifications and the member's open pins
export async function extensionSummary(uid: string) {
  const [notesSnap, pinsSnap, projectsSnap] = await Promise.all([
    adminDb.collection('notifications').where('recipientUid', '==', uid).orderBy('createdAt', 'desc').limit(30).get(),
    adminDb.collection('pins').get(),
    adminDb.collection('projects').get(),
  ]);
  const notifications = notesSnap.docs.map((d) => {
    const n = d.data();
    return {
      id: d.id,
      type: n.type,
      title: n.title,
      message: n.message,
      projectId: n.projectId || null,
      pinId: n.pinId || null,
      read: n.read === true,
      createdAt: n.createdAt?.toMillis?.() || null,
      actor: { name: n.actor?.name || '', isGuest: !!n.actor?.isGuest },
    };
  });

  const projects = new Map(projectsSnap.docs.map((d) => [d.id, d.data() as any]));
  const mine = (pin: any, project: any) => {
    if (pin.assignedTo?.id) return String(pin.assignedTo.id) === uid;
    const assigned: string[] = Array.isArray(project.assigneeIds) && project.assigneeIds.length ? project.assigneeIds.map(String) : [String(project.ownerId || '')];
    return assigned.includes(uid);
  };
  const pins = pinsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((pin) => {
      const project = projects.get(pin.projectId);
      return project && !pin.deletedAt && !DONE.includes(pin.status) && mine(pin, project);
    })
    .map((pin) => ({
      id: pin.id,
      projectId: pin.projectId,
      projectName: String(projects.get(pin.projectId)?.name || ''),
      number: pin.number ?? null,
      title: String(pin.title || pin.comments?.[0]?.text || '').slice(0, 160),
      status: pin.status,
      priority: pin.priority || null,
      fromClient: isClient(pin.author),
      createdAt: Date.parse(String(pin.createdAt || '')) || null,
      comments: (pin.comments || []).length,
    }))
    // Needs action first (waiting on customers last), then oldest first
    .sort((a, b) => Number(a.status === 'waiting_on_customer') - Number(b.status === 'waiting_on_customer') || (a.createdAt || 0) - (b.createdAt || 0));

  return {
    unread: notifications.filter((n) => !n.read).length,
    notifications,
    openPins: pins.slice(0, 100),
    openPinCount: pins.length,
  };
}

export async function markRead(uid: string, ids: unknown) {
  const list = Array.isArray(ids) ? ids.map(String).slice(0, 100) : [];
  const snap = list.length
    ? await Promise.all(list.map((id) => adminDb.collection('notifications').doc(id).get()))
    : (await adminDb.collection('notifications').where('recipientUid', '==', uid).where('read', '==', false).get()).docs;
  const batch = adminDb.batch();
  let count = 0;
  for (const doc of snap) {
    if (!doc.exists || doc.data()?.recipientUid !== uid || doc.data()?.read === true) continue;
    batch.update(doc.ref, { read: true, readAt: new Date().toISOString() });
    count++;
  }
  if (count) await batch.commit();
  return count;
}
