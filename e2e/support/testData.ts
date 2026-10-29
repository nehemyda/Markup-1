// Test accounts and data for the end-to-end tests. Everything the tests create is named with the "vpin-e2e" /
// "E2E TEST" prefix and removed by cleanup(), so the live workspace's real projects and people are never changed.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../server/db';

export const STATE_FILE = path.join(process.cwd(), 'e2e', '.state', 'accounts.json');
export const PREFIX = 'vpin-e2e-';
export const TEST_NAME = 'E2E TEST';
export const PID = 'E2E-TEST';

export type Role = 'admin' | 'member' | 'outsider';
// Used only by the sign-out test, one per browser: signing out ends every session of that account
export const signoutEmail = (browser: string) => `${PREFIX}signout-${browser}@yourdigitalagents.com`;
export const EMAILS: Record<Role, string> = {
  // An invite makes this one an Admin on first sign-in
  admin: `${PREFIX}admin@yourdigitalagents.com`,
  // yourdigitalagents.com is an allowed domain, so this one joins as a Member
  member: `${PREFIX}member@yourdigitalagents.com`,
  // Not an allowed domain and not invited: must be refused
  outsider: `${PREFIX}outsider@example.com`,
};

export interface State { password: string; projectId: string; folderId: string; startedAt: string }
export const readState = (): State => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

async function testAccounts() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Listing accounts failed: ${error.message}`);
  return (data.users as { id: string; email?: string }[]).filter((u) => u.email?.startsWith(PREFIX));
}

const check = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

export async function cleanup() {
  const accounts = await testAccounts();
  const authIds = accounts.map((a) => a.id);
  const { data: members } = await supabaseAdmin.from('users').select('id').like('email', `${PREFIX}%`);
  const memberIds = (members || []).map((m) => m.id);
  const { data: projects } = await supabaseAdmin.from('projects').select('id').like('name', `${TEST_NAME}%`);
  const { data: trashed } = await supabaseAdmin.from('deleted_projects').select('id').like('name', `${TEST_NAME}%`);
  const projectIds = [...(projects || []), ...(trashed || [])].map((p) => p.id);

  if (projectIds.length) {
    check('pins', (await supabaseAdmin.from('pins').delete().in('project_id', projectIds)).error);
    check('revisions', (await supabaseAdmin.from('revisions').delete().in('project_id', projectIds)).error);
    check('notifications', (await supabaseAdmin.from('notifications').delete().in('project_id', projectIds)).error);
    check('deleted projects', (await supabaseAdmin.from('deleted_projects').delete().in('id', projectIds)).error);
    check('projects', (await supabaseAdmin.from('projects').delete().in('id', projectIds)).error);
  }
  check('folders', (await supabaseAdmin.from('folders').delete().ilike('name', PID)).error);
  if (memberIds.length) {
    check('notifications', (await supabaseAdmin.from('notifications').delete().in('recipient_uid', memberIds)).error);
    check('members', (await supabaseAdmin.from('users').delete().in('id', memberIds)).error);
  }
  check('invites', (await supabaseAdmin.from('invites').delete().like('id', `${PREFIX}%`)).error);
  const { data: all } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  // Guest accounts the tests' review links made (real guests have passes for real projects and are never touched)
  const guests = (all?.users || []).filter((u: any) => u.is_anonymous && projectIds.includes(u.app_metadata?.guest_project));

  // If a test managed to add a domain it should not have, take it out again
  const { data: access } = await supabaseAdmin.from('settings').select('value').eq('id', 'access').single();
  const domains: string[] = access?.value?.allowedDomains || [];
  if (domains.some((d) => d.endsWith('.test'))) {
    check('access', (await supabaseAdmin.from('settings').update({ value: { ...access!.value, allowedDomains: domains.filter((d) => !d.endsWith('.test')) } }).eq('id', 'access')).error);
  }
  for (const id of [...authIds, ...guests.map((g: any) => g.id)]) {
    check('account', (await supabaseAdmin.auth.admin.deleteUser(id)).error);
  }
  return { accounts: authIds.length, guests: guests.length, members: memberIds.length, projects: projectIds.length };
}

export async function setup(): Promise<State> {
  await cleanup();
  const startedAt = new Date().toISOString();
  const password = `E2e-${crypto.randomBytes(12).toString('base64url')}`;
  for (const email of [...Object.values(EMAILS), ...['chromium', 'firefox', 'webkit'].map(signoutEmail)]) {
    const { error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `E2E ${email.split('@')[0].slice(PREFIX.length)}` } });
    check(`Creating ${email}`, error);
  }
  check('invite', (await supabaseAdmin.from('invites').insert({ id: EMAILS.admin, email: EMAILS.admin, name: 'E2E admin', role: 'Admin', invited_by: 'e2e', invited_at: new Date().toISOString() })).error);

  // A test folder and project with one page, owned by nobody real (the admin test account becomes its owner on sign-in)
  const folderId = `folder_e2e_${Date.now()}`;
  const projectId = `proj_e2e_${Date.now()}`;
  check('folder', (await supabaseAdmin.from('folders').insert({ id: folderId, name: PID, created_at: new Date().toISOString(), created_by: 'e2e' })).error);
  const asset = { id: `asset_e2e_${Date.now()}`, url: 'https://example.com/', type: 'url', title: 'example.com', status: 'in_review', pinCount: 0, resolvedCount: 0, projectId };
  check('project', (await supabaseAdmin.from('projects').insert({
    id: projectId, name: `${TEST_NAME} – seeded`, client: '', description: 'Created by the end-to-end tests. Safe to delete.',
    color: 'from-slate-600 to-slate-800', avatar: '🧪', member_count: 1, last_updated: 'Just now', folder_id: folderId,
    agid: 'AG-E2ETEST', assets: [asset], assignee_ids: [],
  })).error);

  const state = { password, projectId, folderId, startedAt };
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state), { mode: 0o600 });
  return state;
}
