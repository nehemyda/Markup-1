// In-app notifications. The server watches pins and decides who to tell, so a client (or a guest) can't skip or
// fake one. Each notification is saved for one person (notifications table) and shows in their bell on any device.
//
// Who is told:
//   new pin              → the project's assigned developers (or its creator when nobody is assigned) + the pin's assignee
//   new comment          → the pin's assignee, its author and everyone who commented (team members only);
//                          a client's (guest's) comment also goes to the project's assigned developers
//   @mention             → the person mentioned
//   pin assigned         → the new assignee
//   client replies on a pin "Waiting on customer" → the pin reopens (status Open)
// The person who did it is never told about their own action.
import { findRows, getRow, now, supabaseAdmin, updateRow } from './db';
import { toRow } from '../src/lib/rows';
import { toMillis } from '../src/lib/time';

const NEW_PIN_MS = 10 * 60 * 1000;
import { queueChatAlert } from './googleChat';
import { checkRevisionDone, projectPeople } from './revisions';

type Person = { id: string; name: string; avatar?: string; email?: string; isGuest: boolean };

interface PinState {
  commentIds: Set<string>;
  assigneeId: string | null;
}

const known = new Map<string, PinState>();

const isGuestId = (id: string) => !id || id.startsWith('guest_');

function personOf(author: any): Person {
  const id = String(author?.id || '');
  return {
    id,
    name: String(author?.name || 'Someone').slice(0, 80),
    avatar: author?.avatar ? String(author.avatar).slice(0, 500) : '',
    email: author?.email ? String(author.email) : '',
    isGuest: author?.role === 'Guest' || isGuestId(id),
  };
}

function stateOf(pin: any): PinState {
  return {
    commentIds: new Set((pin.comments || []).map((c: any) => String(c.id))),
    assigneeId: pin.assignedTo?.id ? String(pin.assignedTo.id) : null,
  };
}

// Team members who can receive notifications (signed-up and not removed), by id
async function teamMembers() {
  const users = await findRows('users', { removed: false });
  return new Map(users.map((u) => [u.id, { id: u.id, name: String(u.name || '') }]));
}

async function projectOf(projectId: string) {
  if (!projectId) return null;
  return getRow('projects', projectId);
}

// "@Name" or "@First" in a comment
function mentionedIn(text: string, team: Map<string, { id: string; name: string }>) {
  const lower = ` ${String(text || '').toLowerCase()}`;
  const ids: string[] = [];
  for (const member of team.values()) {
    const name = member.name.trim().toLowerCase();
    if (!name) continue;
    const first = name.split(/\s+/)[0];
    if (lower.includes(`@${name}`) || new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) ids.push(member.id);
  }
  return ids;
}

const short = (text: string, max = 140) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

