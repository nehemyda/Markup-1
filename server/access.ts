// Who may use the workspace, and their profile. These decisions are made on the server so browsers cannot change them.
import { FieldValue } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminDb } from './firebaseAdmin';

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
  const snap = await adminDb.doc('settings/access').get();
  const domains = snap.data()?.allowedDomains;
  return Array.isArray(domains) ? domains : DEFAULT_ALLOWED_DOMAINS;
}

async function activeMemberByEmail(email: string) {
  const snap = await adminDb.collection('users').where('email', '==', email).get();
  return snap.docs.find((d) => !d.data().removed) || null;
}

// Master admins, allowed domains, invited people and existing members may sign in
export async function checkAccess(rawEmail?: string | null): Promise<boolean> {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email.includes('@')) return false;
  if (isMasterAdmin(email)) return true;
  const domain = email.split('@')[1];
  if ((await allowedDomains()).some((d) => d.toLowerCase() === domain)) return true;
  if ((await adminDb.doc(`invites/${email}`).get()).exists) return true;
  return !!(await activeMemberByEmail(email));
}

export async function getMember(uid: string): Promise<MemberProfile | null> {
  const snap = await adminDb.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const data = snap.data() as MemberProfile;
  return data.removed ? null : { ...data, id: uid };
}

/**
 * Called after sign-in: load the member's profile, creating it on first sign-in.
 * Role: master admins are Owner; otherwise a pending invite's role; otherwise Member
 * (or Owner for the very first account when no master admin is configured).
 * Returns null when this account may not use the workspace (not allowed, or removed without a new invite).
 */
export async function startSession(token: DecodedIdToken): Promise<MemberProfile | null> {
  const email = (token.email || '').toLowerCase();
  if (!email || token.guestProject) return null;
  const ref = adminDb.doc(`users/${token.uid}`);
  const inviteRef = adminDb.doc(`invites/${email}`);

  return adminDb.runTransaction(async (tx) => {
    const [snap, invite] = await Promise.all([tx.get(ref), tx.get(inviteRef)]);
    const master = isMasterAdmin(email);

    if (snap.exists) {
      const profile = { ...(snap.data() as MemberProfile), id: token.uid, email };
      const updates: Partial<MemberProfile> = {};
      if (profile.removed) {
        if (!invite.exists && !master) return null;
        updates.removed = false;
        if (invite.exists && invite.data()?.role) updates.role = invite.data()!.role;
        if (invite.exists) tx.delete(inviteRef);
      }
      if (master && (profile.role !== 'Owner' || !profile.isMasterAdmin)) {
        updates.role = 'Owner';
        updates.isMasterAdmin = true;
      }
      if (Object.keys(updates).length) tx.set(ref, updates, { merge: true });
      return { ...profile, ...updates, removed: false };
    }

    if (!(await checkAccess(email))) return null;
    let isFirstUser = false;
    if (masterAdminEmails().length === 0) {
      isFirstUser = (await tx.get(adminDb.collection('users').limit(1))).empty;
    }
    const inviteData = invite.exists ? invite.data()! : null;
    const profile: MemberProfile = {
      id: token.uid,
      name: token.name || inviteData?.name || email.split('@')[0].replace(/\./g, ' '),
      email,
      avatar: token.picture || DEFAULT_AVATAR,
      role: master || isFirstUser ? 'Owner' : inviteData?.role || 'Member',
      organizationId: ORGANIZATION.id,
      organizationName: ORGANIZATION.name,
      status: 'online',
      cursorColor: '#6366f1',
      isMasterAdmin: master,
    };
    tx.set(ref, { ...profile, createdAt: FieldValue.serverTimestamp() });
    if (invite.exists) tx.delete(inviteRef);
    return profile;
  });
}
