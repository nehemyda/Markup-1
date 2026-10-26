import { ViewMode } from '../types';
import { PinDevice } from './pins';

// URL scheme
//   /                               dashboard
//   /archive  /team  /credits  /settings  /settings/access  /folders/:folderId
//   /projects/:projectId            project canvas
//   /projects/:projectId/kanban | table | activity      /qa-score (workspace QA scores)
//   ?view_mode=Desktop|Tablet|Mobile   ?page=<path> (when not the project's start page)   ?pin=<pinId>   ?guest_mode=true

export type DashboardTab = 'dashboard' | 'archive' | 'team' | 'credits' | 'settings';
export type SettingsSubTab = 'details' | 'domains' | 'notifications';

export interface Route {
  dashboardTab?: DashboardTab;
  settingsSubTab?: SettingsSubTab;
  folderId?: string;
  projectId?: string;
  viewMode: ViewMode;
  assetId?: string;
  pagePath?: string;
  pinId?: string;
  device?: PinDevice;
}

const PROJECT_VIEW_SEGMENTS: Partial<Record<ViewMode, string>> = {
  studio: '',
  kanban: 'kanban',
  matrix: 'table',
  activity: 'activity',
};

export function parseRoute(pathname: string, search: string): Route {
  const params = new URLSearchParams(search);
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  // Old share links: /?project=<id>
  const legacyProject = params.get('project');
  if (parts.length === 0 && legacyProject) {
    return { projectId: legacyProject, viewMode: 'studio', pinId: params.get('pin') || undefined };
  }

  if (parts[0] === 'qa-score') return { viewMode: 'qascore' };
  if (parts[0] === 'projects' && parts[1]) {
    const segment = parts[2] || '';
    // Older links had QA scores under a project
    if (segment === 'qa-score') return { viewMode: 'qascore' };
    const viewMode = (Object.entries(PROJECT_VIEW_SEGMENTS).find(([, seg]) => seg === segment)?.[0] || 'studio') as ViewMode;
    return {
      projectId: parts[1],
      viewMode,
      assetId: params.get('asset') || undefined,
      pagePath: params.get('page') || undefined,
      pinId: params.get('pin') || undefined,
      device: parseDevice(params.get('view_mode')),
    };
  }

  if (parts[0] === 'folders' && parts[1]) return { viewMode: 'dashboard', dashboardTab: 'dashboard', folderId: parts[1] };
  if (parts[0] === 'archive' || parts[0] === 'team' || parts[0] === 'credits') return { viewMode: 'dashboard', dashboardTab: parts[0] };
  if (parts[0] === 'settings') {
    return { viewMode: 'dashboard', dashboardTab: 'settings', settingsSubTab: parts[1] === 'access' ? 'domains' : parts[1] === 'notifications' ? 'notifications' : 'details' };
  }
  return { viewMode: 'dashboard', dashboardTab: 'dashboard' };
}

export function buildPath(state: {
  viewMode: ViewMode;
  dashboardTab: DashboardTab;
  settingsSubTab: SettingsSubTab;
  folderId?: string | null;
  projectId?: string;
  pagePath?: string;
  isFirstAsset: boolean;
  pinId?: string;
  device: PinDevice;
  guestMode: boolean;
}): string {
  if (state.viewMode === 'qascore') return '/qa-score';
  if (state.viewMode === 'dashboard' || !state.projectId || PROJECT_VIEW_SEGMENTS[state.viewMode] === undefined) {
    if (state.dashboardTab === 'archive') return '/archive';
    if (state.dashboardTab === 'team') return '/team';
    if (state.dashboardTab === 'credits') return '/credits';
    if (state.dashboardTab === 'settings') return state.settingsSubTab === 'domains' ? '/settings/access' : state.settingsSubTab === 'notifications' ? '/settings/notifications' : '/settings';
    if (state.folderId) return `/folders/${encodeURIComponent(state.folderId)}`;
    return '/';
  }
  const segment = PROJECT_VIEW_SEGMENTS[state.viewMode];
  const params = new URLSearchParams();
  if (state.viewMode === 'studio') params.set('view_mode', state.device[0].toUpperCase() + state.device.slice(1));
  if (state.pagePath && !state.isFirstAsset) params.set('page', state.pagePath);
  if (state.pinId) params.set('pin', state.pinId);
  if (state.guestMode) params.set('guest_mode', 'true');
  const query = params.toString();
  return `/projects/${encodeURIComponent(state.projectId)}${segment ? `/${segment}` : ''}${query ? `?${query}` : ''}`;
}

function parseDevice(value: string | null): PinDevice | undefined {
  const v = value?.toLowerCase();
  return v === 'desktop' || v === 'tablet' || v === 'mobile' ? v : undefined;
}

export function projectUrl(projectId: string, guest = false): string {
  return `${window.location.origin}/projects/${encodeURIComponent(projectId)}${guest ? '?guest_mode=true' : ''}`;
}
