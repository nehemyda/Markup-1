// Google Chat alerts. Client feedback (new pins, replies, reopened pins) is posted to a Google Chat space through
// the space's incoming webhook, grouped so a client adding 10 pins gives one message. Each weekday the team space
// also gets a summary of unfinished pins per developer.
//
// Webhook links are secrets (anyone with the link can post in the space), so they are kept server-only:
//   chatWebhooks/team          the team space (alerts for every project, and the daily summary)
//   chatWebhooks/{projectId}   a project's own space, or { off: true } to stop alerts for that project
//   settings/chat              daily summary settings and the day it was last sent
import { findRows, getRow, getSetting, supabaseAdmin } from './db';

export const WEBHOOK_PATTERN = /^https:\/\/chat\.googleapis\.com\/v1\/spaces\/([A-Za-z0-9_-]+)\/messages\?[A-Za-z0-9_\-=&%.]+$/;

// Where links in messages point (the app's public address once hosted)
export const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

export interface SummarySettings {
  enabled: boolean;
  // Local time "HH:MM"
  time: string;
  timeZone: string;
  weekdaysOnly: boolean;
}

export const DEFAULT_SUMMARY: SummarySettings = {
  enabled: true,
  time: '09:30',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  weekdaysOnly: true,
};

const DONE = ['resolved', 'archived'];
const DAY = 24 * 60 * 60 * 1000;

// "spaces/AAQA1234567" → shown as "Space …4567" (enough to tell spaces apart without revealing the link)
export function spaceLabel(url: string) {
  const id = WEBHOOK_PATTERN.exec(url)?.[1] || '';
  return id ? `Space …${id.slice(-5)}` : '';
}

export async function postToChat(url: string, text: string) {
  if (!WEBHOOK_PATTERN.test(url)) throw new Error('That is not a Google Chat webhook link.');
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('Could not reach Google Chat.');
  }
  if (!res.ok) {
    const detail: any = await res.json().catch(() => null);
    throw new Error(
      res.status === 404 || res.status === 400
        ? 'Google Chat did not accept the link. The webhook may have been deleted; copy a new link from the space.'
        : detail?.error?.message || `Google Chat answered ${res.status}.`
    );
  }
}

async function webhookOf(id: string): Promise<{ url?: string; off?: boolean } | null> {
  return getRow('chat_webhooks', id);
}

// Where a project's alerts go: its own space, else the team space; none when switched off
export async function projectWebhook(projectId: string) {
  const own = await webhookOf(projectId);
  if (own?.off) return null;
  if (own?.url) return own.url;
  return (await webhookOf('team'))?.url || null;
}

export async function chatStatus(projectId?: string) {
  const team = await webhookOf('team');
  const own = projectId ? await webhookOf(projectId) : null;
  return {
    team: { connected: !!team?.url, space: team?.url ? spaceLabel(team.url) : '' },
    project: projectId
      ? { mode: own?.off ? 'off' : own?.url ? 'own' : 'team', space: own?.url ? spaceLabel(own.url) : '' }
      : undefined,
  };
}

export async function summarySettings(): Promise<SummarySettings & { lastSentDate?: string }> {
  const chat = await getSetting('chat');
  return { ...DEFAULT_SUMMARY, ...(chat.summary || {}), lastSentDate: chat.lastSentDate };
}

// ---------- Live alerts (grouped) ----------

const GROUP_WAIT_MS = 60 * 1000;
const pending = new Map<string, { projectName: string; lines: string[]; timer: NodeJS.Timeout }>();

const pinLink = (project: { id: string; linkId?: string }, pinId: string) =>
  `${APP_URL}/projects/${encodeURIComponent(project.linkId || project.id)}?pin=${encodeURIComponent(pinId)}`;

