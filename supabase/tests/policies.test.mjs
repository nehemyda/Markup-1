// Checks the database's security rules (supabase/migrations) on a local Postgres (PGlite, runs inside Node):
// who can read and change what, as members, admins, guests and signed-out visitors. Usage: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const db = new PGlite();
const results = [];
const check = (name, ok, extra = '') => { results.push([ok, name]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

// Supabase pieces the migration relies on
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
`);
let sql = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => fs.readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')).join('\n');
try { await db.exec('create publication supabase_realtime'); } catch (e) {
  console.log('(publication not supported here; skipping the realtime line)');
  sql = sql.replace(/alter publication supabase_realtime add table[\s\S]*?;/, '');
}
await db.exec(sql);
console.log('Migration applied.\n');

const A = '00000000-0000-0000-0000-00000000000a', M = '00000000-0000-0000-0000-00000000000b', M2 = '00000000-0000-0000-0000-00000000000c', G = '00000000-0000-0000-0000-00000000000d', R = '00000000-0000-0000-0000-00000000000e';
await db.exec(`
  insert into auth.users values ('${A}','owner@x.com'),('${M}','mem@x.com'),('${M2}','mem2@x.com'),('${G}',null),('${R}','gone@x.com');
  insert into users (id, auth_id, name, email, role, is_master_admin) values
    ('owner1','${A}','Owner','owner@x.com','Owner',true),
    ('mem1','${M}','Mem','mem@x.com','Member',false),
    ('mem2','${M2}','Mem Two','mem2@x.com','Member',false),
    ('gone1','${R}','Gone','gone@x.com','Member',false);
  update users set removed = true where id = 'gone1';
  insert into projects (id, name, assets, share_token) values ('P1','One','[{"id":"a1"}]','11111111-1111-4111-8111-111111111111'),('P2','Two','[]',default);
  insert into pins (id, project_id, asset_id, status, title, comments) values ('pin1','P1','a1','open','t','[]'),('pin2','P2','a2','open','t2','[]');
  insert into notifications (id, recipient_uid, title) values ('n1','mem1','for mem'),('n2','owner1','for owner');
  insert into settings (id, value) values ('access','{"allowedDomains":["x.com"]}'),('branding','{"appName":"M"}'),('permissions','{}'),('chat','{}');
  insert into wp_site_secrets (id, app_password) values ('P1','secret');
  insert into ai_usage (month, feature, project_id, input_tokens, output_tokens, cost_usd) values ('2026-10','review','P1',100,50,0.5),('2026-10','fix',null,10,5,0.25);
`);

// Run SQL as a browser caller: role + JWT claims, inside a transaction that is rolled back
async function as(who, query) {
  const claims = who === 'anon' ? { role: 'anon' } : { role: 'authenticated', sub: who.sub, email: who.email, app_metadata: who.app_metadata || {}, is_anonymous: !!who.anon };
  const role = who === 'anon' ? 'anon' : 'authenticated';
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await db.exec(`set local role ${role}`);
    const r = await db.query(query);
    return { rows: r.rows, affected: r.affectedRows };
  } catch (e) { return { error: e.message }; }
  finally { await db.exec('rollback'); }
}
const owner = { sub: A, email: 'owner@x.com' }, mem = { sub: M, email: 'mem@x.com' }, mem2 = { sub: M2, email: 'mem2@x.com' };
const T1 = '11111111-1111-4111-8111-111111111111';
const guest = { sub: G, anon: true, app_metadata: { guest_project: 'P1', guest_share: T1 } }, nopass = { sub: G, anon: true }, removed = { sub: R, email: 'gone@x.com' };
const n = (r) => r.rows?.length ?? -1;

// Reading
check('member reads all projects', n(await as(mem, 'select id from projects')) === 2);
check('member reads all pins', n(await as(mem, 'select id from pins')) === 2);
{ const r = await as('anon', 'select id from projects'); check('signed-out visitor reads no projects', n(r) === 0 || /permission denied/.test(r.error || ''), r.error || ''); }
check('signed-out visitor reads access + branding settings only', JSON.stringify((await as('anon', 'select id from settings order by id')).rows.map(r => r.id)) === '["access","branding"]');
check('member also reads permissions settings, not chat', JSON.stringify((await as(mem, 'select id from settings order by id')).rows.map(r => r.id)) === '["access","branding","permissions"]');
check('guest reads only their project', JSON.stringify((await as(guest, 'select id from projects')).rows.map(r => r.id)) === '["P1"]');
check('guest reads only their project\'s pins', JSON.stringify((await as(guest, 'select id from pins')).rows.map(r => r.id)) === '["pin1"]');
// Share codes (/review/<uuid>): a pass counts only with the project's current code
{ const oldPass = { sub: G, anon: true, app_metadata: { guest_project: 'P1' } };
  check('guest pass from before share codes reads nothing', n(await as(oldPass, 'select id from projects')) === 0 && n(await as(oldPass, 'select id from pins')) === 0); }
{ const wrong = { sub: G, anon: true, app_metadata: { guest_project: 'P1', guest_share: '22222222-2222-4222-8222-222222222222' } };
  check('guest pass with a wrong share code reads nothing', n(await as(wrong, 'select id from projects')) === 0); }
check('browsers cannot change a share code', (await as(mem, `update projects set share_token = '33333333-3333-4333-8333-333333333333' where id='P1' returning share_token`)).rows?.[0]?.share_token === T1);
{ const r = await as(mem, `insert into projects (id, name, share_token) values ('P9','New','44444444-4444-4444-8444-444444444444') returning share_token`);
  check('a new project gets a random share code, not one the browser picks', !r.error && r.rows?.[0]?.share_token && r.rows[0].share_token !== '44444444-4444-4444-8444-444444444444', r.error || ''); }
{ const before = (await db.query(`select link_id from projects where id = 'P1'`)).rows[0].link_id;
  check('browsers cannot change a project\'s link id', (await as(mem, `update projects set link_id = '66666666-6666-4666-8666-666666666666' where id='P1' returning link_id`)).rows?.[0]?.link_id === before); }
await db.exec(`update projects set share_token = '55555555-5555-4555-8555-555555555555' where id = 'P1'`);
check('after the link is reset, the old pass reads nothing', n(await as(guest, 'select id from projects')) === 0 && n(await as(guest, 'select id from pins')) === 0);
await db.exec(`update projects set share_token = '${T1}' where id = 'P1'`);
check('anonymous account without a pass reads nothing', n(await as(nopass, 'select id from pins')) === 0 && n(await as(nopass, 'select id from projects')) === 0);
check('removed member reads nothing', n(await as(removed, 'select id from projects')) === 0);
check('guest cannot read the team', n(await as(guest, 'select id from users')) === 0);
check('member cannot read WordPress passwords', n(await as(mem, 'select * from wp_site_secrets')) === 0);
check('owner cannot read WordPress passwords either (server only)', n(await as(owner, 'select * from wp_site_secrets')) === 0);

// Guests writing
check('guest adds a pin to their project', !(await as(guest, `insert into pins (id, project_id, title) values ('g1','P1','x')`)).error);
check('guest cannot add a pin to another project', !!(await as(guest, `insert into pins (id, project_id, title) values ('g2','P2','x')`)).error);
check('guest comments on a pin', (await as(guest, `update pins set comments = '[{"id":"c1"}]' where id='pin1'`)).affected === 1);
const upsertSame = `insert into pins (id, project_id, asset_id, status, title, comments) values ('pin1','P1','a1','open','t','[{"id":"c2"}]')
  on conflict (id) do update set project_id=excluded.project_id, asset_id=excluded.asset_id, status=excluded.status, title=excluded.title, comments=excluded.comments`;
check('guest saves the whole pin with only a new comment (app save)', !(await as(guest, upsertSame)).error);
check('guest cannot change a pin\'s status', !!(await as(guest, `update pins set status='resolved' where id='pin1'`)).error);
check('guest cannot delete pins', (await as(guest, `delete from pins where id='pin1'`)).affected === 0);
check('guest adds a page to their project', (await as(guest, `update projects set assets = assets || '[{"id":"a9"}]' where id='P1'`)).affected === 1);
check('guest cannot rename the project', !!(await as(guest, `update projects set name='hacked' where id='P1'`)).error);
check('guest cannot remove pages', !!(await as(guest, `update projects set assets='[]' where id='P1'`)).error);
check('guest cannot create projects', !!(await as(guest, `insert into projects (id, name) values ('P3','x')`)).error);

// Members and admins
check('member edits own name', (await as(mem, `update users set name='New' where id='mem1'`)).affected === 1);
check('member cannot raise own role', !!(await as(mem, `update users set role='Owner' where id='mem1'`)).error);
check('member cannot change someone else', !!(await as(mem, `update users set name='x' where id='mem2'`)).error);
check('admin changes a member\'s role', (await as(owner, `update users set role='Admin' where id='mem1'`)).affected === 1);
check('admin cannot rename a member', !!(await as(owner, `update users set name='x' where id='mem1'`)).error);
check('nobody changes the master admin', !!(await as(owner, `update users set role='Member' where id='owner1'`)).error);
// Owners: only an Owner changes an Owner or makes someone an Owner
const AD = '00000000-0000-0000-0000-0000000000f1', O2 = '00000000-0000-0000-0000-0000000000f2';
await db.exec(`
  insert into auth.users values ('${AD}','admin@x.com'),('${O2}','owner2@x.com');
  insert into users (id, auth_id, name, email, role) values ('admin1','${AD}','Admin','admin@x.com','Admin'),('owner2','${O2}','Owner Two','owner2@x.com','Owner');
`);
const admin = { sub: AD, email: 'admin@x.com' };
check('admin cannot remove an Owner', !!(await as(admin, `update users set removed = true where id='owner2'`)).error);
check('admin cannot demote an Owner', !!(await as(admin, `update users set role='Member' where id='owner2'`)).error);
check('admin cannot make someone an Owner', !!(await as(admin, `update users set role='Owner' where id='mem1'`)).error);
check('admin still changes a member\'s role', (await as(admin, `update users set role='Admin' where id='mem1'`)).affected === 1);
check('admin still removes a member', (await as(admin, `update users set removed = true where id='mem2'`)).affected === 1);
check('an Owner changes another Owner', (await as(owner, `update users set role='Admin' where id='owner2'`)).affected === 1);
check('admin cannot invite as Owner', !!(await as(admin, `insert into invites (id, email, role, invited_by) values ('o@x.com','o@x.com','Owner','admin@x.com')`)).error);
check('an Owner invites as Owner', !(await as(owner, `insert into invites (id, email, role, invited_by) values ('o@x.com','o@x.com','Owner','owner@x.com')`)).error);
check('browsers cannot create profiles', !!(await as(mem, `insert into users (id, name) values ('x','x')`)).error);
check('member creates a project', !(await as(mem, `insert into projects (id, name) values ('P4','x')`)).error);
check('browsers cannot delete projects (the server keeps them for 30 days)', (await as(mem, `delete from projects where id='P2'`)).affected === 0);
await db.exec(`insert into deleted_projects (id, name, project) values ('P9', 'old', '{}')`);
check('member sees recently deleted projects', (await as(mem, `select * from deleted_projects`)).rows?.length === 1);
check('guest cannot see recently deleted projects', (await as(guest, `select * from deleted_projects`)).rows?.length === 0);
check('browsers cannot restore or empty the list', !!(await as(mem, `delete from deleted_projects where id='P9'`)).error || (await as(mem, `delete from deleted_projects where id='P9'`)).affected === 0);

// Invites
check('member invites as Member', !(await as(mem, `insert into invites (id, email, role, invited_by) values ('new@x.com','new@x.com','Member','mem@x.com')`)).error);
check('member cannot invite as Admin', !!(await as(mem, `insert into invites (id, email, role, invited_by) values ('new@x.com','new@x.com','Admin','mem@x.com')`)).error);
check('member cannot invite in someone else\'s name', !!(await as(mem, `insert into invites (id, email, role, invited_by) values ('new@x.com','new@x.com','Member','owner@x.com')`)).error);
check('admin invites as Admin', !(await as(owner, `insert into invites (id, email, role, invited_by) values ('new@x.com','new@x.com','Admin','owner@x.com')`)).error);
await db.exec(`update settings set value = '{"membersCanInvite": false}' where id='permissions'`);
check('member cannot invite when "Invite teammates" is off', !!(await as(mem, `insert into invites (id, email, role, invited_by) values ('new@x.com','new@x.com','Member','mem@x.com')`)).error);
await db.exec(`update settings set value = '{}' where id='permissions'`);

// Notifications
check('member reads only their notifications', JSON.stringify((await as(mem, 'select id from notifications')).rows.map(r => r.id)) === '["n1"]');
check('member marks their notification read', (await as(mem, `update notifications set read=true, read_at='now' where id='n1'`)).affected === 1);
check('member cannot change notification text', !!(await as(mem, `update notifications set title='x' where id='n1'`)).error);
check('member cannot mark someone else\'s', (await as(mem, `update notifications set read=true where id='n2'`)).affected === 0);
check('browsers cannot create notifications', !!(await as(mem, `insert into notifications (id, recipient_uid) values ('n3','mem1')`)).error);

// Settings
check('admin merges a setting', !(await as(owner, `select settings_merge('branding', '{"appName":"New"}')`)).error);
check('member cannot change settings', !!(await as(mem, `select settings_merge('branding', '{"appName":"New"}')`)).error);
check('admin cannot write server-only settings (chat)', !!(await as(owner, `select settings_merge('chat', '{"lastSentDate":"x"}')`)).error);
await db.exec(`select settings_merge('branding', '{"appIcon":"🙂"}')`);
check('settings_merge keeps other fields', JSON.stringify((await db.query(`select value from settings where id='branding'`)).rows[0].value) === '{"appIcon":"🙂","appName":"M"}');

// AI usage, summary claim
const months = await as(owner, 'select * from ai_usage_monthly');
check('admin sees monthly AI totals', n(months) === 1 && months.rows[0].requests === 2 && Math.abs(months.rows[0].cost_usd - 0.75) < 1e-9 && months.rows[0].projects.P1.requests === 1 && months.rows[0].features.fix.costUsd === 0.25, JSON.stringify(months.rows[0] || months.error));
check('member sees no AI totals', n(await as(mem, 'select * from ai_usage_monthly')) === 0);
check('summary day is claimed once', (await db.query(`select claim_summary_day('2026-10-27') a`)).rows[0].a === true && (await db.query(`select claim_summary_day('2026-10-27') a`)).rows[0].a === false);
check('browsers cannot claim the summary', !!(await as(owner, `select claim_summary_day('2026-10-28')`)).error);

// Client revisions: the link is view-only for guests after they submit
await db.exec(`insert into revisions (id, project_id, number, pin_ids) values ('P1_r1','P1',1,'{pin1}'),('P2_r1','P2',1,'{}')`);
check('guest reads only their project\'s revisions', JSON.stringify((await as(guest, 'select id from revisions')).rows.map(r => r.id)) === '["P1_r1"]');
check('browsers cannot write revisions', !!(await as(mem, `insert into revisions (id, project_id, number) values ('x','P1',9)`)).error);
check('a pin added by a browser starts unsubmitted', (await as(mem, `insert into pins (id, project_id, title, revision) values ('m9','P1','x',7) returning revision`)).rows?.[0]?.revision === null);
check('a browser cannot change a pin\'s revision', (await as(mem, `update pins set revision = 5 where id='pin1' returning revision`)).rows?.[0]?.revision === null);
await db.exec(`update projects set review_state = 'submitted', revision_count = 1 where id = 'P1'`);
check('after submitting, the guest cannot add pins', !!(await as(guest, `insert into pins (id, project_id, title) values ('g3','P1','x')`)).error);
check('after submitting, the guest cannot comment', (await as(guest, `update pins set comments = '[{"id":"c9"}]' where id='pin1'`)).affected === 0);
check('after submitting, the guest cannot add pages', (await as(guest, `update projects set assets = assets || '[{"id":"a8"}]' where id='P1'`)).affected === 0);
check('after submitting, the guest still sees the project and pins', n(await as(guest, 'select id from projects')) === 1 && n(await as(guest, 'select id from pins')) === 1);
check('the team still adds pins', !(await as(mem, `insert into pins (id, project_id, title) values ('m3','P1','x')`)).error);
check('a browser saving an old copy does not reopen the project', (await as(mem, `update projects set review_state = 'open', revision_count = 0, name = 'One' where id='P1' returning review_state, revision_count`)).rows?.[0]?.review_state === 'submitted');
await db.exec(`update projects set review_state = 'open' where id = 'P1'`);
check('reopened: the guest adds pins again', !(await as(guest, `insert into pins (id, project_id, title) values ('g4','P1','x')`)).error);

// Teams and out of office
check('member sets their own out of office', (await as(mem, `update users set out_of_office = true, out_of_office_until = '2026-11-02' where id='mem1'`)).affected === 1);
check('admin sets a member\'s out of office', (await as(owner, `update users set out_of_office = true where id='mem2'`)).affected === 1);
check('member cannot set someone else\'s out of office', !!(await as(mem, `update users set out_of_office = true where id='mem2'`)).error);
check('admin creates a team', !(await as(owner, `insert into teams (id, name, manager_id, lead_id, member_ids) values ('t1','Web','owner1','mem1','{mem2}')`)).error);
check('member cannot create a team', !!(await as(mem, `insert into teams (id, name) values ('t2','x')`)).error);
await db.exec(`insert into teams (id, name, manager_id, lead_id, member_ids) values ('t1','Web','owner1','mem1','{mem2}')`);
check('members read teams', n(await as(mem, 'select id from teams')) === 1);
check('member cannot change a team', (await as(mem, `update teams set name='x' where id='t1'`)).affected === 0);
check('guests cannot read teams', n(await as(guest, 'select id from teams')) === 0);

// Deadline settings
check('admin saves deadline settings', !(await as(owner, `select settings_merge('revisions', '{"dueDays":3}')`)).error);
check('member cannot change deadline settings', !!(await as(mem, `select settings_merge('revisions', '{"dueDays":9}')`)).error);
await db.exec(`select settings_merge('revisions', '{"dueDays":3}')`);
check('members read deadline settings', n(await as(mem, `select id from settings where id='revisions'`)) === 1);
check('signed-out visitors cannot read deadline settings', n(await as('anon', `select id from settings where id='revisions'`)) === 0);
check('a browser cannot change the reminder time', (await as(mem, `update projects set unsent_reminded_at = now(), name = 'One' where id='P1' returning unsent_reminded_at`)).rows?.[0]?.unsent_reminded_at === null);

check('a browser cannot change a project preview', (await as(mem, `update projects set preview_url = 'x', name = 'One' where id='P1' returning preview_url`)).rows?.[0]?.preview_url === null);

// Internal pins: the team's pins never reach guests
check('a member\'s new pin is internal', (await as(mem, `insert into pins (id, project_id, title, number, internal) values ('qa1','P1','QA note', 50, false) returning internal`)).rows?.[0]?.internal === true);
check('a guest\'s new pin is not internal', (await as(guest, `insert into pins (id, project_id, title, internal) values ('g5','P1','x', true) returning internal`)).rows?.[0]?.internal === false);
await db.exec(`insert into pins (id, project_id, title, number, internal) values ('qa1','P1','QA note', 50, true)`);
check('guests do not read internal pins', !(await as(guest, 'select id from pins')).rows.some((r) => ['qa1', 'm3', 'm9'].includes(r.id)));
check('members read internal pins', n(await as(mem, `select id from pins where id='qa1'`)) === 1);
check('guests cannot comment on internal pins', (await as(guest, `update pins set comments = '[{"id":"c7"}]' where id='qa1'`)).affected === 0);
check('a browser cannot make an internal pin visible', (await as(mem, `update pins set internal = false where id='qa1' returning internal`)).rows?.[0]?.internal === true);
check('a guest\'s pin number counts internal pins', (await as(guest, `insert into pins (id, project_id, title, number) values ('g6','P1','x', 1) returning number`)).rows?.[0]?.number === 51);

const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
