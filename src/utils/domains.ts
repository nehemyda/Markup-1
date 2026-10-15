/**
 * Utility functions for Master Admin Organization Domain Access Control
 */

export const DEFAULT_ALLOWED_DOMAINS = [
  'yourdigitalagents.com',
  'yourdigitalagens.com',
  'broadly.com',
  'vendasta.com'
];

export function getAllowedDomains(): string[] {
  try {
    const saved = localStorage.getItem('mf_allowed_domains');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading allowed domains from localStorage:', e);
  }
  return [...DEFAULT_ALLOWED_DOMAINS];
}

export function saveAllowedDomains(domains: string[]): void {
  try {
    // Clean domains (strip leading @ or whitespace, convert to lowercase)
    const cleaned = domains
      .map(d => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(d => d.length > 0);
    
    // Remove duplicates
    const unique = Array.from(new Set(cleaned));
    localStorage.setItem('mf_allowed_domains', JSON.stringify(unique));
  } catch (e) {
    console.error('Error saving allowed domains to localStorage:', e);
  }
}
