import { ViewMode } from '../types';
import { PinDevice } from './pins';

// URL scheme
//   /                               dashboard
//   /archive  /team  /settings  /settings/access
//   /projects/:projectId            project canvas
//   /projects/:projectId/kanban | table | activity | qa-score
//   ?view_mode=Desktop|Tablet|Mobile   ?asset=<assetId> (when not the project's first asset)   ?pin=<pinId>   ?guest_mode=true

export type DashboardTab = 'dashboard' | 'archive' | 'team' | 'settings';
export type SettingsSubTab = 'details' | 'domains';

export interface Route {
  dashboardTab?: DashboardTab;
  settingsSubTab?: SettingsSubTab;
  projectId?: string;
  viewMode: ViewMode;
  assetId?: string;
  pinId?: string;
  device?: PinDevice;
}

const PROJECT_VIEW_SEGMENTS: Partial<Record<ViewMode, string>> = {
  studio: '',
  kanban: 'kanban',
  matrix: 'table',
  activity: 'activity',
  qascore: 'qa-score',
};

export function parseRoute(pathname: string, search: string): Route {
  const params = new URLSearchParams(search);
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  // Old share links: /?project=<id>
  const legacyProject = params.get('project');
  if (parts.length === 0 && legacyProject) {
    return { projectId: legacyProject, viewMode: 'studio', pinId: params.get('pin') || undefined };
  }

  if (parts[0] === 'projects' && parts[1]) {
    const segment = parts[2] || '';
    const viewMode = (Object.entries(PROJECT_VIEW_SEGMENTS).find(([, seg]) => seg === segment)?.[0] || 'studio') as ViewMode;
    return {
      projectId: parts[1],
      viewMode,
      assetId: params.get('asset') || undefined,
      pinId: params.get('pin') || undefined,
      device: parseDevice(params.get('view_mode')),
    };
  }

  if (parts[0] === 'archive' || parts[0] === 'team') return { viewMode: 'dashboard', dashboardTab: parts[0] };
  if (parts[0] === 'settings') {
    return { viewMode: 'dashboard', dashboardTab: 'settings', settingsSubTab: parts[1] === 'access' ? 'domains' : 'details' };
  }
  return { viewMode: 'dashboard', dashboardTab: 'dashboard' };
}

export function buildPath(state: {
  viewMode: ViewMode;
  dashboardTab: DashboardTab;
  settingsSubTab: SettingsSubTab;
  projectId?: string;
  assetId?: string;
  isFirstAsset: boolean;
  pinId?: string;
  device: PinDevice;
  guestMode: boolean;
}): string {
  if (state.viewMode === 'dashboard' || !state.projectId || PROJECT_VIEW_SEGMENTS[state.viewMode] === undefined) {
    if (state.dashboardTab === 'archive') return '/archive';
    if (state.dashboardTab === 'team') return '/team';
    if (state.dashboardTab === 'settings') return state.settingsSubTab === 'domains' ? '/settings/access' : '/settings';
    return '/';
  }
  const segment = PROJECT_VIEW_SEGMENTS[state.viewMode];
  const params = new URLSearchParams();
  if (state.viewMode === 'studio') params.set('view_mode', state.device[0].toUpperCase() + state.device.slice(1));
  if (state.assetId && !state.isFirstAsset) params.set('asset', state.assetId);
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
