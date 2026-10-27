// Revision deadlines and reminders, checked every few minutes:
// - Overdue: a submitted revision not done by its due date. Its developers, their Team Leads and Managers are told
//   (bell, Chrome extension, Google Chat), then again once a day until it is done.
// - Unsent: client pins not submitted for longer than the set hours. The project's developers are reminded, then again
//   after the same time, until the client submits (or someone submits for them).
// Settings → Teams → Deadlines & reminders sets the days and hours.
import { findRows, getRow, now, supabaseAdmin } from './db';
import { isClientPin, notifyTeam, projectLink, projectPeople, revisionSettings, tellChat } from './revisions';
import { loadCoverage } from './teams';
import { toMillis } from '../src/lib/time';

const DAY_MS = 24 * 60 * 60 * 1000;
const DONE = ['resolved', 'ready_for_review'];
const plain = (text: string) => String(text || '').replace(/[*_~`<>|]/g, '').trim();
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// Team Leads and Managers of these people's teams
function leadersOf(uids: string[], teams: any[]) {
  const leaders = new Set<string>();
  for (const team of teams) {
    const members: string[] = team.memberIds || [];
    for (const uid of uids) {
      if (members.includes(uid)) {
        if (team.leadId) leaders.add(team.leadId);
        if (team.managerId) leaders.add(team.managerId);
      }
      if (team.leadId === uid && team.managerId) leaders.add(team.managerId);
    }
  }
  return [...leaders];
}

export async function checkOverdue() {
  const nowIso = now();
  const repeatBefore = new Date(Date.now() - DAY_MS).toISOString();
  const { data: due, error } = await supabaseAdmin
    .from('revisions')
    .select('id')
    .eq('status', 'submitted')
    .lt('due_at', nowIso)
    .or(`overdue_alerted_at.is.null,overdue_alerted_at.lt.${repeatBefore}`);
  if (error) throw new Error(error.message);

  for (const { id } of due || []) {
    // Claim it, so two servers never send the same alert
    const { data: claimed } = await supabaseAdmin
      .from('revisions')
      .update({ overdue_alerted_at: nowIso })
      .eq('id', id)
      .eq('status', 'submitted')
      .or(`overdue_alerted_at.is.null,overdue_alerted_at.lt.${repeatBefore}`)
      .select('id');
    if (!claimed?.length) continue;

    const revision = await getRow('revisions', id);
    const project = revision && (await getRow('projects', revision.projectId));
    if (!revision || !project) continue;
    const { data: pins } = await supabaseAdmin.from('pins').select('status, deleted_at').in('id', revision.pinIds);
    const live = (pins || []).filter((p) => !p.deleted_at);
    const open = live.filter((p) => !DONE.includes(p.status)).length;
    if (!open) continue;

    const developers = projectPeople(project);
    const coverage = await loadCoverage();
    const names = developers.map((uid) => coverage.byId.get(uid)?.name).filter(Boolean).join(', ') || 'not assigned';
    const leaders = leadersOf(developers, coverage.teams);
    const title = `Overdue: ${project.name || 'a project'} Revision ${revision.number}`;
    const message = `${open} of ${live.length} ${live.length === 1 ? 'pin' : 'pins'} still open · due ${shortDate(revision.dueAt)} · ${developers.length === 1 ? 'Developer' : 'Developers'}: ${names}`;
    await notifyTeam(project, 'overdue', `${id}_overdue_${nowIso.slice(0, 10)}`, title, message, null, [...new Set([...developers, ...leaders])]);
    await tellChat(project.id, `*⏰ ${plain(title)}*\n${plain(message)}\n<${projectLink(project.id)}|Open in Markup>`);
  }
}

export async function remindUnsent() {
  const { unsentReminderHours } = await revisionSettings();
  const waitMs = unsentReminderHours * 60 * 60 * 1000;
  const since = new Date(Date.now() - waitMs).toISOString();

  const unsentByProject = new Map<string, any[]>();
  for (const pin of await findRows('pins')) {
    if (pin.deletedAt || !isClientPin(pin) || (pin.revision !== null && pin.revision !== undefined)) continue;
    unsentByProject.set(pin.projectId, [...(unsentByProject.get(pin.projectId) || []), pin]);
  }

  for (const [projectId, pins] of unsentByProject) {
    const oldest = Math.min(...pins.map((p) => toMillis(p.createdAt, p.id) || Date.now()));
    if (Date.now() - oldest < waitMs) continue;
    // Claim it (open projects only; not reminded within the wait)
    const { data: claimed } = await supabaseAdmin
      .from('projects')
      .update({ unsent_reminded_at: now() })
      .eq('id', projectId)
      .eq('review_state', 'open')
      .or(`unsent_reminded_at.is.null,unsent_reminded_at.lt.${since}`)
      .select('id');
    if (!claimed?.length) continue;
    const project = await getRow('projects', projectId);
    if (!project) continue;
    const hours = Math.round((Date.now() - oldest) / 3_600_000);
    await notifyTeam(
      project,
      'reminder',
      `unsent_${projectId}_${Date.now()}`,
      `Client has ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'} not submitted on ${project.name || 'a project'}`,
      `The oldest is ${hours >= 48 ? `${Math.round(hours / 24)} days` : `${hours} hours`} old. Ask the client to click "Submit to developer", or use "Submit for client".`,
      null
    );
  }
}

export function startDeadlineChecks() {
  const tick = () =>
    Promise.all([
      checkOverdue().catch((err) => console.warn('Overdue check failed:', err?.message || err)),
      remindUnsent().catch((err) => console.warn('Unsent pins reminder failed:', err?.message || err)),
    ]);
  setTimeout(tick, 30_000);
  setInterval(tick, 5 * 60 * 1000).unref();
}
