/**
 * Core data types for Website & Asset Annotation Studio (Markup.io & PM Clone)
 */

export type PinCategory = 'bug' | 'design' | 'content' | 'question' | 'approved';
// waiting_on_customer: the team needs an answer or material from the client before continuing
export type PinStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'ready_for_review' | 'resolved' | 'archived';
export type PinPriority = 'high' | 'medium' | 'low';
export type ViewMode = 'dashboard' | 'studio' | 'kanban' | 'matrix' | 'activity' | 'organization' | 'qascore';
export type DeviceViewport = 'desktop' | 'tablet' | 'mobile' | 'full';

export type QASource = 'internal_qa' | 'client_edit';

export type QACategoryName = 
  | 'Pre-build'
  | 'Content'
  | 'Design'
  | 'Website Interactions'
  | 'Backend'
  | 'SEO'
  | 'Escalation';

export interface QARubricRule {
  id: string;
  category: QACategoryName;
  ruleName: string;
  weightage: number;
  description?: string;
  isActive: boolean;
}

export interface QAPinError {
  source: QASource; // 'internal_qa' vs 'client_edit'
  rubricRuleId?: string;
  category?: QACategoryName;
  ruleName?: string;
  weightage?: number;
  notes?: string;
}

export interface Organization {
  id: string;
  name: string;
  domain: string;
  allowedDomains: string[];
  plan: 'Enterprise' | 'Team' | 'Pro' | 'Free Starter';
  ssoEnabled: boolean;
  maxSeats: number | 'Unlimited';
  activeSeats: number;
  logo?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'Admin' | 'Owner' | 'Designer' | 'Developer' | 'Product Manager' | 'Reviewer';
  organizationId: string;
  organizationName: string;
  status: 'online' | 'busy' | 'offline';
  cursorColor: string;
}

export interface RolePermissions {
  membersCanViewAllQAScores: boolean;
  membersCanManageRubric: boolean;
  membersCanInvite: boolean;
  membersCanManageRoles: boolean;
  membersCanDeleteProjects: boolean;
  membersCanArchiveProjects: boolean;
  // Fix with AI on connected WordPress sites (Owners and Admins can always)
  membersCanUseAiFix: boolean;
  membersCanApplyAiFix: boolean;
}

export interface Teammate {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'Owner' | 'Designer' | 'Developer' | 'Client' | 'Product Manager' | 'Admin' | 'Reviewer' | 'Member' | 'Guest';
  status: 'online' | 'busy' | 'offline' | 'typing';
  cursorColor: string;
  department?: string;
  lastActive?: string;
  createdBy?: string;
  // The account named in VITE_ADMIN_EMAILS (always Owner, can't be changed or removed)
  isMasterAdmin?: boolean;
  // Pending invitation (not signed up yet)
  pendingInvite?: boolean;
  // Out of office (optionally until a date, YYYY-MM-DD): their notifications also go to their Team Lead
  outOfOffice?: boolean;
  outOfOfficeUntil?: string | null;
}

// A team (Settings → Teams): who covers for whom when someone is out, and who hears about overdue revisions
export interface Team {
  id: string;
  name: string;
  managerId?: string | null;
  leadId?: string | null;
  memberIds: string[];
}

export interface PinMetadata {
  browser: string;
  os: string;
  viewport: string;
  selector?: string;
  resolution?: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'video' | 'pdf' | 'code';
  url: string;
}

export interface Comment {
  id: string;
  pinId: string;
  author: Teammate;
  text: string;
  createdAt: string;
  attachments?: Attachment[];
  isAiGenerated?: boolean;
  audioDuration?: string; // Simulated voice note duration e.g. "0:24"
  reactions?: { [emoji: string]: string[] }; // emoji -> array of teammate names
}

export interface Pin {
  id: string;
  assetId: string;
  // Project the pin belongs to (lets security rules limit guests to their shared project)
  projectId?: string;
  number: number;
  x: number; // percentage X coordinate on canvas
  y: number; // percentage Y coordinate on canvas
  category: PinCategory;
  status: PinStatus;
  priority: PinPriority;
  title: string;
  createdAt: string;
  author: Teammate;
  assignedTo?: Teammate;
  // Who assigned it (so they aren't notified about their own assignment)
  assignedBy?: { id: string; name: string; avatar?: string } | null;
  metadata: PinMetadata;
  comments: Comment[];
  isUnread?: boolean;
  qaError?: QAPinError;
  screenshotUrl?: string;
  attachments?: Attachment[];
  // Deleted pins go to the Deleted tab (restorable) until someone deletes them permanently
  deletedAt?: string | null;
  deletedBy?: { id: string; name: string } | null;
  // Client pins: the revision they were submitted in (null = not submitted yet, 0 = before revisions were counted)
  revision?: number | null;
}

