// Client revisions. A client (guest) adds pins on the shared link, then submits them: the pins become Revision N,
// the link turns view-only for the client, and the project's developers are told once (bell, Chrome extension,
// Google Chat). Someone on the team opens the link again for the next round. When every pin of a revision is resolved
// or ready for review, the revision is done and the team is told, so they can let the client know.
// Two revisions are included per project; more are allowed and shown as chargeable.
import { APP_URL, postToChat, projectWebhook } from './googleChat';
import { findRows, getRow, insertRow, now, supabaseAdmin } from './db';
import { toRow } from '../src/lib/rows';
import { INCLUDED_REVISIONS } from '../src/types';
import { coverTitle, loadCoverage } from './teams';

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
const isClientPin = (pin: any) => pin.author?.role === 'Guest' || String(pin.author?.id || '').startsWith('guest_');
const plain = (text: string) => String(text || '').replace(/[*_~`<>|]/g, '').trim();

// The project's assigned developers; the creator when nobody is assigned
export function projectPeople(project: any): string[] {
  const assigned: string[] = Array.isArray(project?.assigneeIds) ? project.assigneeIds.map(String) : [];
  if (assigned.length) return assigned;
  return project?.ownerId ? [String(project.ownerId)] : [];
}

// One notification per person on the project (not the person who did it)
async function notifyTeam(project: any, type: 'submission' | 'revision_done', key: string, title: string, message: string, actor: Submitter | null) {
  // People out of office: their Team Lead (or Manager) is told too
  const coverage = await loadCoverage();
  const rows = coverage
    .expand(projectPeople(project).filter((uid) => uid !== actor?.id))
    .filter((r) => r.uid !== actor?.id)
    .map((r) => toRow('notifications', {
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
}

async function tellChat(projectId: string, text: string) {
  try {
    const url = await projectWebhook(projectId);
    if (url) await postToChat(url, text);
  } catch (err: any) {
    console.warn('Google Chat: revision alert not sent:', err?.message || err);
  }
}

const projectLink = (projectId: string) => `${APP_URL}/projects/${encodeURIComponent(projectId)}`;

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
    .update({ review_state: 'submitted', revision_count: number })
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

  const revision = await insertRow('revisions', {
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
  await notifyTeam(project, 'submission', `rev_${projectId}_${number}_submitted`, `${who} submitted Revision ${number} on ${project.name || 'a project'}`, `${count}${limitNote}`, by);
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
