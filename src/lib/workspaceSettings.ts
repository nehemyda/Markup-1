// Workspace-wide settings stored in Firestore and editable by Owners/Admins on the Settings page:
// - settings/branding: app name and logo emblem (public: also shown on the sign-in page and guest links)
// - settings/access: allowed email domains (see utils/domains) and the guest review policy
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface Branding {
  appName: string;
  // 'auto' = initials of the app name; otherwise an emoji
  appIcon: string;
}

export interface GuestPolicy {
  // Share links work without an account (the server refuses guest passes when off)
  guestLinksEnabled: boolean;
  // Ask guests for their name before their first pin or comment
  askGuestName: boolean;
}

export const DEFAULT_BRANDING: Branding = { appName: 'WebReview Pro', appIcon: 'auto' };
export const DEFAULT_GUEST_POLICY: GuestPolicy = { guestLinksEnabled: true, askGuestName: true };

const brandingRef = doc(db, 'settings', 'branding');
const accessRef = doc(db, 'settings', 'access');

function useSettingsDoc<T extends object>(ref: typeof brandingRef, defaults: T, pick: (data: any) => Partial<T>): T {
  const [value, setValue] = useState<T>(defaults);
  useEffect(
    () => onSnapshot(ref, (snap) => setValue({ ...defaults, ...pick(snap.data() || {}) }), () => setValue(defaults)),
    []
  );
  return value;
}

export function useBranding(): Branding {
  return useSettingsDoc(brandingRef, DEFAULT_BRANDING, (d) => ({
    ...(typeof d.appName === 'string' && d.appName.trim() ? { appName: d.appName } : {}),
    ...(typeof d.appIcon === 'string' && d.appIcon ? { appIcon: d.appIcon } : {}),
  }));
}

export function useGuestPolicy(): GuestPolicy {
  return useSettingsDoc(accessRef, DEFAULT_GUEST_POLICY, (d) => ({
    ...(typeof d.guestLinksEnabled === 'boolean' ? { guestLinksEnabled: d.guestLinksEnabled } : {}),
    ...(typeof d.askGuestName === 'boolean' ? { askGuestName: d.askGuestName } : {}),
  }));
}

// Owners and Admins only (enforced by the security rules)
export function saveBranding(branding: Branding) {
  const appName = branding.appName.trim().slice(0, 40) || DEFAULT_BRANDING.appName;
  return setDoc(brandingRef, { appName, appIcon: branding.appIcon || 'auto', updatedAt: new Date().toISOString() }, { merge: true });
}

export function saveGuestPolicy(policy: Partial<GuestPolicy>) {
  return setDoc(accessRef, { ...policy, updatedAt: new Date().toISOString() }, { merge: true });
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