async function send(
  recipients: Iterable<string>,
  actor: Person,
  key: string,
  data: { type: 'pin' | 'comment' | 'mention' | 'assignment'; title: string; message: string; pin: any; project: any },
  team: Map<string, { id: string; name: string }>
) {
  const rows: Record<string, any>[] = [];
  for (const uid of new Set(recipients)) {
    if (!uid || uid === actor.id || !team.has(uid)) continue;
    // One per event and person (the id makes a repeat harmless)
    rows.push(toRow('notifications', {
      id: `${key}__${uid}`.replace(/\//g, '_'),
      recipientUid: uid,
      type: data.type,
      title: data.title,
      message: data.message,
      projectId: data.pin.projectId || data.project?.id || null,
      projectName: data.project?.name || null,
      pinId: data.pin.id,
      pinNumber: data.pin.number ?? null,
      assetId: data.pin.assetId || null,
      actor: { id: actor.id, name: actor.name, avatar: actor.avatar || '', email: actor.email || '', isGuest: actor.isGuest },
      read: false,
      createdAt: now(),
    }));
  }
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from('notifications').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

async function onNewPin(pin: any) {
  if (pin.deletedAt) return;
  const [team, project] = await Promise.all([teamMembers(), projectOf(pin.projectId)]);
  const actor = personOf(pin.author);
  const where = project?.name ? ` on ${project.name}` : '';
  const text = pin.comments?.[0]?.text || pin.title;
  const mentioned = new Set(mentionedIn(text, team));
  await send(mentioned, actor, `${pin.id}_mention_0`, {
    type: 'mention', title: `${actor.name} mentioned you on pin #${pin.number}`, message: short(text), pin, project,
  }, team);
  const recipients = [...projectPeople(project), pin.assignedTo?.id].filter((id) => id && !mentioned.has(id));
  // Client feedback also goes to the project's Google Chat space
  if (actor.isGuest && project) queueChatAlert(project, pin, `added by client ${actor.name.replace(/\s*\(Guest\)$/i, '')}`, text);
  await send(recipients, actor, `${pin.id}_created`, {
    type: 'pin', title: `${actor.isGuest ? 'Client' : actor.name} added pin #${pin.number}${where}`, message: short(`${actor.isGuest ? `${actor.name}: ` : ''}${text}`), pin, project,
  }, team);
}

async function onNewComments(pin: any, before: PinState) {
  const fresh = (pin.comments || []).filter((c: any) => !before.commentIds.has(String(c.id)) && !c.isAiGenerated);
  if (!fresh.length || pin.deletedAt) return;
  const [team, project] = await Promise.all([teamMembers(), projectOf(pin.projectId)]);
  const where = project?.name ? ` on ${project.name}` : '';
  for (const comment of fresh) {
    const actor = personOf(comment.author);
    // A client's reply on a pin that waits for them: back to the team
    if (actor.isGuest && pin.status === 'waiting_on_customer') {
      await updateRow('pins', pin.id, { status: 'open' }).catch(() => {});
    }
    const reopened = actor.isGuest && pin.status === 'waiting_on_customer' ? ' (reopened)' : '';
    if (actor.isGuest && project) queueChatAlert(project, pin, `client ${actor.name.replace(/\s*\(Guest\)$/i, '')} replied${reopened}`, comment.text);
    const mentioned = new Set(mentionedIn(comment.text, team));
    await send(mentioned, actor, `${pin.id}_mention_${comment.id}`, {
      type: 'mention', title: `${actor.name} mentioned you on pin #${pin.number}${reopened}`, message: short(comment.text), pin, project,
    }, team);
    const thread = [pin.author?.id, pin.assignedTo?.id, ...(pin.comments || []).map((c: any) => c.author?.id)];
    const recipients = [...thread, ...(actor.isGuest ? projectPeople(project) : [])].filter((id) => id && !mentioned.has(String(id)));
    await send(recipients.map(String), actor, `${pin.id}_comment_${comment.id}`, {
      type: 'comment', title: `${actor.isGuest ? `Client ${actor.name}` : actor.name} replied on pin #${pin.number}${where}${reopened}`, message: short(comment.text || 'Sent a file'), pin, project,
    }, team);
  }
}

async function onAssigned(pin: any) {
  const assignee = String(pin.assignedTo?.id || '');
  if (!assignee || pin.deletedAt) return;
  const [team, project] = await Promise.all([teamMembers(), projectOf(pin.projectId)]);
  const by = pin.assignedBy?.id ? personOf(pin.assignedBy) : { id: '', name: 'Someone', isGuest: false };
  await send([assignee], by, `${pin.id}_assigned_${assignee}_${Date.now()}`, {
    type: 'assignment', title: `${by.name} assigned pin #${pin.number} to you`, message: short(`${project?.name ? `${project.name}: ` : ''}${pin.title}`), pin, project,
  }, team);
}

// Watch every pin (Supabase Realtime). What exists at start is only recorded (no notifications for old pins); each
// change reads the pin again, so the comparison always uses its latest saved state.
async function onPinChange(id: string, removed: boolean) {
  if (removed) {
    known.delete(id);
    return;
  }
  const pin = await getRow('pins', id);
  if (!pin) {
    known.delete(id);
    return;
  }
  const before = known.get(id);
  const after = stateOf(pin);
  known.set(id, after);
  // A client revision is done when all its pins are resolved or ready for review
  checkRevisionDone(pin).catch((err) => console.warn('Revisions:', err?.message || err));
  // A pin first seen here but made earlier (e.g. data being imported) is only recorded
  if (!before) return Date.now() - toMillis(pin.createdAt, pin.id) < NEW_PIN_MS ? onNewPin(pin) : undefined;
  await Promise.all([
    onNewComments(pin, before),
    after.assigneeId && after.assigneeId !== before.assigneeId ? onAssigned(pin) : null,
  ]);
}

export async function startNotifications() {
  // Changes for the same pin are handled one after another
  const queues = new Map<string, Promise<void>>();
  // Changes wait until the pins that existed at start are recorded
  let loaded!: () => void;
  const ready = new Promise<void>((resolve) => (loaded = resolve));
  const handle = (id: string, removed: boolean) => {
    const next = (queues.get(id) || ready)
      .then(() => onPinChange(id, removed))
      .catch((err) => console.warn('Notifications:', err?.message || err));
    queues.set(id, next);
    next.then(() => queues.get(id) === next && queues.delete(id));
  };

  const load = async () => {
    for (const pin of await findRows('pins')) known.set(pin.id, stateOf(pin));
    loaded();
  };

  supabaseAdmin
    .channel('server-pins')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pins' }, (change: any) => {
      const id = String(change.new?.id || change.old?.id || '');
      if (id) handle(id, change.eventType === 'DELETE');
    })
    .subscribe((status, err) => {
      // (Re)connected: start from what is saved now
      if (status === 'SUBSCRIBED') load().catch((e) => console.warn('Notifications: could not load pins:', e?.message || e));
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('Notifications: live updates interrupted:', err?.message || status);
    });
}
