/**
 * Workspace access: the allowed email domains, stored in the "access" settings row so they apply to everyone.
 * Anyone with an email on an allowed domain can create an account; anyone else needs an invite.
 * An empty list makes the workspace invite-only.
 */
import { useEffect, useState } from 'react';
import { mergeSetting, readSetting, subscribeSetting } from '../lib/supabaseSync';

export const DEFAULT_ALLOWED_DOMAINS = [
  'yourdigitalagents.com',
  'yourdigitalagens.com',
  'broadly.com',
  'vendasta.com'
];

let cachedDomains: string[] = [...DEFAULT_ALLOWED_DOMAINS];
const listeners = new Set<(domains: string[]) => void>();

function readDomains(data: any): string[] {
  return Array.isArray(data?.allowedDomains) ? data.allowedDomains : [...DEFAULT_ALLOWED_DOMAINS];
}

// Keep a live copy of the list for synchronous reads (getAllowedDomains) and React (useAllowedDomains)
subscribeSetting('access', (data) => {
  cachedDomains = readDomains(data);
  listeners.forEach((fn) => fn(cachedDomains));
});

export function getAllowedDomains(): string[] {
  return [...cachedDomains];
}

// Fresh read, used for sign-in checks
export async function fetchAllowedDomains(): Promise<string[]> {
  try {
    return readDomains(await readSetting('access'));
  } catch (err) {
    console.warn('Failed reading allowed domains:', err);
    return getAllowedDomains();
  }
}

export function useAllowedDomains(): string[] {
  const [domains, setDomains] = useState(getAllowedDomains);
  useEffect(() => {
    listeners.add(setDomains);
    setDomains(getAllowedDomains());
    return () => { listeners.delete(setDomains); };
  }, []);
  return domains;
}

export function saveAllowedDomains(domains: string[]): void {
  // Clean domains (strip leading @ or whitespace, convert to lowercase) and remove duplicates
  const unique = Array.from(new Set(
    domains.map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter((d) => d.length > 0)
  ));
  cachedDomains = unique;
  listeners.forEach((fn) => fn(unique));
  mergeSetting('access', { allowedDomains: unique }).catch((err) => console.error('Error saving allowed domains:', err));
}
