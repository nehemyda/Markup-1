// Live data from Supabase: each subscription loads the rows once, then follows changes (Supabase Realtime) and
// re-reads just the row that changed. Who sees what is decided by the database's Row Level Security rules
// (supabase/migrations), e.g. guests only get their shared project.
import { supabase } from './supabase';
import { apiFetch } from './api';
import { fromRow, millis, SERVER_FIELDS, Table, toRow as mapRow } from './rows';
import { Project, Pin, Teammate, AuthUser, Folder, WpSite, WpFix, NotificationItem, Revision } from '../types';

const PAGE = 1000;

// Browser saves leave out fields only the server sets (the database also keeps them as they are)
const toRow = (table: Table, record: Record<string, any>) => {
  const skip = SERVER_FIELDS[table] || [];
  return mapRow(table, Object.fromEntries(Object.entries(record).filter(([key]) => !skip.includes(key))));
};
const snake = (field: string) => field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
let channelCount = 0;

interface LiveOptions {
  table: Table;
  // Only rows where field = value
  field?: string;
  value?: string;
  // Newest first, at most this many (the whole list is read again on any change)
  newestBy?: string;
  limit?: number;
}

// A live copy of a table (or the rows matching one filter); returns the function that stops it
function liveRows<T extends { id: string }>(opts: LiveOptions, onUpdate: (rows: T[]) => void): () => void {
  const rows = new Map<string, T>();
  const column = opts.field ? snake(opts.field) : null;
  let closed = false;
  const emit = () => !closed && onUpdate([...rows.values()]);
  const select = () => {
    const query = supabase.from(opts.table).select('*');
    return column ? query.eq(column, opts.value!) : query;
  };
  const report = (what: string, error: { message: string }) => console.warn(`Could not ${what} ${opts.table}:`, error.message);

  const loadAll = async () => {
    const fresh: T[] = [];
    if (opts.newestBy) {
      const { data, error } = await select().order(snake(opts.newestBy), { ascending: false }).limit(opts.limit || PAGE);
      if (error) return report('load', error);
      fresh.push(...(data || []).map((r) => fromRow<T>(r)));
    } else {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await select().order('id').range(from, from + PAGE - 1);
        if (error) return report('load', error);
        fresh.push(...(data || []).map((r) => fromRow<T>(r)));
        if (!data || data.length < PAGE) break;
      }
    }
    rows.clear();
    fresh.forEach((row) => rows.set(row.id, row));
    emit();
  };

  // Changes to the same row are applied in order
  const pending = new Map<string, Promise<void>>();
  const reloadRow = (id: string) => {
    const next = (pending.get(id) || Promise.resolve()).then(async () => {
      const { data, error } = await select().eq('id', id).maybeSingle();
      if (error) return report('reload', error);
      if (data) rows.set(id, fromRow<T>(data));
      else rows.delete(id);
      emit();
    });
    pending.set(id, next);
    next.finally(() => pending.get(id) === next && pending.delete(id));
  };

  let fullTimer: ReturnType<typeof setTimeout> | null = null;
  const reloadAllSoon = () => {
    if (fullTimer) return;
    fullTimer = setTimeout(() => {
      fullTimer = null;
      loadAll();
    }, 150);
  };

  const channel = supabase
    .channel(`live:${opts.table}:${column || 'all'}:${opts.value || ''}:${++channelCount}`)
    .on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: opts.table, ...(column ? { filter: `${column}=eq.${opts.value}` } : {}) },
      (change: any) => {
        const id = String(change.new?.id || change.old?.id || '');
        if (opts.newestBy || !id) return reloadAllSoon();
        if (change.eventType === 'DELETE') {
          rows.delete(id);
          emit();
        } else {
          reloadRow(id);
        }
      }
    )
    .subscribe((status: string, err?: Error) => {
      // (Re)connected: read everything again, so nothing missed while offline is lost
      if (status === 'SUBSCRIBED') loadAll();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn(`Live updates for ${opts.table} interrupted:`, err?.message || status);
    });

  return () => {
    closed = true;
    if (fullTimer) clearTimeout(fullTimer);
    supabase.removeChannel(channel);
  };
}

