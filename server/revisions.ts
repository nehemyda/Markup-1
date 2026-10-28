// Client revisions. A client (guest) adds pins on the shared link, then submits them: the pins become Revision N,
// the link turns view-only for the client, and the project's developers are told once (bell, Chrome extension,
// Google Chat). Someone on the team opens the link again for the next round. When every pin of a revision is resolved
// or ready for review, the revision is done and the team is told, so they can let the client know.
// Two revisions are included per project; more are allowed and shown as chargeable.
import { APP_URL, postToChat, projectWebhook } from './googleChat';
import { findRows, getRow, getSetting, insertRow, now, supabaseAdmin } from './db';
import { toRow } from '../src/lib/rows';
import { DEFAULT_REVISION_SETTINGS, INCLUDED_REVISIONS, RevisionSettings } from '../src/types';
import { coverTitle, loadCoverage } from './teams';
import { sendEmail } from './email';

export class RevisionError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface Submitter {
  id: string;
  name: string;
  email: string;
  isGuest: boolean;
}

const DONE = ['resolved', 'ready_for_review'];
export const isClientPin = (pin: any) => pin.author?.role === 'Guest' || String(pin.author?.id || '').startsWith('guest_');
const plain = (text: string) => String(text || '').replace(/[*_~`<>|]/g, '').trim();

// The project's assigned developers; the creator when nobody is assigned
export function projectPeople(project: any): string[] {
  const assigned: string[] = Array.isArray(project?.assigneeIds) ? project.assigneeIds.map(String) : [];
  if (assigned.length) return assigned;
  return project?.ownerId ? [String(project.ownerId)] : [];
}

// Due days and reminder hours (Settings → Teams → Deadlines & reminders)
export async function revisionSettings(): Promise<RevisionSettings> {
  const saved = await getSetting<RevisionSettings>('revisions').catch(() => ({}) as Partial<RevisionSettings>);
  const number = (value: unknown, fallback: number, max: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
  };
  return {
    dueDays: number(saved.dueDays, DEFAULT_REVISION_SETTINGS.dueDays, 60),
    workingDaysOnly: saved.workingDaysOnly !== false,
    unsentReminderHours: number(saved.unsentReminderHours, DEFAULT_REVISION_SETTINGS.unsentReminderHours, 24 * 14),
  };
}

// `days` days after `from` (skipping Saturdays and Sundays when only working days count)
export function addDays(from: Date, days: number, workingDaysOnly: boolean) {
  const due = new Date(from);
  for (let left = days; left > 0; ) {
    due.setUTCDate(due.getUTCDate() + 1);
    if (!workingDaysOnly || ![0, 6].includes(due.getUTCDay())) left--;
  }
  return due;
}

// One notification per person (not the person who did it); by default the project's developers.
// People out of office: their Team Lead (or Manager) is told too.
export async function notifyTeam(
  project: any,
  type: 'submission' | 'revision_done' | 'overdue' | 'reminder',
  key: string,
  title: string,
  message: string,
  actor: Submitter | null,
  recipients: string[] = projectPeople(project)
) {
  const coverage = await loadCoverage();
  const told = coverage.expand(recipients.filter((uid) => uid !== actor?.id)).filter((r) => r.uid !== actor?.id);
  const rows = told.map((r) => toRow('notifications', {
      id: `${key}__${r.uid}`,
      recipientUid: r.uid,
      type,
      title: coverTitle(title, r),
      message,
      projectId: project.id,
      projectName: project.name || null,
      pinId: null,
      pinNumber: null,
      assetId: null,
      actor: actor
        ? { id: actor.id, name: actor.name, avatar: '', email: actor.email, isGuest: actor.isGuest }
        : { id: '', name: 'Markup', avatar: '', email: '', isGuest: false },
      read: false,
      createdAt: now(),
    }));
  if (rows.length) {
    const { error } = await supabaseAdmin.from('notifications').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  // Who was told, with their email (for sending the same news by email)
  return told.map((r) => ({ ...r, email: String(coverage.byId.get(r.uid)?.email || '') }));
}

export async function tellChat(projectId: string, text: string) {
  try {
    const url = await projectWebhook(projectId);
    if (url) await postToChat(url, text);
  } catch (err: any) {
    console.warn('Google Chat: revision alert not sent:', err?.message || err);
  }
}

export const projectLink = (projectId: string) => `${APP_URL}/projects/${encodeURIComponent(projectId)}`;

// The client's unsent pins become the next revision, and the link turns view-only for the client
export async function submitRevision(projectId: string, by: Submitter) {
  const project = await getRow('projects', projectId);
  if (!project) throw new RevisionError('This project no longer exists.', 404);
  if (project.reviewState === 'submitted') {
    throw new RevisionError('These pins were already sent to the developer. The team will open the link again for the next round.', 409);
  }
  const pins = (await findRows('pins', { projectId })).filter(
    (p) => !p.deletedAt && isClientPin(p) && (p.revision === null || p.revision === undefined)
  );
  if (!pins.length) throw new RevisionError('There are no new pins to send yet. Add a pin first.', 400);

  // Claim the round first, so two people submitting at the same moment make one revision
  const previous = Number(project.revisionCount || 0);
  const number = previous + 1;
  const { data: claimed, error } = await supabaseAdmin
    .from('projects')
    .update({ review_state: 'submitted', revision_count: number, unsent_reminded_at: null })
    .eq('id', projectId)
    .eq('review_state', 'open')
    .eq('revision_count', previous)
    .select('id');
  if (error) throw new Error(error.message);
  if (!claimed?.length) throw new RevisionError('Someone else just sent these pins to the developer.', 409);

  const pinIds = pins.map((p) => p.id);
  const { error: tagError } = await supabaseAdmin.from('pins').update({ revision: number }).in('id', pinIds).is('revision', null);
  if (tagError) throw new Error(tagError.message);

  // Who added the pins, most first
  const byPerson = new Map<string, { name: string; email: string; count: number }>();
  for (const pin of pins) {
    const name = String(pin.author?.name || 'Client').replace(/\s*\(Guest\)$/i, '');
    const email = String(pin.author?.email || '');
    const key = (email || name).toLowerCase();
    const entry = byPerson.get(key) || { name, email, count: 0 };
    entry.count++;
    byPerson.set(key, entry);
  }
  const people = [...byPerson.values()].sort((a, b) => b.count - a.count);

  const settings = await revisionSettings();
  const revision = await insertRow('revisions', {
    dueAt: addDays(new Date(), settings.dueDays, settings.workingDaysOnly).toISOString(),
    id: `${projectId}_r${number}`,
    projectId,
    number,
    status: 'submitted',
    pinIds,
    people,
    submittedBy: by,
    submittedAt: now(),
  });

  const count = `${pins.length} ${pins.length === 1 ? 'pin' : 'pins'}${people.length > 1 ? ` from ${people.length} people` : ''}`;
  const who = by.isGuest ? `Client ${by.name}` : `${by.name} (for the client)`;
  const overLimit = number > INCLUDED_REVISIONS;
  const limitNote = overLimit ? ` · over the ${INCLUDED_REVISIONS} included revisions (chargeable)` : '';
  const title = `${who} submitted Revision ${number} on ${project.name || 'a project'}`;
  const told = await notifyTeam(project, 'submission', `rev_${projectId}_${number}_submitted`, title, `${count}${limitNote}`, by);
  // The same by email to the developers (and whoever covers for them while they're out)
  const emailLines = [
    `${who} sent their feedback on ${project.name || 'a project'}: ${count}.`,
    ...(people.length > 1 ? [people.map((p) => `${p.name}: ${p.count}`).join(' · ')] : []),
    ...(overLimit ? [`This is revision ${number}; ${INCLUDED_REVISIONS} revisions are included, so this one is chargeable.`] : []),
    ...(by.isGuest && by.email ? [`Client email: ${by.email}`] : []),
  ];
  for (const r of told) {
    await sendEmail([r.email], r.forName ? `${title} (for ${r.forName}, out of office)` : title, emailLines, { label: 'Open in Markup', url: projectLink(projectId) });
  }
  await tellChat(projectId, [
    `*${plain(who)} submitted Revision ${number} on ${plain(project.name || 'a project')}* (${count})`,
    people.length > 1 ? people.map((p) => `• ${plain(p.name)}: ${p.count}`).join('\n') : '',
    overLimit ? `_This is over the ${INCLUDED_REVISIONS} included revisions (chargeable)._` : '',
    `<${projectLink(projectId)}|Open in Markup>`,
  ].filter(Boolean).join('\n'));

  return { revision, pinCount: pins.length, overLimit };
}

// Someone on the team opens the link for the client's next round
export async function reopenProject(projectId: string, by: Submitter) {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .update({ review_state: 'open' })
    .eq('id', projectId)
    .eq('review_state', 'submitted')
    .select('revision_count');
  if (error) throw new Error(error.message);
  if (!data?.length) {
    if (!(await getRow('projects', projectId))) throw new RevisionError('This project no longer exists.', 404);
    throw new RevisionError('This link is already open for the client.', 409);
  }
  const number = Number(data[0].revision_count || 0);
  if (number) {
    await supabaseAdmin
      .from('revisions')
      .update({ reopened_at: now(), reopened_by: { id: by.id, name: by.name, email: by.email } })
      .eq('id', `${projectId}_r${number}`);
  }
  return { nextRevision: number + 1 };
}

// After a pin changes: when every pin of its revision is resolved or ready for review, the revision is done
export async function checkRevisionDone(pin: any) {
  if (!pin?.revision || !pin.projectId) return;
  const revision = await getRow('revisions', `${pin.projectId}_r${pin.revision}`);
  if (!revision || revision.status !== 'submitted') return;
  const { data: pins, error } = await supabaseAdmin.from('pins').select('id, status, deleted_at').in('id', revision.pinIds);
  if (error) throw new Error(error.message);
  if (!(pins || []).every((p) => p.deleted_at || DONE.includes(p.status))) return;

  // Only the first change that finishes it marks it done
  const { data: marked } = await supabaseAdmin
    .from('revisions')
    .update({ status: 'done', done_at: now() })
    .eq('id', revision.id)
    .eq('status', 'submitted')
    .select('id');
  if (!marked?.length) return;
  const project = await getRow('projects', pin.projectId);
  if (!project) return;
  const total = revision.pinIds.length;
  await notifyTeam(project, 'revision_done', `rev_${project.id}_${revision.number}_done`, `Revision ${revision.number} on ${project.name || 'a project'} is done`, `All ${total} ${total === 1 ? 'pin is' : 'pins are'} resolved or ready for review. Let the client know with "Copy message for client".`, null);
  await tellChat(project.id, `*Revision ${revision.number} on ${plain(project.name || 'a project')} is done* (${total} ${total === 1 ? 'pin' : 'pins'}). Let the client know. <${projectLink(project.id)}|Open in Markup>`);
}
