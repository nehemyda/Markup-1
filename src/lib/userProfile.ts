import { User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { AuthUser, Organization } from '../types';
import { fetchAllowedDomains, getAllowedDomains } from '../utils/domains';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

/**
 * Who can sign in:
 * - master admins (VITE_ADMIN_EMAILS)
 * - anyone with an email on an allowed domain (domain-based access)
 * - anyone with a pending invite, whatever their domain (user-based access)
 * - existing members who have not been removed
 */
export async function checkWorkspaceAccess(email: string | null | undefined): Promise<boolean> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return false;
  if (isMasterAdmin(normalized)) return true;

  const domain = normalized.split('@')[1];
  if ((await fetchAllowedDomains()).some((d) => d.toLowerCase() === domain)) return true;

  try {
    if ((await getDoc(doc(db, 'invites', normalized))).exists()) return true;
    const members = await getDocs(query(collection(db, 'users'), where('email', '==', normalized)));
    return members.docs.some((d) => !d.data().removed);
  } catch (err) {
    console.warn('Failed checking workspace access:', err);
    return false;
  }
}

export function accessDeniedMessage(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase().trim() || '';
  return `Access denied: @${domain} is not an allowed domain and ${email} has not been invited. Ask a workspace admin to invite you.`;
}

// Default Enterprise Organization with Unlimited Seats SLA
export function getDefaultOrganization(): Organization {
  try {
    const saved = localStorage.getItem('mf_auth_org');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return {
    id: 'org-yda-enterprise',
    name: 'YourDigitalAgents Enterprise',
    domain: 'yourdigitalagents.com',
    allowedDomains: getAllowedDomains(),
    plan: 'Enterprise',
    ssoEnabled: true,
    maxSeats: 'Unlimited',
    activeSeats: 12,
  };
}

// Master admin emails from .env (VITE_ADMIN_EMAILS, comma-separated). These accounts are always Owner.
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isMasterAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// Take (and clear) a pending invitation for this email, if there is one
async function consumeInvite(email: string): Promise<{ name?: string; role?: string } | null> {
  if (!email) return null;
  const ref = doc(db, 'invites', email.toLowerCase());
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    await deleteDoc(ref);
    return snap.data() as { name?: string; role?: string };
  } catch (err) {
    console.warn('Failed reading invite from Firestore:', err);
    return null;
  }
}

// Load the user's profile from Firestore (users/{uid}), creating it on first sign-in.
// Role: master admins (VITE_ADMIN_EMAILS) are always Owner; otherwise a pending invite's role;
// otherwise Member (or Owner for the very first account when no master admin is configured).
// Returns null when the member was removed from the workspace and has no new invite.
export async function loadOrCreateProfile(fbUser: User, org: Organization): Promise<AuthUser | null> {
  const ref = doc(db, 'users', fbUser.uid);
  const email = fbUser.email || '';
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existing = { ...(snap.data() as AuthUser & { removed?: boolean }), id: fbUser.uid, email };
      let changed = false;
      if (existing.removed) {
        const invite = await consumeInvite(email);
        if (!invite && !isMasterAdmin(email)) return null;
        existing.removed = false;
        if (invite?.role) existing.role = invite.role as any;
        changed = true;
      }
      if (isMasterAdmin(email) && existing.role !== 'Owner') {
        existing.role = 'Owner' as any;
        changed = true;
      }
      if (changed) await saveProfile(existing);
      return existing;
    }
  } catch (err) {
    console.warn('Failed loading user profile from Firestore:', err);
  }

  let isFirstUser = false;
  if (ADMIN_EMAILS.length === 0) {
    try {
      isFirstUser = (await getDocs(query(collection(db, 'users'), limit(1)))).empty;
    } catch (err) {
      console.warn('Failed checking existing users:', err);
    }
  }

  const invite = await consumeInvite(email);
  const role = isMasterAdmin(email) || isFirstUser ? 'Owner' : (invite?.role || 'Member');

  const profile: AuthUser = {
    id: fbUser.uid,
    name: fbUser.displayName || invite?.name || email.split('@')[0].replace(/\./g, ' '),
    email,
    avatar: fbUser.photoURL || DEFAULT_AVATAR,
    role: role as any,
    organizationId: org.id,
    organizationName: org.name,
    status: 'online',
    cursorColor: '#6366f1',
  };
  await saveProfile(profile);
  return profile;
}

export async function saveProfile(profile: AuthUser & { department?: string; removed?: boolean }): Promise<void> {
  try {
    await setDoc(doc(db, 'users', profile.id), profile, { merge: true });
  } catch (err) {
    console.warn('Failed saving user profile to Firestore:', err);
  }
}