// Saves fields of an existing row, or adds the row when it doesn't exist yet. (Guests may change their shared
// project but not add projects, so this doesn't use an upsert, which also needs permission to add.)
async function saveRow(table: Table, record: { id: string } & Record<string, any>) {
  const row = toRow(table, record);
  const { data, error } = await supabase.from(table).update(row).eq('id', record.id).select('id');
  if (error) throw new Error(error.message);
  if (data?.length) return;
  const { error: insertError } = await supabase.from(table).insert(row);
  if (insertError) throw new Error(insertError.message);
}

async function upsert(table: Table, record: Record<string, any>) {
  const { error } = await supabase.from(table).upsert(toRow(table, record));
  if (error) throw new Error(error.message);
}

async function update(table: Table, id: string, patch: Record<string, any>) {
  const { error } = await supabase.from(table).update(toRow(table, patch)).eq('id', id);
  if (error) throw new Error(error.message);
}

async function remove(table: Table, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// One project (guests can only read the project in their link)
export function subscribeProject(projectId: string, onUpdate: (project: Project | null) => void): () => void {
  return liveRows<Project>({ table: 'projects', field: 'id', value: projectId }, (rows) => onUpdate(rows[0] || null));
}

// WordPress site linked to a project (null = not connected)
export function subscribeWpSite(projectId: string, onUpdate: (site: WpSite | null) => void): () => void {
  return liveRows<WpSite & { id: string }>({ table: 'wp_sites', field: 'id', value: projectId }, (rows) => onUpdate(rows[0] || null));
}

// AI fix proposals for one pin, newest first
export function subscribeWpFixes(pinId: string, onUpdate: (fixes: WpFix[]) => void): () => void {
  return liveRows<WpFix>({ table: 'wp_fixes', field: 'pinId', value: pinId }, (fixes) =>
    onUpdate([...fixes].sort((a, b) => millis(b.proposedAt) - millis(a.proposedAt)))
  );
}

// The signed-in person's notifications, newest first (the server creates them)
export function subscribeNotifications(uid: string, onUpdate: (items: NotificationItem[]) => void): () => void {
  return liveRows<any>({ table: 'notifications', field: 'recipientUid', value: uid, newestBy: 'createdAt', limit: 50 }, (rows) =>
    onUpdate(
      rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        createdAt: millis(n.createdAt) || Date.now(),
        actor: n.actor || { id: '', name: 'Someone' },
        projectId: n.projectId,
        projectName: n.projectName,
        pinId: n.pinId,
        pinNumber: n.pinNumber,
        assetId: n.assetId,
        isRead: n.read === true,
      }))
    )
  );
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() }).in('id', ids);
  if (error) throw new Error(error.message);
}

export function subscribeProjects(onProjectsUpdate: (projects: Project[]) => void): () => void {
  return liveRows<Project>({ table: 'projects' }, onProjectsUpdate);
}

export async function saveProject(project: Project): Promise<void> {
  try {
    await saveRow('projects', project);
  } catch (err) {
    console.warn('Failed saving project:', err);
  }
}

// All pins (members), or only one project's pins (guests)
export function subscribePins(onPinsUpdate: (pins: Pin[]) => void, projectId?: string): () => void {
  return liveRows<Pin>(projectId ? { table: 'pins', field: 'projectId', value: projectId } : { table: 'pins' }, onPinsUpdate);
}