// Chat formatting uses * _ ~ ` and <url|label>; keep client text from breaking it
const plain = (text: string, max = 120) => {
  const clean = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/[*_~`<>|]/g, '').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

export function queueChatAlert(project: { id: string; name?: string }, pin: { id: string; number?: number }, what: string, text: string) {
  const line = `• <${pinLink(project, pin.id)}|Pin #${pin.number ?? '?'}> ${what}: _${plain(text) || 'sent a file'}_`;
  const group = pending.get(project.id);
  if (group) {
    group.lines.push(line);
    if (group.lines.length >= 20) flush(project.id);
    return;
  }
  pending.set(project.id, { projectName: project.name || 'a project', lines: [line], timer: setTimeout(() => flush(project.id), GROUP_WAIT_MS) });
}

async function flush(projectId: string) {
  const group = pending.get(projectId);
  if (!group) return;
  pending.delete(projectId);
  clearTimeout(group.timer);
  try {
    const url = await projectWebhook(projectId);
    if (!url) return;
    const project = (await getRow('projects', projectId)) || {};
    const team = await teamNames();
    const assigned = projectOwners(project).map((id) => team.get(id)).filter(Boolean);
    const count = group.lines.length;
    const text = [
      `*New client feedback on ${plain(group.projectName, 80)}* (${count} ${count === 1 ? 'update' : 'updates'})`,
      ...group.lines,
      assigned.length ? `Assigned: ${assigned.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    await postToChat(url, text);
  } catch (err: any) {
    console.warn('Google Chat alert not sent:', err?.message || err);
  }
}

// ---------- Daily summary ----------

async function teamNames() {
  const users = await findRows('users', { removed: false });
  return new Map(users.map((u) => [u.id, String(u.name || u.email || 'Someone')]));
}

function projectOwners(project: any): string[] {
  const assigned: string[] = Array.isArray(project?.assigneeIds) ? project.assigneeIds.map(String) : [];
  return assigned.length ? assigned : project?.ownerId ? [String(project.ownerId)] : [];
}

const createdMs = (pin: any) => {
  const ms = Date.parse(String(pin.createdAt || ''));
  return Number.isFinite(ms) ? ms : null;
};

const isClient = (author: any) => author?.role === 'Guest' || String(author?.id || '').startsWith('guest_');

export async function buildSummary(now = Date.now(), timeZone = DEFAULT_SUMMARY.timeZone) {
  const [pinRows, projectRows, team] = await Promise.all([
    findRows('pins'),
    findRows('projects'),
    teamNames(),
  ]);
  const projects = new Map(projectRows.map((p) => [p.id, p]));
  type Row = { open: number; newFromClients: number; old: number; perProject: Map<string, number> };
  const people = new Map<string, Row>();
  let open = 0;
  let waiting = 0;
  let newFromClients = 0;

  for (const pin of pinRows) {
    const project = projects.get(pin.projectId);
    if (!project || pin.deletedAt || DONE.includes(pin.status)) continue;
    if (pin.status === 'waiting_on_customer') {
      waiting++;
      continue;
    }
    open++;
    const created = createdMs(pin);
    const isNew = created !== null && now - created < DAY && isClient(pin.author);
    const isOld = created !== null && now - created > 3 * DAY;
    if (isNew) newFromClients++;
    // Whose to-do it is: the pin's assignee, else the project's developers
    const assignee = pin.assignedTo?.id && team.has(String(pin.assignedTo.id)) ? [String(pin.assignedTo.id)] : projectOwners(project);
    for (const uid of assignee.filter((id) => team.has(id))) {
      const row = people.get(uid) || { open: 0, newFromClients: 0, old: 0, perProject: new Map() };
      row.open++;
      if (isNew) row.newFromClients++;
      if (isOld) row.old++;
      const name = String(project.name || 'Project');
      row.perProject.set(name, (row.perProject.get(name) || 0) + 1);
      people.set(uid, row);
    }
  }

  const date = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  if (!open && !waiting) return `*Vpin daily summary · ${date}*\nNo open pins. Nice work! 🎉`;
  const rows = [...people.entries()].sort((a, b) => b[1].open - a[1].open);
  const shown = rows.slice(0, 30);
  const lines = shown.map(([uid, row]) => {
    const extras = [row.newFromClients ? `${row.newFromClients} new from clients` : '', row.old ? `${row.old} older than 3 days` : ''].filter(Boolean);
    const where = [...row.perProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => `${plain(name, 40)} ${n}`).join(' · ');
    return `*${plain(team.get(uid) || 'Someone', 60)}*: ${row.open} open${extras.length ? ` (${extras.join(', ')})` : ''}\n      ${where}${row.perProject.size > 3 ? ` · +${row.perProject.size - 3} more` : ''}`;
  });
  return [
    `*Vpin daily summary · ${date}*`,
    `${open} open ${open === 1 ? 'pin' : 'pins'}${newFromClients ? `, ${newFromClients} new from clients in the last 24 hours` : ''}${waiting ? `. ${waiting} waiting on customers` : ''}.`,
    '',
    ...lines,
    ...(rows.length > shown.length ? [`…and ${rows.length - shown.length} more people with open pins.`] : []),
    '',
    `<${APP_URL}|Open Vpin>`,
  ].join('\n');
}

export async function sendSummaryNow() {
  const team = await webhookOf('team');
  if (!team?.url) throw new Error('Connect the team Google Chat space first.');
  const settings = await summarySettings();
  await postToChat(team.url, await buildSummary(Date.now(), settings.timeZone));
}

// Local date, weekday and minutes since midnight in the summary's time zone
function localClock(now: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// Once a day at the set time (sent up to 3 hours late if the server was off at that time)
async function summaryTick() {
  const settings = await summarySettings();
  if (!settings.enabled) return;
  let clock;
  try {
    clock = localClock(Date.now(), settings.timeZone);
  } catch {
    clock = localClock(Date.now(), 'UTC');
  }
  if (settings.weekdaysOnly && ['Sat', 'Sun'].includes(clock.weekday)) return;
  const [h, m] = settings.time.split(':').map(Number);
  const due = h * 60 + m;
  if (clock.minutes < due || clock.minutes > due + 180 || settings.lastSentDate === clock.date) return;
  const team = await webhookOf('team');
  if (!team?.url) return;
  // Claim the day first, so two servers (or a restart) never send it twice
  const { data: claimed, error } = await supabaseAdmin.rpc('claim_summary_day', { p_date: clock.date });
  if (error) throw new Error(error.message);
  if (!claimed) return;
  try {
    await postToChat(team.url, await buildSummary(Date.now(), settings.timeZone));
    console.log(`Google Chat: daily summary sent (${clock.date})`);
  } catch (err: any) {
    console.warn('Google Chat: daily summary not sent:', err?.message || err);
  }
}

export function startDailySummary() {
  setInterval(() => summaryTick().catch((err) => console.warn('Google Chat summary check failed:', err?.message || err)), 60 * 1000);
}