export interface Asset {
  id: string;
  projectId: string;
  title: string;
  type: 'url' | 'image' | 'pdf' | 'mockup';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  status: 'in_review' | 'approved' | 'changes_requested';
  pinCount?: number;
  resolvedCount?: number;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  color: string;
  avatar: string;
  memberCount: number;
  lastUpdated: string;
  ownerId?: string;
  createdBy?: string;
  // Team members (ids) told about new client feedback; empty = the creator (ownerId)
  assigneeIds?: string[];
  // Folder the project is in (null/undefined = not in a folder)
  folderId?: string | null;
  assets: Asset[];
  // Client review round: 'open' (the client can add pins) or 'submitted' (view-only for the client). Set by the server.
  reviewState?: 'open' | 'submitted';
  // Revisions the client has submitted
  revisionCount?: number;
}

// A client's submitted round of feedback (see server/revisions.ts)
export interface Revision {
  id: string;
  projectId: string;
  number: number;
  status: 'submitted' | 'done';
  pinIds: string[];
  people: { name: string; email: string; count: number }[];
  submittedBy: { id: string; name: string; email: string; isGuest: boolean } | null;
  submittedAt: string;
  doneAt?: string | null;
  reopenedAt?: string | null;
}

// Revisions included per project; more are allowed but shown as chargeable
export const INCLUDED_REVISIONS = 2;

// A folder groups projects, e.g. per partner ("PRBS - Prestige Roofing"). Names are free text.
export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  createdBy?: string;
}

export interface ActivityItem {
  id: string;
  projectId: string;
  assetId?: string;
  author: Teammate;
  action: string;
  targetName: string;
  timestamp: string;
  type: 'comment' | 'status' | 'pin' | 'approval' | 'ticket';
  details?: string;
}

export interface FilterState {
  category: PinCategory | 'all';
  status: PinStatus | 'all';
  priority: PinPriority | 'all';
  assigneeId: string | 'all';
  search: string;
  showResolved: boolean;
}

// One notification for the signed-in person (created by the server, see server/notifications.ts)
export interface NotificationItem {
  id: string;
  type: 'pin' | 'comment' | 'mention' | 'assignment' | 'submission' | 'revision_done';
  title: string;
  message: string;
  // Milliseconds
  createdAt: number;
  actor: { id: string; name: string; avatar?: string; email?: string; isGuest?: boolean };
  projectId?: string | null;
  projectName?: string | null;
  pinId?: string | null;
  pinNumber?: number | null;
  assetId?: string | null;
  isRead: boolean;
}


// WordPress site linked to a project (the password stays on the server)
export interface WpSite {
  projectId: string;
  siteUrl: string;
  siteName: string;
  username: string;
  wpUser: { id: number; name: string; roles: string[] };
  builders: Record<string, string | null>;
  pluginVersion: string;
  wordpressVersion: string;
  status: 'connected' | 'error';
  lastError?: string | null;
  connectedBy?: string;
}

// "Fix with AI" proposal for a pin on a connected WordPress page (created and changed by the server)
export interface WpFix {
  id: string;
  projectId: string;
  pinId: string;
  pinNumber?: number;
  pageUrl: string;
  pageTitle?: string;
  builder: string;
  kind: 'elementor_settings' | 'elementor_insert' | 'content_replace' | 'css' | 'site_replace' | 'none';
  status: 'proposed' | 'applying' | 'applied' | 'undoing' | 'reverted' | 'rejected' | 'stale' | 'not_possible';
  summary: string;
  explanation: string;
  reason?: string;
  elementId?: string;
  elementType?: string;
  settingsJson?: string;
  beforeJson?: string;
  find?: string;
  replace?: string;
  css?: string;
  // Site-wide text change: every place it changes (previewed before approval)
  wholeWord?: boolean;
  siteReplace?: { total: number; places: number; items: Array<{ label: string; where: string; count: number; sample: string }> };
  afterElementId?: string;
  afterElementType?: string;
  // Attached image the fix places on the page (uploaded to the Media Library on approval)
  image?: { commentId: string | null; attachmentId: string; name: string } | null;
  media?: { id: number; url: string } | null;
  // After applying: did the element at the pin visibly change? (null while checking)
  visibleChange?: boolean | null;
  // Requests from the pin's thread this fix doesn't cover yet
  remaining?: string[];
  lastError?: string | null;
  proposedBy?: { uid: string; name: string; email: string };
  appliedBy?: { uid: string; name: string; email: string };
  proposedAt?: any;
}
