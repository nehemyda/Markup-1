import { supabase } from './supabase';
import { apiFetch } from './api';
import { toRow } from './rows';
import { AuthUser, Organization } from '../types';
import { getAllowedDomains } from '../utils/domains';

// Who can sign in is decided by the server (master admins, allowed domains, invites, existing members).
// This only asks yes/no, e.g. before creating an account.
export async function checkWorkspaceAccess(email: string | null | undefined): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/check-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email || '' }),
    });
    return !!(await res.json()).allowed;
  } catch {
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

// Email domains of the master admin accounts (e.g. yourdigitalagents.com)
export function masterAdminDomains(): string[] {
  return Array.from(new Set(ADMIN_EMAILS.map((e) => e.split('@')[1]).filter(Boolean)));
}

export function isMasterAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// After sign-in the server loads (or creates) the member profile and decides the role.
// Throws with a readable message when this account may not use the workspace.
export async function startSession(): Promise<AuthUser> {
  const res = await apiFetch('/api/auth/session', { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.profile) throw new Error(body.error || 'Could not sign in. Please try again.');
  return body.profile as AuthUser;
}

// Save your own profile. Only these fields are yours to change; role and email are managed by the server/admins.
export async function saveProfile(profile: AuthUser & { department?: string; outOfOffice?: boolean; outOfOfficeUntil?: string | null }): Promise<void> {
  const editable: Record<string, unknown> = {
    name: profile.name,
    avatar: profile.avatar,
    status: profile.status,
    cursorColor: profile.cursorColor,
  };
  if (profile.department !== undefined) editable.department = profile.department;
  if (profile.outOfOffice !== undefined) {
    editable.outOfOffice = profile.outOfOffice;
    editable.outOfOfficeUntil = profile.outOfOfficeUntil || null;
  }
  const { error } = await supabase.from('users').update(toRow('users', editable)).eq('id', profile.id);
  if (error) console.warn('Failed saving user profile:', error.message);
}