// Files are stored on the server; the pin keeps only a short link (embedded files made pins too big)
async function storeFile(url: string | undefined): Promise<string | undefined> {
  if (!url || !url.startsWith('data:')) return url;
  const res = await apiFetch('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl: url }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) throw new Error(body.error || 'Could not upload the file.');
  return body.url;
}

async function storeAttachments<T extends { url: string }>(list: T[] | undefined): Promise<T[] | undefined> {
  if (!list) return list;
  return Promise.all(list.map(async (a) => ({ ...a, url: (await storeFile(a.url)) || a.url })));
}

export async function externalizePinFiles(pin: Pin): Promise<Pin> {
  return {
    ...pin,
    screenshotUrl: await storeFile(pin.screenshotUrl),
    attachments: await storeAttachments(pin.attachments),
    comments: await Promise.all(pin.comments.map(async (c) => ({ ...c, attachments: await storeAttachments(c.attachments) }))),
  };
}

export async function savePin(pin: Pin): Promise<void> {
  try {
    await upsert('pins', await externalizePinFiles(pin));
  } catch (err) {
    console.warn('Failed saving pin:', err);
  }
}

export async function deletePin(pinId: string): Promise<void> {
  try {
    await remove('pins', pinId);
  } catch (err) {
    console.warn('Failed deleting pin:', err);
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  try {
    await remove('projects', projectId);
  } catch (err) {
    console.warn('Failed deleting project:', err);
  }
}

// Delete all pins on the given pages (used when a project is deleted)
export async function deletePinsForAssets(assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) return;
  const { error } = await supabase.from('pins').delete().in('asset_id', assetIds);
  if (error) console.warn('Failed deleting project pins:', error.message);
}

// ---------- Team members ----------
// Members are signed-up accounts (users table); removed members keep their row with removed = true.
// Pending invitations live in invites (id = the email in lower case) until that person creates an account.

const INVITE_ID_PREFIX = 'invite:';

export function isInviteId(id: string): boolean {
  return id.startsWith(INVITE_ID_PREFIX);
}

function inviteRowId(email: string): string {
  return email.trim().toLowerCase();
}

// Older profiles stored the long label; the Team page uses the short role names
export function normalizeRole(role: string | undefined): Teammate['role'] {
  if (!role || role === 'Member (Editor & Annotator)') return 'Member';
  return role as Teammate['role'];
}

// Live team list: active members plus pending invitations
export function subscribeTeam(onTeamUpdate: (team: Teammate[]) => void): () => void {
  let members: Teammate[] = [];
  let invites: Teammate[] = [];
  const emit = () => onTeamUpdate([...members, ...invites]);

  const stopUsers = liveRows<AuthUser & { department?: string; removed?: boolean; isMasterAdmin?: boolean }>({ table: 'users' }, (users) => {
    members = users
      .filter((u) => !u.removed)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: normalizeRole(u.role),
        status: u.status || 'offline',
        cursorColor: u.cursorColor || '#6366f1',
        department: u.department,
        isMasterAdmin: u.isMasterAdmin === true,
      }));
    emit();
  });

  const stopInvites = liveRows<{ id: string; name: string; email: string; role: string; invitedBy?: string }>({ table: 'invites' }, (rows) => {
    invites = rows.map((inv) => ({
      id: INVITE_ID_PREFIX + inv.id,
      name: inv.name,
      email: inv.email,
      avatar: '',
      role: normalizeRole(inv.role),
      status: 'offline',
      cursorColor: '#94a3b8',
      lastActive: 'Invitation pending',
      createdBy: inv.invitedBy,
      pendingInvite: true,
    }));
    emit();
  });

  return () => {
    stopUsers();
    stopInvites();
  };
}

// Saves the invitation (the database rules decide which roles this person may invite with). Throws on failure.
export async function inviteMember(name: string, email: string, role: Teammate['role'], invitedBy: string): Promise<void> {
  await upsert('invites', {
    id: inviteRowId(email),
    name: name.trim() || email.split('@')[0].replace(/[._]/g, ' '),
    email: email.trim(),
    role,
    invitedBy,
    invitedAt: new Date().toISOString(),
  });
}

