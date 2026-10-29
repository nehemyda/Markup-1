// The project's activity feed, built from what is saved (pins, their comments and status changes, client revisions),
// so everyone sees the same history after a reload.
import { ActivityItem, Pin, Revision, Teammate } from '../types';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

// Someone saved without a full profile (e.g. a guest who submitted) shown as a teammate
const person = (who: { id?: string; name?: string; avatar?: string; role?: string } | null | undefined, fallbackRole = 'Member'): Teammate =>
  ({
    id: who?.id || who?.name || 'unknown',
    name: who?.name || 'Someone',
    avatar: who?.avatar || DEFAULT_AVATAR,
    role: who?.role || fallbackRole,
  }) as Teammate;

const time = (value?: string | null) => {
  const t = value ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

// "Just now", "5 min ago", "3 h ago", "2 days ago", then the date
export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} ${s < 2 * 86400 ? 'day' : 'days'} ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const label = (status: string) => status.replace(/_/g, ' ');

export function buildActivity(projectId: string, pins: Pin[], revisions: Revision[]): ActivityItem[] {
  const events: (ActivityItem & { at: number })[] = [];
  const add = (e: Omit<ActivityItem, 'projectId' | 'timestamp'>, at: number) => {
    if (at) events.push({ ...e, projectId, timestamp: '', at });
  };

  const projectPins = pins.filter((p) => p.projectId === projectId);

  // Pins placed together by one author (an AI review) are one event
  const batches = new Map<string, Pin[]>();
  for (const pin of projectPins) {
    const key = `${pin.author?.id || pin.author?.name}|${pin.createdAt}`;
    batches.set(key, [...(batches.get(key) || []), pin]);
  }
  for (const batch of batches.values()) {
    const first = batch[0];
    const at = time(first.createdAt);
    if (batch.length > 1) {
      add({ id: `pins_${first.id}`, assetId: first.assetId, author: person(first.author), action: 'placed', targetName: `${batch.length} pins`, type: 'pin' }, at);
    } else {
      add({ id: `pin_${first.id}`, assetId: first.assetId, author: person(first.author), action: `placed Pin #${first.number}:`, targetName: first.title, type: 'pin' }, at);
    }
  }

  for (const pin of projectPins) {
    const pinAt = time(pin.createdAt);
    for (const c of pin.comments || []) {
      const at = time(c.createdAt);
      // The pin's first comment is its description, already shown as "placed"
      if (Math.abs(at - pinAt) < 10_000 && (c.author?.id || c.author?.name) === (pin.author?.id || pin.author?.name)) continue;
      const text = (c.text || '').trim();
      add({ id: `comment_${c.id}`, assetId: pin.assetId, author: person(c.author), action: `commented on Pin #${pin.number}:`, targetName: text.length > 80 ? `${text.slice(0, 80)}…` : text || 'an attachment', type: 'comment' }, at);
    }
    (pin.metadata?.statusHistory || []).forEach((s, i) =>
      add({ id: `status_${pin.id}_${i}`, assetId: pin.assetId, author: person(s.by), action: `changed Pin #${pin.number} to`, targetName: label(s.status), type: 'status' }, time(s.at))
    );
    if (pin.deletedAt) {
      add({ id: `deleted_${pin.id}`, assetId: pin.assetId, author: person(pin.deletedBy), action: `deleted Pin #${pin.number}:`, targetName: pin.title, type: 'pin' }, time(pin.deletedAt));
    }
  }

  for (const r of revisions.filter((r) => r.projectId === projectId)) {
    const count = r.pinIds?.length || 0;
    const submitter = person(r.submittedBy, r.submittedBy?.isGuest ? 'Client' : 'Member');
    add({ id: `rev_${r.id}`, author: submitter, action: `submitted Revision ${r.number} with`, targetName: `${count} ${count === 1 ? 'pin' : 'pins'}`, type: 'approval' }, time(r.submittedAt));
    if (r.doneAt) {
      add({ id: `rev_done_${r.id}`, author: person({ name: 'Vpin' }, 'System'), action: `Revision ${r.number} is`, targetName: 'done', type: 'approval' }, time(r.doneAt));
    }
  }

  const now = Date.now();
  return events.sort((a, b) => b.at - a.at).map(({ at, ...e }) => ({ ...e, timestamp: timeAgo(at, now) }));
}
