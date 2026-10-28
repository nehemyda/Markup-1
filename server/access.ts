// Who may use the workspace, and their profile. These decisions are made on the server so browsers cannot change them.
import type { CallerToken } from './auth';
import { findRows, getRow, getSetting, deleteRow, insertRow, now, supabaseAdmin, updateRow } from './db';
import { fromRow } from '../src/lib/rows';

export const DEFAULT_ALLOWED_DOMAINS = ['yourdigitalagents.com', 'yourdigitalagens.com', 'broadly.com', 'vendasta.com'];
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
const ORGANIZATION = { id: 'org-yda-enterprise', name: 'YourDigitalAgents Enterprise' };

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  organizationId: string;
  organizationName: string;
  status: string;
  cursorColor: string;
  isMasterAdmin?: boolean;
  removed?: boolean;
  department?: string;
}

const masterAdminEmails = () =>
  (process.env.VITE_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isMasterAdmin = (email?: string | null) => !!email && masterAdminEmails().includes(email.toLowerCase());
export const isAdminRole = (role?: string) => role === 'Owner' || role === 'Admin';

async function allowedDomains(): Promise<string[]> {
  const domains = (await getSetting('access')).allowedDomains;
  return Array.isArray(domains) ? domains : DEFAULT_ALLOWED_DOMAINS;
}

async function membersByEmail(email: string): Promise<(MemberProfile & { authId?: string | null })[]> {
  // Same email in any letter case (_ and % would otherwise be wildcards)
  const { data, error } = await supabaseAdmin.from('users').select('*').ilike('email', email.replace(/[\\%_]/g, '\\$&'));
  if (error) throw new Error(error.message);
  return (data || []).map((r) => fromRow(r));
}

// Master admins, allowed domains, invited people and existing members may sign in
export async function checkAccess(rawEmail?: string | null): Promise<boolean> {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email.includes('@')) return false;
  if (isMasterAdmin(email)) return true;
  const domain = email.split('@')[1];
  if ((await allowedDomains()).some((d) => d.toLowerCase() === domain)) return true;
  if (await getRow('invites', email)) return true;
  return (await membersByEmail(email)).some((m) => !m.removed);
}

// The member signed in with this Supabase account (null when removed or not a member)
export async function getMember(authId: string): Promise<MemberProfile | null> {
  const [member] = await findRows<MemberProfile>('users', { authId });
  return member && !member.removed ? member : null;
}

/**
 * Called after sign-in: load the member's profile, creating it on first sign-in.
 * Role: master admins are Owner; otherwise a pending invite's role; otherwise Member
 * (or Owner for the very first account when no master admin is configured).
 * A profile without a sign-in account yet (e.g. moved from Firebase) is linked by its verified email.
 * Returns null when this account may not use the workspace (not allowed, or removed without a new invite).
 */
// Several tabs signing in together share one check, so the profile isn't created twice
const starting = new Map<string, Promise<MemberProfile | null>>();
export function startSession(token: CallerToken): Promise<MemberProfile | null> {
  let pending = starting.get(token.authId);
  if (!pending) {
    pending = loadOrCreateProfile(token).finally(() => starting.delete(token.authId));
    starting.set(token.authId, pending);
  }
  return pending;
}

async function loadOrCreateProfile(token: CallerToken, retried = false): Promise<MemberProfile | null> {
  const email = token.email;
  if (!email || token.guestProject) return null;
  const invite = await getRow('invites', email);
  const master = isMasterAdmin(email);

  let [profile] = await findRows<MemberProfile & { authId?: string | null }>('users', { authId: token.authId });
  if (!profile && token.emailVerified) {
    profile = (await membersByEmail(email)).find((m) => !m.authId);
    if (profile) await updateRow('users', profile.id, { authId: token.authId });
  }

  if (profile) {
    const updates: Partial<MemberProfile> = {};
    if (profile.removed) {
      if (!invite && !master) return null;
      updates.removed = false;
      if (invite?.role) updates.role = invite.role;
      if (invite) await deleteRow('invites', email);
    }
    if (master && (profile.role !== 'Owner' || !profile.isMasterAdmin)) {
      updates.role = 'Owner';
      updates.isMasterAdmin = true;
    }
    if (Object.keys(updates).length) await updateRow('users', profile.id, updates);
    const { authId, ...rest } = { ...profile, ...updates, email, removed: false };
    return rest;
  }

  if (!(await checkAccess(email))) return null;
  let isFirstUser = false;
  if (masterAdminEmails().length === 0) {
    const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true });
    isFirstUser = !count;
  }
  const created: MemberProfile = {
    id: token.authId,
    name: token.name || invite?.name || email.split('@')[0].replace(/\./g, ' '),
    email,
    avatar: token.picture || DEFAULT_AVATAR,
    role: master || isFirstUser ? 'Owner' : invite?.role || 'Member',
    organizationId: ORGANIZATION.id,
    organizationName: ORGANIZATION.name,
    status: 'online',
    cursorColor: '#6366f1',
    isMasterAdmin: master,
  };
  try {
    await insertRow('users', { ...created, authId: token.authId, createdAt: now() });
  } catch (err: any) {
    // Created by another sign-in at the same moment: use that one
    if (!retried && /duplicate key/i.test(err?.message || '')) return loadOrCreateProfile(token, true);
    throw err;
  }
  if (invite) await deleteRow('invites', email);
  return created;
}