// Link that opens the sign-up form with the invited email filled in (until the app sends invite emails itself)
export function inviteLink(email: string) {
  return `${window.location.origin}/?invite=${encodeURIComponent(email.trim())}`;
}

export async function updateMemberRole(id: string, role: Teammate['role']): Promise<void> {
  try {
    if (isInviteId(id)) await update('invites', id.slice(INVITE_ID_PREFIX.length), { role });
    else await update('users', id, { role });
  } catch (err) {
    console.warn('Failed updating member role:', err);
  }
}

export async function removeMember(id: string): Promise<void> {
  try {
    if (isInviteId(id)) await remove('invites', id.slice(INVITE_ID_PREFIX.length));
    else await update('users', id, { removed: true, removedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('Failed removing member:', err);
  }
}

// ---------- Folders (group projects, e.g. per partner) ----------
export function subscribeFolders(onFoldersUpdate: (folders: Folder[]) => void): () => void {
  return liveRows<Folder>({ table: 'folders' }, onFoldersUpdate);
}

export async function saveFolder(folder: Folder): Promise<void> {
  try {
    await upsert('folders', folder);
  } catch (err) {
    console.warn('Failed saving folder:', err);
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  try {
    await remove('folders', folderId);
  } catch (err) {
    console.warn('Failed deleting folder:', err);
  }
}

// ---------- Workspace settings (one row each in settings) ----------

export function subscribeSetting<T extends object>(id: string, onUpdate: (value: Partial<T> | null) => void): () => void {
  return liveRows<{ id: string; value: Partial<T> }>({ table: 'settings', field: 'id', value: id }, (rows) => onUpdate(rows[0]?.value ?? null));
}

export async function readSetting<T extends object>(id: string): Promise<Partial<T> | null> {
  const { data, error } = await supabase.from('settings').select('value').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.value as Partial<T>) ?? null;
}

// Changes only the given fields (admins; the database rules check it)
export async function mergeSetting(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.rpc('settings_merge', { p_id: id, p_patch: { ...patch, updatedAt: new Date().toISOString() } });
  if (error) throw new Error(error.message);
}

// ---------- AI Credits (admins) ----------

// Monthly totals (newest first). They are a database view, so any new AI request reloads them.
export function subscribeAiMonths<T>(onUpdate: (months: T[]) => void): () => void {
  let closed = false;
  const load = async () => {
    const { data, error } = await supabase.from('ai_usage_monthly').select('*').order('month', { ascending: false });
    if (error) return console.warn('Could not load AI usage totals:', error.message);
    if (!closed) onUpdate((data || []).map((r) => fromRow<T>(r)));
  };
  const stop = liveRows({ table: 'ai_usage', newestBy: 'at', limit: 1 }, () => load());
  return () => {
    closed = true;
    stop();
  };
}

// The latest AI requests of one month
export function subscribeAiUsage<T extends { id: string }>(month: string, onUpdate: (records: T[]) => void): () => void {
  return liveRows<T>({ table: 'ai_usage', field: 'month', value: month, newestBy: 'at', limit: 25 }, onUpdate);
}

// ---------- Client revisions ----------

// A project's submitted revisions, newest first
export function subscribeRevisions(projectId: string, onUpdate: (revisions: Revision[]) => void): () => void {
  return liveRows<Revision>({ table: 'revisions', field: 'projectId', value: projectId }, (rows) =>
    onUpdate([...rows].sort((a, b) => b.number - a.number))
  );
}

// Client pins not submitted yet (a team member's pins are not part of client revisions)
export const isClientPin = (pin: Pin) => pin.author?.role === 'Guest' || String(pin.author?.id || '').startsWith('guest_');
export const unsentClientPins = (pins: Pin[], projectId: string) =>
  pins.filter((p) => p.projectId === projectId && !p.deletedAt && isClientPin(p) && (p.revision === null || p.revision === undefined));
