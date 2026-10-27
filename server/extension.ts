// Markup Chrome extension: connecting it to a member's account, and what it shows (unread notifications, the
// member's open pins). The extension never sees a password: the member approves it in the app and the extension
// gets its own access key, which can be disconnected at any time.
//
//   extension_connect (id = hash of state)  a pending approval (2 minutes), holding the new key until the extension claims it
//   extension_keys (id = hash of key)       a connected extension: whose it is, when it was last used
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { deleteRow, findRows, getRow, insertRow, now, supabaseAdmin, updateRow, upsertRow } from './db';
import { fromRow, millis } from '../src/lib/rows';

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
  await upsertRow('extension_connect', {
    id: hash(String(state)),
    key,
    uid: member.uid,
    browser: browser.slice(0, 120),
    expiresAt: Date.now() + CONNECT_TTL_MS,
  });
}

// The extension picks up its key (once)
export async function claimConnection(state: unknown) {
  if (!validState(state)) return null;
  // Taking the row out is the claim: only one request can get it
  const { data, error } = await supabaseAdmin.from('extension_connect').delete().eq('id', hash(String(state))).select('*');
  if (error) throw new Error(error.message);
  const pending = data?.[0] ? fromRow(data[0]) : null;
  if (!pending || Number(pending.expiresAt) < Date.now()) return null;
  const user = await getRow('users', pending.uid);
  if (!user || user.removed === true) return null;
  await insertRow('extension_keys', {
    id: hash(pending.key),
    uid: pending.uid,
    browser: pending.browser || '',
    createdAt: now(),
    lastUsedAt: now(),
  });
  return { key: pending.key as string, name: String(user.name || ''), email: String(user.email || '') };
}

// Requests from the extension carry "Authorization: Bearer mkx_…"
export async function requireExtension(req: ExtensionRequest, res: Response, next: NextFunction) {
  const key = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!key.startsWith(KEY_PREFIX)) return res.status(401).json({ error: 'Not connected.' });
  const id = hash(key);
  const saved = await getRow('extension_keys', id);
  if (!saved) return res.status(401).json({ error: 'This extension was disconnected. Connect it again.' });
  const uid = String(saved.uid);
  const user = await getRow('users', uid);
  if (!user || user.removed === true) {
    await deleteRow('extension_keys', id);
    return res.status(401).json({ error: 'This account no longer has access.' });
  }
  // Record use at most every 10 minutes
  if (Date.now() - millis(saved.lastUsedAt) > 10 * 60 * 1000) updateRow('extension_keys', id, { lastUsedAt: now() }).catch(() => {});
  req.extensionUser = { uid, name: String(user.name || ''), email: String(user.email || '') };
  req.extensionKeyId = id;
  next();
}

export async function disconnect(keyId: string) {
  await deleteRow('extension_keys', keyId);
}

const isClient = (author: any) => author?.role === 'Guest' || String(author?.id || '').startsWith('guest_');

// What the extension shows: unread count, latest notifications and the member's open pins
export async function extensionSummary(uid: string) {
  const [notes, pinRows, projectRows] = await Promise.all([
    supabaseAdmin.from('notifications').select('*').eq('recipient_uid', uid).order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data || []).map((r) => fromRow(r));
      }),
    findRows('pins'),
    findRows('projects'),
  ]);
  const notifications = notes.map((n) => {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      projectId: n.projectId || null,
      pinId: n.pinId || null,
      read: n.read === true,
      createdAt: millis(n.createdAt) || null,
      actor: { name: n.actor?.name || '', isGuest: !!n.actor?.isGuest },
    };
  });

  const projects = new Map(projectRows.map((p) => [p.id, p]));
  const mine = (pin: any, project: any) => {
    if (pin.assignedTo?.id) return String(pin.assignedTo.id) === uid;
    const assigned: string[] = Array.isArray(project.assigneeIds) && project.assigneeIds.length ? project.assigneeIds.map(String) : [String(project.ownerId || '')];
    return assigned.includes(uid);
  };
  const pins = pinRows
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
  // Only this person's unread notifications (all of them when no ids are given)
  let query = supabaseAdmin.from('notifications').update({ read: true, read_at: now() }).eq('recipient_uid', uid).eq('read', false);
  if (list.length) query = query.in('id', list);
  const { data, error } = await query.select('id');
  if (error) throw new Error(error.message);
  return (data || []).length;
}
