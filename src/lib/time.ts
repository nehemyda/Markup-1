// Times shown for pins and comments. Older records saved the text "Just now" instead of a time; their real creation
// time is in their id (pin_<ms>, cmt_<ms>), so it is used as a fallback.
export function toMillis(value?: string | null, id?: string): number {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isNaN(parsed)) return parsed;
  const fromId = Number(id?.match(/(\d{12,})/)?.[1]);
  return Number.isFinite(fromId) ? fromId : 0;
}

// "just now", "1 minute ago", "5 minutes ago", "2 hours ago", "3 days ago", or a date for older ones
export function timeAgo(ms: number, now = Date.now()): string {
  if (!ms) return '';
  const minutes = Math.floor((now - ms) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Exact date and time, for tooltips and exports
export function fullTime(ms: number): string {
  return ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}
