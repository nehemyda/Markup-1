// Limits enforced by the server and the database, checked directly (not through the UI): what signed-out
// visitors, outsiders, members and guests can and cannot do. Runs once; it does not depend on the browser.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { supabaseAdmin } from '../server/db';
import { EMAILS, readState } from './support/testData';

const url = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const client = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function signedIn(email: string): Promise<{ db: SupabaseClient; token: string }> {
  const db = client();
  const { data, error } = await db.auth.signInWithPassword({ email, password: readState().password });
  if (error) throw error;
  return { db, token: data.session!.access_token };
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

test.describe('signed-out visitors', () => {
  test('the server is up', async ({ request }) => {
    expect((await request.get('/api/health')).ok()).toBeTruthy();
  });

  for (const [method, path] of [
    ['post', '/api/ai/suggest-fix'], ['post', '/api/uploads'], ['post', '/api/screenshot'], ['get', '/api/chat/settings'],
    ['post', '/api/projects/x/delete'], ['post', '/api/projects/x/restore'], ['get', '/api/extension/summary'], ['get', '/api/wp/plugin.zip'],
  ] as const) {
    test(`cannot use ${method.toUpperCase()} ${path}`, async ({ request }) => {
      const res = await request[method](path, { data: {} });
      expect([401, 403]).toContain(res.status());
    });
  }

  test('cannot read projects, pins or the team from the database', async () => {
    const db = client();
    for (const table of ['projects', 'pins', 'users', 'notifications', 'deleted_projects']) {
      const { data } = await db.from(table).select('id').limit(1);
      expect(data ?? [], table).toHaveLength(0);
    }
  });

  test('cannot use the page proxy to fetch other addresses', async ({ request }) => {
    // The proxy should only serve signed-in people. Fetching the server's own health check shows whether
    // anyone on the internet could make the server fetch internal addresses for them.
    const res = await request.get(`/api/proxy-site?url=${encodeURIComponent('http://127.0.0.1:' + new URL(test.info().project.use.baseURL!).port + '/api/health')}`);
    expect(res.status(), 'the proxy answered a signed-out request').toBeGreaterThanOrEqual(400);
  });
});

test.describe('outsiders', () => {
  test('an account outside the allowed domains gets no workspace access', async ({ request }) => {
    const { db, token } = await signedIn(EMAILS.outsider);
    expect((await request.post('/api/auth/session', { headers: auth(token) })).status()).toBe(403);
    expect((await request.post('/api/projects/x/delete', { headers: auth(token) })).status()).toBe(403);
    const { data } = await db.from('projects').select('id');
    expect(data ?? []).toHaveLength(0);
  });
});

test.describe('members', () => {
  test('cannot delete projects (Roles & Permissions: members cannot delete)', async ({ request }) => {
    const { token } = await signedIn(EMAILS.member);
    const res = await request.post(`/api/projects/${readState().projectId}/delete`, { headers: auth(token) });
    expect(res.status()).toBe(403);
  });

  test('cannot change workspace settings, roles or AI prices', async ({ request }) => {
    const { db, token } = await signedIn(EMAILS.member);
    const before = await db.from('settings').select('value').eq('id', 'access').single();
    const { error } = await db.rpc('settings_merge', { p_id: 'access', p_patch: { allowedDomains: ['e2e-not-allowed.test'] } });
    expect(error, 'a member changed the allowed domains').not.toBeNull();
    const after = await db.from('settings').select('value').eq('id', 'access').single();
    expect(after.data).toEqual(before.data);
    const { data: me } = await db.from('users').select('id').eq('email', EMAILS.member).single();
    const raise = await db.from('users').update({ role: 'Admin' }).eq('id', me!.id).select('id');
    expect(raise.error ?? (raise.data?.length ? null : 'no rows'), 'a member raised their own role').not.toBeNull();
    expect((await request.post('/api/ai-pricing', { headers: auth(token), data: {} })).status()).toBe(403);
  });

  test('cannot read WordPress passwords or Google Chat links', async () => {
    const { db } = await signedIn(EMAILS.member);
    for (const table of ['wp_site_secrets', 'chat_webhooks', 'extension_keys']) {
      const { data } = await db.from(table).select('*').limit(1);
      expect(data ?? [], table).toHaveLength(0);
    }
  });
});

test.describe('guest review links', () => {
  test('a guest sees only the shared project', async ({ request }) => {
    const db = client();
    const { data, error } = await db.auth.signInAnonymously();
    expect(error).toBeNull();
    const pass = await request.post('/api/guest/session', { headers: auth(data.session!.access_token), data: { projectId: readState().projectId } });
    expect(pass.status()).toBe(200);
    await db.auth.refreshSession();
    const projects = await db.from('projects').select('id');
    expect(projects.data?.map((p) => p.id)).toEqual([readState().projectId]);
    for (const table of ['users', 'invites', 'settings', 'deleted_projects', 'audit_log']) {
      const { data: rows } = await db.from(table).select('id').neq('id', 'access').neq('id', 'branding');
      expect(rows ?? [], table).toHaveLength(0);
    }
    // Member-only server features
    const token = (await db.auth.getSession()).data.session!.access_token;
    expect([401, 403]).toContain((await request.post('/api/ai/suggest-fix', { headers: auth(token), data: {} })).status());
    expect([401, 403]).toContain((await request.post(`/api/projects/${readState().projectId}/delete`, { headers: auth(token) })).status());
  });

  test('a guest link to a project that does not exist is refused', async ({ request }) => {
    const db = client();
    const { data } = await db.auth.signInAnonymously();
    const res = await request.post('/api/guest/session', { headers: auth(data.session!.access_token), data: { projectId: 'proj_does_not_exist' } });
    // This guest got no pass, so cleanup can't tell it apart from a real visitor: remove it here
    await supabaseAdmin.auth.admin.deleteUser(data.user!.id);
    expect(res.status()).toBe(404);
  });
});
