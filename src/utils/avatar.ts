/**
 * Utility functions for dynamically generating and fetching Google Workspace profile avatars
 * based on user email addresses (@yourdigitalagents.com, @broadly.com, etc.)
 */

// Google Workspace color palette for fallback letter badges
const GOOGLE_WORKSPACE_COLORS = [
  '#1A73E8', // Google Blue
  '#EA4335', // Google Red
  '#137333', // Google Green
  '#E37400', // Google Orange / Amber
  '#A142F4', // Google Purple
  '#129EAF', // Google Teal
  '#C5221F', // Google Deep Red
  '#B06000', // Google Dark Orange
  '#701A75', // Google Deep Purple
  '#00796B', // Google Dark Teal
];

/**
 * Returns a deterministic Google Workspace color based on the email address string
 */
export function getGoogleAvatarColor(email?: string): string {
  if (!email) return GOOGLE_WORKSPACE_COLORS[0];
  let hash = 0;
  const cleaned = email.trim().toLowerCase();
  for (let i = 0; i < cleaned.length; i++) {
    hash = cleaned.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GOOGLE_WORKSPACE_COLORS.length;
  return GOOGLE_WORKSPACE_COLORS[index];
}

/**
 * Generates the user's display initials from name or email (e.g. "Nehemiah C." -> "NC", "Website Services" -> "WS")
 */
export function getUserInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.replace(/\(you\)|\(QA Lead\)|\(QA Tester\)/gi, '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
      return parts[0].substring(0, 2).toUpperCase();
    }
  }
  if (email && email.trim()) {
    const username = email.split('@')[0];
    const parts = username.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  }
  return 'GW';
}

/**
 * Constructs dynamic Google Workspace profile photo URLs.
 * Google Workspace accounts publish public profile pictures via Google's profile photo services.
 */
export function getGoogleWorkspaceAvatarUrl(email?: string, size = 160): string {
  if (!email) return '';
  const cleanEmail = email.trim().toLowerCase();
  
  // Primary Google Workspace profile photo endpoint
  return `https://profiles.google.com/s2/photos/profile/${encodeURIComponent(cleanEmail)}?sz=${size}`;
}

/**
 * Secondary fallback Google Workspace photo endpoint (e.g. via unavatar service)
 */
export function getGoogleWorkspaceFallbackAvatarUrl(email?: string): string {
  if (!email) return '';
  const cleanEmail = email.trim().toLowerCase();
  return `https://unavatar.io/google/${encodeURIComponent(cleanEmail)}`;
}
