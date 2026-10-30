// The app works with camelCase records (e.g. pin.assignedTo); the database uses snake_case columns (assigned_to).
// This maps one to the other for the top level of a record; nested jsonb (comments, assets, ...) is kept as is.
// Used by the browser and the server. Columns must match supabase/migrations.

export const TABLE_COLUMNS = {
  users: ['id', 'authId', 'name', 'email', 'avatar', 'role', 'organizationId', 'organizationName', 'status', 'cursorColor', 'department', 'isMasterAdmin', 'removed', 'removedAt', 'outOfOffice', 'outOfOfficeUntil', 'createdAt'],
  invites: ['id', 'name', 'email', 'role', 'invitedBy', 'invitedAt'],
  folders: ['id', 'name', 'createdAt', 'createdBy'],
  projects: ['id', 'name', 'client', 'description', 'color', 'avatar', 'memberCount', 'lastUpdated', 'ownerId', 'createdBy', 'assigneeIds', 'folderId', 'agid', 'assets', 'reviewState', 'revisionCount', 'unsentRemindedAt', 'previewUrl', 'previewAt', 'previewError', 'shareToken', 'linkId', 'updatedAt'],
  pins: ['id', 'projectId', 'assetId', 'number', 'x', 'y', 'category', 'status', 'priority', 'title', 'createdAt', 'author', 'assignedTo', 'assignedBy', 'metadata', 'comments', 'isUnread', 'qaError', 'screenshotUrl', 'attachments', 'deletedAt', 'deletedBy', 'revision', 'internal', 'updatedAt'],
  notifications: ['id', 'recipientUid', 'type', 'title', 'message', 'projectId', 'projectName', 'pinId', 'pinNumber', 'assetId', 'actor', 'read', 'readAt', 'createdAt'],
  ai_usage: ['id', 'at', 'month', 'feature', 'projectId', 'actor', 'model', 'inputTokens', 'outputTokens', 'costUsd', 'pricing'],
  audit_log: ['id', 'action', 'actorUid', 'actorEmail', 'actorRole', 'details', 'at'],
  wp_sites: ['id', 'projectId', 'siteUrl', 'wpSiteUrl', 'siteName', 'username', 'wpUser', 'builders', 'pluginVersion', 'wordpressVersion', 'status', 'lastError', 'connectedBy', 'connectedAt', 'lastCheckedAt'],
  wp_site_secrets: ['id', 'appPassword', 'updatedAt'],
  wp_fixes: ['id', 'projectId', 'pinId', 'pinNumber', 'pageUrl', 'postId', 'pageTitle', 'builder', 'device', 'kind', 'status', 'summary', 'explanation', 'reason', 'model', 'baseHash', 'elementId', 'elementType', 'settingsJson', 'beforeJson', 'find', 'replace', 'wholeWord', 'siteReplace', 'afterElementId', 'afterElementType', 'css', 'image', 'media', 'remaining', 'pageCheck', 'visibleChange', 'snapshotId', 'lastError', 'proposedBy', 'proposedAt', 'appliedBy', 'appliedAt', 'revertedBy', 'revertedAt', 'rejectedBy', 'rejectedAt'],
  chat_webhooks: ['id', 'url', 'off', 'updatedBy', 'updatedAt'],
  extension_connect: ['id', 'key', 'uid', 'browser', 'expiresAt'],
  extension_keys: ['id', 'uid', 'browser', 'createdAt', 'lastUsedAt'],
  settings: ['id', 'value', 'updatedAt'],
  teams: ['id', 'name', 'managerId', 'leadId', 'memberIds', 'createdAt', 'updatedAt'],
  revisions: ['id', 'projectId', 'number', 'status', 'pinIds', 'people', 'submittedBy', 'submittedAt', 'doneAt', 'reopenedAt', 'reopenedBy', 'dueAt', 'overdueAlertedAt'],
  // Read-only view: monthly AI totals
  ai_usage_monthly: ['month', 'requests', 'inputTokens', 'outputTokens', 'costUsd', 'projects', 'features'],
} as const;

export type Table = keyof typeof TABLE_COLUMNS;

// Set by the server only (submitting and reopening); browsers leave them out when saving
export const SERVER_FIELDS: Partial<Record<Table, string[]>> = {
  projects: ['reviewState', 'revisionCount', 'unsentRemindedAt', 'previewUrl', 'previewAt', 'previewError', 'shareToken', 'updatedAt'],
  pins: ['revision', 'internal', 'updatedAt'],
};

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const known = Object.fromEntries(
  Object.entries(TABLE_COLUMNS).map(([table, cols]) => [table, new Set<string>(cols)])
) as Record<Table, Set<string>>;

// App record → database row. Fields the table has no column for are left out (with a warning).
export function toRow(table: Table, record: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (!known[table].has(key)) {
      console.warn(`[db] ${table} has no column for "${key}"; it was not saved.`);
      continue;
    }
    row[snake(key)] = value instanceof Date ? value.toISOString() : value;
  }
  return row;
}

// Database row → app record
export function fromRow<T = any>(row: Record<string, any> | null | undefined): T {
  const record: Record<string, any> = {};
  for (const [key, value] of Object.entries(row || {})) record[camel(key)] = value;
  return record as T;
}

// Timestamps from the database as milliseconds (0 when missing)
export const millis = (value: unknown) => {
  const ms = typeof value === 'number' ? value : Date.parse(String(value ?? ''));
  return Number.isFinite(ms) ? ms : 0;
};
