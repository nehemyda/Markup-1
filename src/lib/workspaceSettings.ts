// Workspace-wide settings stored in the settings table and editable by Owners/Admins on the Settings page:
// - branding: app name and logo emblem (public: also shown on the sign-in page and guest links)
// - access: allowed email domains (see utils/domains) and the guest review policy
import { useEffect, useState } from 'react';
import { mergeSetting, subscribeSetting } from './supabaseSync';

export interface Branding {
  appName: string;
  // 'auto' = initials of the app name; otherwise an emoji
  appIcon: string;
}

export interface GuestPolicy {
  // Share links work without an account (the server refuses guest passes when off)
  guestLinksEnabled: boolean;
}

export const DEFAULT_BRANDING: Branding = { appName: 'WebReview Pro', appIcon: 'auto' };
export const DEFAULT_GUEST_POLICY: GuestPolicy = { guestLinksEnabled: true };

function useSetting<T extends object>(id: string, defaults: T, pick: (data: any) => Partial<T>): T {
  const [value, setValue] = useState<T>(defaults);
  useEffect(() => subscribeSetting(id, (data) => setValue({ ...defaults, ...pick(data || {}) })), []);
  return value;
}

export function useBranding(): Branding {
  return useSetting('branding', DEFAULT_BRANDING, (d) => ({
    ...(typeof d.appName === 'string' && d.appName.trim() ? { appName: d.appName } : {}),
    ...(typeof d.appIcon === 'string' && d.appIcon ? { appIcon: d.appIcon } : {}),
  }));
}

export function useGuestPolicy(): GuestPolicy {
  return useSetting('access', DEFAULT_GUEST_POLICY, (d) => ({
    ...(typeof d.guestLinksEnabled === 'boolean' ? { guestLinksEnabled: d.guestLinksEnabled } : {}),
  }));
}

// Owners and Admins only (enforced by the database rules)
export function saveBranding(branding: Branding) {
  const appName = branding.appName.trim().slice(0, 40) || DEFAULT_BRANDING.appName;
  return mergeSetting('branding', { appName, appIcon: branding.appIcon || 'auto' });
}

export function saveGuestPolicy(policy: Partial<GuestPolicy>) {
  return mergeSetting('access', policy);
}

// "WebReview Pro" -> "WP", "Markup" -> "M"
export function brandInitials(appName: string) {
  const words = appName.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'W';
  const letters = words.length === 1 ? words[0].slice(0, 1) : words.slice(0, 2).map((w) => w[0]).join('');
  return letters.toUpperCase();
}

export function brandEmblem(branding: Branding) {
  return branding.appIcon === 'auto' ? brandInitials(branding.appName) : branding.appIcon;
}
