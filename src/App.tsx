import React, { useState, useEffect, useRef } from 'react';
import { 
  Project, 
  Asset, 
  Pin, 
  PinStatus, 
  PinCategory, 
  PinPriority, 
  Teammate, 
  ActivityItem, 
  ViewMode, 
  FilterState, 
  Comment, 
  Attachment,
  AuthUser,
  Organization,
  NotificationItem,
  QARubricRule,
  QAPinError,
  Folder,
  WpSite
} from './types';
import { 
  INITIAL_PROJECTS, 
} from './data/mockData';
import { INITIAL_QA_RUBRIC } from './data/qaRubricData';
import { 
  subscribeProjects, 
  subscribePins, 
  saveProjectToFirestore, 
  deleteProjectFromFirestore,
  savePinToFirestore, 
  deletePinFromFirestore, 
  deletePinsForAssets,
  subscribeTeam,
  subscribeFolders,
  saveFolder,
  deleteFolderDoc,
  inviteMember,
  updateMemberRole,
  removeMember,
  normalizeRole,
  subscribeProject,
  subscribeWpSite,
  subscribeNotifications,
  markNotificationsRead,
} from './lib/firebaseSync';
import { Header } from './components/Header';
import { AuthPage } from './components/AuthPage';
import { AnnotationStudio } from './components/AnnotationStudio';
import { SidebarDiscussion } from './components/SidebarDiscussion';
import { KanbanBoard } from './components/KanbanBoard';
import { FeedbackMatrix } from './components/FeedbackMatrix';
import { TeamActivityFeed } from './components/TeamActivityFeed';
import { ProjectsGridView } from './components/ProjectsGridView';
import { QAScoreManager } from './components/QAScoreManager';
import { NewProjectModal, NewAssetModal, ShareModal, GuestNameModal } from './components/Modals';
import { WordPressModal } from './components/WordPressModal';
import { useRolePermissions } from './lib/permissions';
import { useBranding, useGuestPolicy, brandEmblem } from './lib/workspaceSettings';
import { DomainSecurityModal } from './components/DomainSecurityModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { getAllowedDomains } from './utils/domains';
import { onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { auth } from './lib/firebase';
import { ReviewSnapshot } from './lib/pageSnapshot';
import { nextPinNumber, pinDevice, describeClient, PinDevice } from './lib/pins';
import { parseRoute, buildPath, Route, DashboardTab, SettingsSubTab } from './lib/routes';
import { isMasterAdmin, getDefaultOrganization, startSession, saveProfile } from './lib/userProfile';
import { apiFetch } from './lib/api';

// Project id of a guest link in the address bar (/projects/<id>?guest_mode=true), else null
function guestLinkProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  if (new URLSearchParams(window.location.search).get('guest_mode') !== 'true') return null;
  return parseRoute(window.location.pathname, window.location.search).projectId || null;
}

// Spinner while signing in or opening a page; offers a reload if it takes too long (e.g. the connection dropped)
function LoadingScreen({ dark = false }: { dark?: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${dark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <span className={`w-8 h-8 border-2 border-indigo-500/30 rounded-full animate-spin ${dark ? 'border-t-indigo-400' : 'border-t-indigo-500'}`} />
      {slow && (
        <div className={`text-sm text-center ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
          <p>This is taking longer than usual.</p>
          <button onClick={() => window.location.reload()} className="mt-2 font-bold text-indigo-500 hover:text-indigo-400">
            Reload
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Authentication State
  // Authentication State (driven by Firebase Auth via onAuthStateChanged below)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);

  // State
  // App name and logo emblem (Settings → Branding, shared by the workspace)
  const branding = useBranding();
  const appName = branding.appName;
  const appIcon = brandEmblem(branding);
  const guestPolicy = useGuestPolicy();
  useEffect(() => {
    document.title = appName;
  }, [appName]);
  // Preview-as-guest toggle for signed-in members; visitors on a guest link are handled by isGuestShareLink
  const [isGuestMode, setIsGuestMode] = useState(false);
  // A signed-out visitor on a guest link who clicked "Sign in"
  const [guestWantsSignIn, setGuestWantsSignIn] = useState(false);
  // Signed-out guests give their name before their first pin or comment (remembered in this browser)
  const [guestProfile, setGuestProfile] = useState<{ id: string; name: string; email: string } | null>(() => {
    try {
      const saved = localStorage.getItem('mf_guest_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [showGuestNameModal, setShowGuestNameModal] = useState(false);
  const pendingGuestAction = useRef<{ kind: 'pin'; data: any } | { kind: 'comment'; args: any[] } | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('webreview_projects_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [pins, setPins] = useState<Pin[]>(() => {
    try {
      const saved = localStorage.getItem('webreview_pins_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [rubricRules, setRubricRules] = useState<QARubricRule[]>(() => {
    try {
      const saved = localStorage.getItem('webreview_qa_rubric_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_QA_RUBRIC;
  });

  const handleUpdateRubricRules = (newRules: QARubricRule[]) => {
    setRubricRules(newRules);
    try {
      localStorage.setItem('webreview_qa_rubric_v1', JSON.stringify(newRules));
    } catch (e) {}
  };

  const handleUpdatePinQAError = (pinId: string, qaError?: QAPinError) => {
    setPins((prev) =>
      prev.map((p) => {
        if (p.id === pinId) {
          const updated = { ...p, qaError };
          if (selectedPin?.id === pinId) {
            setSelectedPin(updated);
          }
          return updated;
        }
        return p;
      })
    );
  };
  const [currentProject, setCurrentProject] = useState<Project>(() => projects[0] || INITIAL_PROJECTS[0]);
  const [currentAsset, setCurrentAsset] = useState<Asset>(() => (projects[0]?.assets?.[0]) || INITIAL_PROJECTS[0].assets[0]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  // Comments sidebar: closed by default, opens when a pin is selected (clicked or just created)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Pinned: sidebar sits beside the canvas (default). Unpinned: it floats over the canvas. Remembered per browser.
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    try {
      return localStorage.getItem('mf_sidebar_pinned') !== 'false';
    } catch (e) {
      return true;
    }
  });
  const toggleSidebarPinned = () => {
    setIsSidebarPinned((pinned) => {
      try {
        localStorage.setItem('mf_sidebar_pinned', String(!pinned));
      } catch (e) {}
      return !pinned;
    });
  };
  // Device view (desktop / tablet / mobile): each shows only its own pins
  const [device, setDevice] = useState<PinDevice>('desktop');
  useEffect(() => {
    if (selectedPin) {
      setIsSidebarOpen(true);
      // Opening a pin from a link, notification, Kanban or Table shows it on its own device
      setDevice(pinDevice(selectedPin));
      // ...under the matching Active / Resolved tab
      const resolved = selectedPin.status === 'resolved' || selectedPin.status === 'archived';
      setFilterState((prev) => (prev.showResolved === resolved ? prev : { ...prev, showResolved: resolved }));
      // ...in its own project (a pin opened from a link, notification, Kanban or Table can belong to another one)
      const owner =
        projects.find((p) => p.id === selectedPin.projectId) ||
        projects.find((p) => (p.assets || []).some((a) => a.id === selectedPin.assetId));
      if (owner && owner.id !== currentProject.id) setCurrentProject(owner);
      // ...and on its own page (the sidebar lists comments from every page of the website)
      if (selectedPin.assetId !== currentAsset.id) {
        const page = (owner?.assets || projects.flatMap((p) => p.assets || [])).find((a) => a.id === selectedPin.assetId);
        if (page) setCurrentAsset(page);
      }
    }
  }, [selectedPin?.id]);
  const [activityLogs, setActivityLogs] = useState<ActivityItem[]>([]);
  // Teammates are the real signed-up users (Firestore users collection), see subscribeUsers below
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  // Folders group projects (e.g. per partner); currentFolderId is the folder open on the dashboard
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Notifications for the signed-in member (saved by the server; see server/notifications.ts)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const handleMarkAllNotificationsRead = () => {
    markNotificationsRead(notifications.filter((n) => !n.isRead).map((n) => n.id)).catch((err) => console.warn('Could not mark notifications read:', err));
  };

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Sync projects and pins to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('webreview_projects_v2', JSON.stringify(projects));
    } catch (e) {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('webreview_pins_v2', JSON.stringify(pins));
    } catch (e) {}
  }, [pins]);

  // Who is using the app: '' (nobody yet), 'member', or 'guest:<projectId>' (a guest link's project pass).
  // Data subscriptions start once this is known, and guests only load their project.
  const [accessKey, setAccessKey] = useState('');

  // Firebase Auth: restore the session on load and react to sign-in / sign-out
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setAuthUser(null);
        setCurrentOrganization(null);
        setAccessKey('');
        setAuthReady(true);
        return;
      }
      let claims: Record<string, any>;
      try {
        ({ claims } = await fbUser.getIdTokenResult());
      } catch {
        // Saved session that no longer works (e.g. its account was deleted): start fresh.
        // Signing out runs this listener again with no user, which shows sign-in or gets a new guest pass.
        await signOut(auth).catch(() => {});
        return;
      }
      if (claims.guestProject) {
        // A guest pass only works on its own guest link
        const linkProject = guestLinkProjectId();
        if (!linkProject || linkProject !== claims.guestProject) {
          await signOut(auth);
          return;
        }
        setAuthUser(null);
        setAccessKey(`guest:${claims.guestProject}`);
        setAuthReady(true);
        return;
      }
      try {
        // The server checks access, applies invites and decides the role
        const profile = await startSession(fbUser);
        setAuthNotice(null);
        setCurrentOrganization(getDefaultOrganization());
        setAuthUser(profile);
        setAccessKey('member');
        setAuthReady(true);
      } catch (err: any) {
        setAuthNotice(err?.message || 'Could not sign in.');
        await signOut(auth);
      }
    });
    return () => unsubAuth();
  }, []);

  // Guest link without a signed-in member: get a pass for this one project from the server
  useEffect(() => {
    if (!authReady || auth.currentUser) return;
    const projectId = guestLinkProjectId();
    if (!projectId) return;
    let guestId = '';
    try {
      guestId = localStorage.getItem('mf_guest_id') || '';
    } catch (e) {}
    fetch('/api/guest/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, guestId }),
      signal: AbortSignal.timeout(20000),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not open this shared project.');
        try {
          localStorage.setItem('mf_guest_id', body.guestId);
        } catch (e) {}
        await signInWithCustomToken(auth, body.token);
      })
      .catch((err) => {
        alert(err.message);
        window.location.href = '/';
      });
  }, [authReady]);

  // Firebase Firestore Real-Time Synchronization (starts once we know who is signed in)
  useEffect(() => {
    if (!accessKey) {
      // Signed out: forget the data and open the page in the address bar again after the next sign-in
      setProjectsLoaded(false);
      setRouteReady(false);
      return;
    }

    if (accessKey.startsWith('guest:')) {
      const projectId = accessKey.slice('guest:'.length);
      const unsubProject = subscribeProject(projectId, (project) => {
        setProjects(project ? [project] : []);
        setProjectsLoaded(true);
      });
      const unsubPins = subscribePins(setPins, projectId);
      return () => {
        unsubProject();
        unsubPins();
      };
    }

    // Firestore is the source of truth; its SDK queues writes made while offline
    const unsubProjects = subscribeProjects((cloudProjects) => {
      setProjects(cloudProjects);
      setProjectsLoaded(true);
    });

    const unsubPins = subscribePins((cloudPins) => {
      if (cloudPins) {
        setPins(cloudPins);
      }
    });

    const unsubFolders = subscribeFolders(setFolders);

    const unsubTeam = subscribeTeam((team) => {
      setTeammates(team);
      // Keep the signed-in user's role in step when an admin changes it
      setAuthUser((prev) => {
        const me = prev && team.find((t) => t.id === prev.id);
        return me && normalizeRole(prev.role) !== me.role ? { ...prev, role: me.role as any } : prev;
      });
    });

    return () => {
      unsubProjects();
      unsubPins();
      unsubTeam();
      unsubFolders();
    };
  }, [accessKey]);


  // WordPress site linked to the open project (members only; guests never see it)
  const [wpSite, setWpSite] = useState<WpSite | null>(null);
  const [showWordPressModal, setShowWordPressModal] = useState(false);
  // Reload the live page after an AI fix is applied/undone; CSS of a fix being previewed
  const [siteVersion, setSiteVersion] = useState(0);
  const [previewCss, setPreviewCss] = useState<string | null>(null);
  const isWorkspaceAdmin = !!authUser && ['Owner', 'Admin'].includes(normalizeRole(authUser.role));
  // Fix with AI for members depends on Team → Roles & Permissions (the server checks the same settings)
  const rolePermissions = useRolePermissions();
  const canAskAi = isWorkspaceAdmin || rolePermissions.membersCanUseAiFix;
  const canApplyAi = isWorkspaceAdmin || rolePermissions.membersCanApplyAiFix;
  useEffect(() => {
    setWpSite(null);
    if (accessKey !== 'member' || !currentProject?.id) return;
    return subscribeWpSite(currentProject.id, setWpSite);
  }, [accessKey, currentProject?.id]);

  // The signed-in member's notifications
  useEffect(() => {
    setNotifications([]);
    if (accessKey !== 'member' || !authUser?.id) return;
    return subscribeNotifications(authUser.id, setNotifications);
  }, [accessKey, authUser?.id]);

  // Keep the selected project pointing at a real project (the initial value is only a placeholder)
  useEffect(() => {
    if (!projectsLoaded || projects.length === 0) return;
    const current = projects.find((p) => p.id === currentProject.id);
    if (current) {
      if (current !== currentProject) setCurrentProject(current);
      return;
    }
    setCurrentProject(projects[0]);
    if (projects[0].assets && projects[0].assets.length > 0) {
      setCurrentAsset(projects[0].assets[0]);
    }
  }, [projects, projectsLoaded]);

  const handleUpdateTeammateRole = (id: string, newRole: Teammate['role']) => {
    const member = teammates.find((tm) => tm.id === id);
    if (member && isMasterAdmin(member.email)) {
      alert('The master admin role cannot be changed.');
      return;
    }
    updateMemberRole(id, newRole);
  };
  
  const currentUser: Teammate = authUser ? {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    avatar: authUser.avatar,
    role: normalizeRole(authUser.role),
    status: authUser.status,
    cursorColor: authUser.cursorColor
  } : {
    id: guestProfile?.id || 'usr_guest',
    name: guestProfile ? `${guestProfile.name} (Guest)` : 'Guest',
    email: guestProfile?.email || '',
    avatar: '',
    role: 'Guest',
    status: 'online',
    cursorColor: '#F59E0B'
  };

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('details');

  // ---------- URL routing: every page and project has its own address (see lib/routes.ts) ----------
  const [routeReady, setRouteReady] = useState(false);
  const pendingPinId = useRef<string | null>(null);

  const applyRoute = (route: Route) => {
    if (!route.projectId) {
      // Workspace pages: dashboard tabs, or the QA scores page
      setViewMode(route.viewMode === 'qascore' ? 'qascore' : 'dashboard');
      setDashboardTab(route.dashboardTab || 'dashboard');
      setCurrentFolderId(route.folderId || null);
      if (route.settingsSubTab) setSettingsSubTab(route.settingsSubTab);
      setSelectedPin(null);
      return;
    }
    const project = projects.find((p) => p.id === route.projectId);
    if (!project) {
      alert('This project no longer exists or the link is incorrect.');
      window.history.replaceState(null, '', '/');
      setViewMode('dashboard');
      setDashboardTab('dashboard');
      return;
    }
    // Page: ?page=<path> (may be a page nobody has commented on yet), or the older ?asset=<id>
    const startPage = project.assets?.[0];
    let asset = project.assets?.find((a) => a.id === route.assetId) || startPage;
    if (route.pagePath && startPage) {
      const target = new URL(route.pagePath, startPage.url).href;
      asset =
        project.assets.find((a) => normalizePageUrl(a.url) === normalizePageUrl(target)) ||
        makePage(new URL(target), project.id);
    }
    setCurrentProject(project);
    if (asset) setCurrentAsset(asset);
    setViewMode(route.viewMode);
    const pin = route.pinId ? pins.find((p) => p.id === route.pinId) : undefined;
    setSelectedPin(pin || null);
    setDevice(pin ? pinDevice(pin) : route.device || 'desktop');
    // Pins can arrive after projects; select it once it loads
    pendingPinId.current = route.pinId && !pin ? route.pinId : null;
  };

  // Open the page in the address bar once projects have loaded
  useEffect(() => {
    if (routeReady || !projectsLoaded) return;
    applyRoute(parseRoute(window.location.pathname, window.location.search));
    setRouteReady(true);
  }, [projectsLoaded, routeReady]);

  useEffect(() => {
    if (!pendingPinId.current) return;
    const pin = pins.find((p) => p.id === pendingPinId.current);
    if (pin) {
      pendingPinId.current = null;
      setSelectedPin(pin);
    }
  }, [pins]);

  // Run a guest's pending pin/comment once they have given their name (uses this render's handlers)
  useEffect(() => {
    const pending = pendingGuestAction.current;
    if (!guestProfile || !pending) return;
    pendingGuestAction.current = null;
    if (pending.kind === 'pin') handleAddPin(pending.data);
    else handleAddComment(...(pending.args as Parameters<typeof handleAddComment>));
  }, [guestProfile]);

  // Signed-out guests only see the shared project's canvas
  useEffect(() => {
    if (!authUser && isGuestShareLink && routeReady && viewMode !== 'studio') setViewMode('studio');
  }, [authUser, routeReady, viewMode]);

  // Browser back / forward
  useEffect(() => {
    const onPop = () => applyRoute(parseRoute(window.location.pathname, window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  // Keep the address bar in step with what is on screen
  useEffect(() => {
    if (!routeReady) return;
    const inProject = viewMode !== 'dashboard' && projects.some((p) => p.id === currentProject.id);
    const path = buildPath({
      viewMode: inProject ? viewMode : 'dashboard',
      dashboardTab,
      settingsSubTab,
      folderId: currentFolderId,
      projectId: inProject ? currentProject.id : undefined,
      pagePath: pagePathOf(currentAsset?.url),
      isFirstAsset: currentProject.assets?.[0]?.id === currentAsset?.id,
      pinId: inProject ? selectedPin?.id : undefined,
      device,
      guestMode: new URLSearchParams(window.location.search).get('guest_mode') === 'true',
    });
    const current = window.location.pathname + window.location.search;
    if (path === current) return;
    // Selecting a pin or switching asset replaces the entry; changing page adds a new one
    const samePage = path.split('?')[0] === window.location.pathname;
    const isLegacyLink = new URLSearchParams(window.location.search).has('project');
    if (samePage || isLegacyLink) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
  }, [routeReady, viewMode, dashboardTab, settingsSubTab, currentProject.id, currentAsset?.id, selectedPin?.id, device, projects, currentFolderId]);

  const handleNavigateDashboardTab = (tab: 'dashboard' | 'archive' | 'team' | 'credits' | 'settings' = 'dashboard') => {
    setDashboardTab(tab);
    setViewMode('dashboard');
  };

  const [isSimulatingPartner, setIsSimulatingPartner] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);

  // Profile Settings Modal State
  const [showProfileSettingsModal, setShowProfileSettingsModal] = useState(false);

  const handleSaveProfile = (updatedData: {
    name: string;
    email: string;
    role: string;
    department: string;
    avatar: string;
    status: 'online' | 'offline' | 'busy';
  }) => {
    if (authUser) {
      const updatedAuth: AuthUser = {
        ...authUser,
        name: updatedData.name,
        email: updatedData.email,
        // Only admins may change their own role; everyone else keeps theirs
        role: (['Owner', 'Admin'].includes(normalizeRole(authUser.role)) && !isMasterAdmin(authUser.email)
          ? updatedData.role
          : authUser.role) as AuthUser['role'],
        avatar: updatedData.avatar,
        status: updatedData.status,
      };
      setAuthUser(updatedAuth);
      saveProfile({ ...updatedAuth, department: updatedData.department });
    }
  };

  const handleAddNewUrlAsset = (newUrl: string) => handleCreateProject(newUrl);

  // Filters
  const [filterState, setFilterState] = useState<FilterState>({
    category: 'all',
    status: 'all',
    priority: 'all',
    assigneeId: 'all',
    search: '',
    showResolved: false,
  });

  // Modal toggles
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewAssetModal, setShowNewAssetModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Project chosen from a project card's Share button; null = share the currently open project
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);

  const handleUpdateFilter = (updates: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    if (project.assets && project.assets.length > 0) {
      setCurrentAsset(project.assets[0]);
    }
    setSelectedPin(null);
  };

  const handleSelectAsset = (asset: Asset) => {
    setCurrentAsset(asset);
    setSelectedPin(null);
  };

  // ---------- Pages (URLs of the website) in the current project; each page keeps its own pins ----------
  const pagePathOf = (url?: string) => {
    try {
      const u = new URL(url || '');
      return u.pathname + u.search;
    } catch {
      return undefined;
    }
  };
  const normalizePageUrl = (u: string) => u.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
  const parsePageUrl = (rawUrl: string): URL | null => {
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed;
    } catch {
      return null;
    }
  };
  const makePage = (parsed: URL, projectId = currentProject.id): Asset => ({
    id: `asset_${Date.now()}`,
    projectId,
    title: parsed.pathname === '/' ? parsed.hostname : parsed.pathname,
    type: /\.(jpe?g|png|gif|svg|webp)$/i.test(parsed.pathname) ? 'image' : 'url',
    url: parsed.href,
    status: 'in_review',
    pinCount: 0,
    resolvedCount: 0,
  });

  // Every page of the current project (plus the page being browsed): pin numbers and counts span all of them
  const projectPageIds = [...(currentProject.assets || []).map((a) => a.id), currentAsset.id];

  // Browsing works like Markup.io: following a link just shows that page. A page is only saved to the
  // project once someone drops a pin on it (see ensurePageSaved), so no page list has to be managed.
  const findPage = (url: string) =>
    currentProject.assets.find((a) => normalizePageUrl(a.url) === normalizePageUrl(url));

  const openPageUrl = (url: string) => {
    const parsed = parsePageUrl(url);
    if (!parsed) return;
    const page = findPage(parsed.href) || makePage(parsed);
    setCurrentAsset(page);
    setSelectedPin(null);
  };

  // A link was clicked inside the page (Browse mode)
  const handleNavigatePage = (url: string) => openPageUrl(url);

  // Save the current page to the project if it is not there yet (first pin on a newly browsed page)
  const ensurePageSaved = (page: Asset) => {
    if (currentProject.assets.some((a) => a.id === page.id)) return;
    const updatedProject = { ...currentProject, assets: [...currentProject.assets, page] };
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
    saveProjectToFirestore(updatedProject);
    setCurrentProject(updatedProject);
  };

  // Add a new annotation pin
  const handleAddPin = (pinData: {
    x: number;
    y: number;
    title: string;
    commentText: string;
    category: PinCategory;
    priority: PinPriority;
    assigneeId: string;
    screenshotUrl?: string;
    attachments?: Attachment[];
    viewportWidth?: number;
    selector?: string;
  }) => {
    ensurePageSaved(currentAsset);
    const nextNum = nextPinNumber(pins, projectPageIds);
    const projectId = currentProject.id;
    const assignee = teammates.find((t) => t.id === pinData.assigneeId);

    const pinId = `pin_${Date.now()}`;
    const newPin: Pin = {
      projectId,
      id: pinId,
      assetId: currentAsset.id,
      number: nextNum,
      x: pinData.x,
      y: pinData.y,
      category: pinData.category,
      status: 'open',
      priority: pinData.priority,
      title: pinData.title,
      createdAt: new Date().toISOString(),
      author: currentUser,
      assignedTo: assignee,
      screenshotUrl: pinData.screenshotUrl,
      attachments: pinData.attachments,
      metadata: {
        ...describeClient(),
        viewport: pinData.viewportWidth ? `${pinData.viewportWidth}px wide` : device,
        selector: pinData.selector || '',
        deviceType: device,
      },
      comments: [
        {
          id: `cmt_${Date.now()}`,
          pinId: pinId,
          author: currentUser,
          text: pinData.commentText,
          createdAt: new Date().toISOString(),
          attachments: pinData.attachments,
        },
      ],
      isUnread: true,
    };

    setPins((prev) => [newPin, ...prev]);
    savePinToFirestore(newPin);
    setSelectedPin(newPin);

    // Update asset pin count
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === currentProject.id
          ? {
              ...proj,
              assets: proj.assets.map((a) =>
                a.id === currentAsset.id ? { ...a, pinCount: (a.pinCount || 0) + 1 } : a
              ),
            }
          : proj
      )
    );

    // Log activity
    const newLog: ActivityItem = {
      id: `act_${Date.now()}`,
      projectId: currentProject.id,
      assetId: currentAsset.id,
      author: currentUser,
      action: `placed Pin #${nextNum}:`,
      targetName: pinData.title,
      timestamp: 'Just now',
      type: 'pin',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  // Add Comment to existing pin
  const handleAddComment = (
    pinId: string,
    text: string,
    attachments?: Attachment[],
    audioDuration?: string
  ) => {
    const newComment: Comment = {
      id: `cmt_${Date.now()}`,
      pinId,
      author: currentUser,
      text,
      createdAt: new Date().toISOString(),
      attachments,
      audioDuration,
    };

    setPins((prev) =>
      prev.map((pin) => {
        if (pin.id === pinId) {
          const updated = { ...pin, comments: [...pin.comments, newComment] };
          if (selectedPin?.id === pinId) setSelectedPin(updated);
          savePinToFirestore(updated);
          return updated;
        }
        return pin;
      })
    );

    const pinObj = pins.find((p) => p.id === pinId);
    if (pinObj) {
      const log: ActivityItem = {
        id: `act_${Date.now()}`,
        projectId: currentProject.id,
        assetId: currentAsset.id,
        author: currentUser,
        action: `commented on Pin #${pinObj.number}:`,
        targetName: `"${text.slice(0, 45)}..."`,
        timestamp: 'Just now',
        type: 'comment',
      };
      setActivityLogs((prev) => [log, ...prev]);
    }
  };

  // Update pin status
  const handleUpdatePinStatus = (pinId: string, newStatus: PinStatus) => {
    setPins((prev) =>
      prev.map((pin) => {
        if (pin.id === pinId) {
          const updated = { ...pin, status: newStatus };
          if (selectedPin?.id === pinId) setSelectedPin(updated);
          savePinToFirestore(updated);
          return updated;
        }
        return pin;
      })
    );

    const pinObj = pins.find((p) => p.id === pinId);
    if (pinObj) {
      const log: ActivityItem = {
        id: `act_${Date.now()}`,
        projectId: currentProject.id,
        assetId: currentAsset.id,
        author: currentUser,
        action: `updated Pin #${pinObj.number} status to`,
        targetName: newStatus.replace('_', ' '),
        timestamp: 'Just now',
        type: 'status',
      };
      setActivityLogs((prev) => [log, ...prev]);
    }
  };

  // Update pin assignee
  const handleUpdatePinAssignee = (pinId: string, assignee: Teammate) => {
    setPins((prev) =>
      prev.map((pin) => {
        if (pin.id === pinId) {
          const updated = { ...pin, assignedTo: assignee, assignedBy: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar } };
          if (selectedPin?.id === pinId) setSelectedPin(updated);
          savePinToFirestore(updated);
          return updated;
        }
        return pin;
      })
    );
  };

  // AI Automated Website Review
  const handleRunAiAudit = async (snapshot: ReviewSnapshot) => {
    setIsAuditing(true);
    try {
      const res = await apiFetch('/api/ai/audit-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          url: currentAsset.url,
          title: currentAsset.title,
          snapshot,
          // Issues already pinned on this page, so a re-run does not repeat them
          existingIssues: livePins
            .filter((p) => p.assetId === currentAsset.id && p.status !== 'archived')
            .map((p) => p.title.replace(/^\[AI Review\] /, '')),
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || `AI review failed (HTTP ${res.status}).`);
      }
      const findings: any[] = Array.isArray(result.findings) ? result.findings : [];
      if (findings.length === 0) {
        alert('The AI review found no clear issues on this page.');
        return;
      }
      ensurePageSaved(currentAsset);

      const aiReviewer: Teammate = {
        id: 'ai_gemini',
        name: 'Gemini AI Review',
        email: 'ai-review@markup.local',
        avatar: '',
        role: 'Reviewer',
        status: 'online',
        cursorColor: '#F59E0B',
      };
      const viewport = snapshot.kind === 'page' ? `${snapshot.pageWidth}x${snapshot.pageHeight}` : 'Image';
      const firstNumber = nextPinNumber(pins, projectPageIds);
      const stamp = Date.now();

      const newPins: Pin[] = findings.map((item, idx) => {
        const pinId = `ai_pin_${stamp}_${idx}`;
        return {
          id: pinId,
          assetId: currentAsset.id,
          projectId: currentProject.id,
          number: firstNumber + idx,
          x: item.x,
          y: item.y,
          category: item.category || 'design',
          status: 'open',
          priority: item.priority || 'medium',
          title: `[AI Review] ${item.title}`,
          createdAt: new Date().toISOString(),
          author: aiReviewer,
          metadata: {
            browser: 'Gemini AI review',
            os: snapshot.kind === 'page' ? 'Live page snapshot' : 'Uploaded image',
            viewport,
            selector: item.selector || '',
            deviceType: device,
          },
          comments: [
            {
              id: `ai_cmt_${stamp}_${idx}`,
              pinId,
              author: aiReviewer,
              text: item.comment,
              createdAt: new Date().toISOString(),
              isAiGenerated: true,
            },
          ],
          isUnread: true,
        };
      });

      setPins((prev) => [...newPins, ...prev]);
      newPins.forEach((pin) => savePinToFirestore(pin));
      setSelectedPin(newPins[0]);

      const log: ActivityItem = {
        id: `act_${stamp}`,
        projectId: currentProject.id,
        assetId: currentAsset.id,
        author: aiReviewer,
        action: 'completed an AI review and placed',
        targetName: `${newPins.length} ${newPins.length === 1 ? 'pin' : 'pins'}`,
        timestamp: 'Just now',
        type: 'pin',
      };
      setActivityLogs((prev) => [log, ...prev]);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'AI review failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  // ---------- Folders ----------
  const handleCreateFolder = (name: string) => {
    const folder: Folder = {
      id: `folder_${Date.now()}`,
      name: name.trim() || 'Untitled folder',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
    };
    setFolders((prev) => [...prev, folder]);
    saveFolder(folder);
    return folder;
  };

  const handleRenameFolder = (folderId: string, name: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder || !name.trim()) return;
    const updated = { ...folder, name: name.trim() };
    setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
    saveFolder(updated);
  };

  const handleMoveProject = (projectId: string, folderId: string | null) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const updated = { ...project, folderId };
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    saveProjectToFirestore(updated);
  };

  // Developers told about new client feedback on a project (empty = its creator)
  const handleAssignProject = (projectId: string, assigneeIds: string[]) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const updated = { ...project, assigneeIds };
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    saveProjectToFirestore(updated);
  };

  // Deleting a folder keeps its projects: they move back to the main list
  const handleDeleteFolder = (folderId: string) => {
    projects.filter((p) => p.folderId === folderId).forEach((p) => handleMoveProject(p.id, null));
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    deleteFolderDoc(folderId);
    if (currentFolderId === folderId) setCurrentFolderId(null);
  };

  // Create a project for a website (one project = one website). Used by the New project window and by
  // creating from an address elsewhere. Name defaults to the domain; the folder defaults to the open folder.
  const handleCreateProject = (rawUrl: string, name = '', folderId: string | null = currentFolderId) => {
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      alert('That does not look like a website address.');
      return;
    }
    const domain = parsed.hostname;
    const projId = `proj_${Date.now()}`;
    const newAsset: Asset = {
      id: `asset_${Date.now()}`,
      projectId: projId,
      title: domain,
      type: 'url',
      url: parsed.href,
      status: 'in_review',
      pinCount: 0,
      resolvedCount: 0,
    };
    const newProj: Project = {
      id: projId,
      name: name.trim() || domain,
      client: '',
      description: '',
      avatar: '🌐',
      color: 'from-blue-600 to-indigo-600',
      memberCount: 1,
      lastUpdated: 'Just now',
      ownerId: currentUser.id,
      folderId,
      assets: [newAsset],
    };

    setProjects((prev) => {
      const updated = [newProj, ...prev];
      try {
        localStorage.setItem('webreview_projects_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    saveProjectToFirestore(newProj);
    setCurrentProject(newProj);
    setCurrentAsset(newAsset);
    setSelectedPin(null);
    // Stay on the projects list (in the folder it was created in); the new project shows first, marked New
    setCurrentFolderId(newProj.folderId || null);
    setDashboardTab('dashboard');
    setViewMode('dashboard');
  };

  // Delete Project
  const handleDeleteProject = (projectId: string) => {
    const deletedProject = projects.find((p) => p.id === projectId);
    const assetIds = (deletedProject?.assets || []).map((a) => a.id);
    deleteProjectFromFirestore(projectId);
    deletePinsForAssets(assetIds);
    setPins((prev) => prev.filter((p) => !assetIds.includes(p.assetId)));
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== projectId);
      try {
        localStorage.setItem('webreview_projects_v2', JSON.stringify(updated));
      } catch (e) {}
      if (updated.length > 0 && currentProject.id === projectId) {
        setCurrentProject(updated[0]);
        if (updated[0].assets && updated[0].assets.length > 0) {
          setCurrentAsset(updated[0].assets[0]);
        }
      }
      return updated;
    });
  };

  // Delete Teammate
  const handleDeleteTeammate = (teammateId: string) => {
    const member = teammates.find((tm) => tm.id === teammateId);
    if (teammateId === currentUser.id) {
      alert('You cannot remove yourself from the workspace.');
      return;
    }
    if (member && isMasterAdmin(member.email)) {
      alert('The master admin cannot be removed.');
      return;
    }
    removeMember(teammateId);
  };

  // Delete Pin
  // Deleting a pin moves it to the Deleted tab; it can be restored or deleted permanently there
  const updatePin = (pinId: string, change: (pin: Pin) => Pin) => {
    setPins((prev) =>
      prev.map((pin) => {
        if (pin.id !== pinId) return pin;
        const updated = change(pin);
        savePinToFirestore(updated);
        if (selectedPin?.id === pinId) setSelectedPin(updated.deletedAt ? null : updated);
        return updated;
      })
    );
  };
  const handleDeletePin = (pinId: string) => {
    updatePin(pinId, (pin) => ({
      ...pin,
      deletedAt: new Date().toISOString(),
      deletedBy: { id: currentUser.id, name: currentUser.name },
    }));
    if (selectedPin?.id === pinId) setSelectedPin(null);
  };
  const handleRestorePin = (pinId: string) => {
    updatePin(pinId, (pin) => ({ ...pin, deletedAt: null, deletedBy: null }));
  };
  const handlePurgePin = (pinId: string) => {
    deletePinFromFirestore(pinId);
    setPins((prev) => prev.filter((p) => p.id !== pinId));
    if (selectedPin?.id === pinId) setSelectedPin(null);
  };
  // Pins that aren't deleted: the page, Kanban, Table, counts and QA scores use these
  const livePins = React.useMemo(() => pins.filter((p) => !p.deletedAt), [pins]);

  // Delete Comment
  const handleDeleteComment = (pinId: string, commentId: string) => {
    // Saved, so the comment disappears for everyone (it used to be removed only on this screen)
    updatePin(pinId, (pin) => ({ ...pin, comments: pin.comments.filter((c) => c.id !== commentId) }));
  };

  // Create Asset
  const handleCreateAsset = (title: string, url: string, type: Asset['type']) => {
    const newAsset: Asset = {
      id: `asset_${Date.now()}`,
      projectId: currentProject.id,
      title,
      type,
      url,
      status: 'in_review',
      pinCount: 0,
      resolvedCount: 0,
    };

    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === currentProject.id ? { ...proj, assets: [...proj.assets, newAsset] } : proj
      )
    );
    setCurrentAsset(newAsset);
    setSelectedPin(null);
    setViewMode('studio');
  };

  // Invite Teammate
  // Invite by email; the security rules decide which roles this person may invite with
  const handleInviteTeammate = async (name: string, email: string, role: Teammate['role']) => {
    if (teammates.some((tm) => tm.email.toLowerCase() === email.trim().toLowerCase())) {
      throw new Error(`${email} is already a member or has a pending invitation.`);
    }
    await inviteMember(name, email, role, currentUser.email);
    const log: ActivityItem = {
      id: `act_${Date.now()}`,
      projectId: currentProject.id,
      author: currentUser,
      action: 'invited teammate to workspace:',
      targetName: `${name || email} (${role})`,
      timestamp: new Date().toISOString(),
      type: 'approval',
    };
    setActivityLogs((prev) => [log, ...prev]);
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  const isGuestShareLink = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('guest_mode') === 'true';

  // Guests must give a name before their first pin or comment; the action then runs with that name
  const needsGuestName = !authUser && !guestProfile && guestPolicy.askGuestName;
  const addPinAsUser = (data: Parameters<typeof handleAddPin>[0]) => {
    if (needsGuestName) {
      pendingGuestAction.current = { kind: 'pin', data };
      setShowGuestNameModal(true);
      return;
    }
    handleAddPin(data);
  };
  const addCommentAsUser = (...args: Parameters<typeof handleAddComment>) => {
    if (needsGuestName) {
      pendingGuestAction.current = { kind: 'comment', args };
      setShowGuestNameModal(true);
      return;
    }
    handleAddComment(...args);
  };

  if (!authUser && ((!isGuestMode && !isGuestShareLink) || guestWantsSignIn)) {
    if (!authReady) {
      return <LoadingScreen dark />;
    }
    return <AuthPage notice={authNotice} />;
  }

  // Until the page in the address bar has been opened, show a neutral loading screen. Otherwise the dashboard
  // (the starting view) flashes for a moment, which for a guest would briefly reveal the list of all projects.
  if (!routeReady) {
    return <LoadingScreen />;
  }

  const effectiveGuestMode = isGuestMode || (!authUser && isGuestShareLink);

  const headerUser: AuthUser | undefined = authUser ? authUser : effectiveGuestMode ? {
    id: 'usr_guest',
    name: 'Guest Reviewer',
    email: 'guest@client.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Reviewer',
    status: 'online',
    cursorColor: '#F59E0B',
    organizationName: 'Guest Review Mode'
  } : undefined;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Banner when in Guest Review Mode */}
      {effectiveGuestMode && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 flex items-center justify-between text-xs shadow-sm z-50">
          <div className="flex items-center gap-2">
            <span className="text-sm">👁️</span>
            <span>
              <strong>Guest review:</strong> you are reviewing <span className="underline">{currentProject.name}</span>{guestProfile && !authUser ? ` as ${guestProfile.name}` : ''}. Drop pins and comment, no account needed.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => (authUser ? setIsGuestMode(false) : setGuestWantsSignIn(true))}
              className="bg-slate-950 text-white hover:bg-slate-900 px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer"
            >
              {authUser ? 'Exit guest preview' : 'Sign in'}
            </button>
          </div>
        </div>
      )}

      {/* Top Header Navigation */}
      <Header
        appName={appName}
        appIcon={appIcon}
        isGuestMode={effectiveGuestMode}
        // Signed-out guests use the banner's Sign in button instead
        onToggleGuestMode={authUser ? () => setIsGuestMode(!effectiveGuestMode) : undefined}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        currentAsset={currentAsset}
        onSelectAsset={handleSelectAsset}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        teammates={teammates}
        isSimulatingPartner={isSimulatingPartner}
        onToggleSimulatePartner={() => setIsSimulatingPartner(!isSimulatingPartner)}
        onOpenNewProjectModal={() => setShowNewProjectModal(true)}
        onOpenShareModal={() => {
          setShareProject(null);
          setShowShareModal(true);
        }}
        onOpenNewAssetModal={() => setShowNewAssetModal(true)}
        wpStatus={accessKey === 'member' && projects.some((p) => p.id === currentProject.id) ? (wpSite?.status || 'none') : undefined}
        onOpenWordPress={() => setShowWordPressModal(true)}
        currentUser={headerUser}
        currentOrganization={currentOrganization || undefined}
        onSignOut={handleSignOut}
        onOpenDomainModal={() => setShowDomainModal(true)}
        onOpenProfileSettings={() => setShowProfileSettingsModal(true)}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onNotificationClick={(n) => {
          if (!n.isRead) markNotificationsRead([n.id]).catch(() => {});

          // Find target pin by id or fallback to pin number match e.g. Pin #1
          let targetPin: Pin | undefined;
          if (n.pinId) {
            targetPin = pins.find((p) => p.id === n.pinId);
          }

          const targetAssetId = targetPin?.assetId || n.assetId;

          let foundProject: Project | undefined;
          let foundAsset: Asset | undefined;

          if (targetAssetId) {
            for (const proj of projects) {
              const asset = proj.assets?.find((a) => a.id === targetAssetId);
              if (asset) {
                foundProject = proj;
                foundAsset = asset;
                break;
              }
            }
          }

          if (foundProject) {
            setCurrentProject(foundProject);
          }
          if (foundAsset) {
            setCurrentAsset(foundAsset);
          }
          if (targetPin) {
            setSelectedPin(targetPin);
            if (targetPin.status === 'resolved' || targetPin.status === 'archived') {
              setFilterState((prev) => ({ ...prev, showResolved: true }));
            }
          }

          setViewMode('studio');
        }}
      />

      {/* Main Workspace View Switcher */}
      <main className="flex-1 min-h-0 min-w-0 flex overflow-hidden relative">
        {viewMode === 'dashboard' && (
          <ProjectsGridView
            projects={projects}
            pins={livePins}
            folders={folders}
            currentFolderId={currentFolderId}
            onOpenFolder={setCurrentFolderId}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveProject={handleMoveProject}
            onAssignProject={handleAssignProject}
            onSelectProject={handleSelectProject}
            onSelectAsset={handleSelectAsset}
            onOpenNewProjectModal={() => setShowNewProjectModal(true)}
            onOpenShareModal={(project?: Project) => {
              setShareProject(project || null);
              setShowShareModal(true);
            }}
            teammates={teammates}
            onUpdateTeammateRole={handleUpdateTeammateRole}
            currentUser={currentUser}
            onViewModeChange={setViewMode}
            initialTab={dashboardTab}
            onTabChange={setDashboardTab}
            initialSettingsSubTab={settingsSubTab}
            onSettingsSubTabChange={setSettingsSubTab}
            onAddNewUrlAsset={handleAddNewUrlAsset}
            onDeleteProject={handleDeleteProject}
            onDeleteTeammate={handleDeleteTeammate}
            onInviteTeammate={handleInviteTeammate}
            onRestoreProject={(archivedItem) => {
              // Restore an archived item back to active projects list
              const restoredAsset: Asset = {
                id: `asset_${Date.now()}`,
                projectId: `proj_${Date.now()}`,
                title: archivedItem.name,
                type: 'url',
                url: `https://${archivedItem.name.toLowerCase().replace(/\s+/g, '')}.com`,
                thumbnailUrl: archivedItem.thumbnailUrl,
                status: 'in_review',
                pinCount: archivedItem.pinCount,
                resolvedCount: archivedItem.resolvedCount
              };
              const restoredProject: Project = {
                id: `proj_${Date.now()}`,
                name: archivedItem.name,
                client: 'Restored Archive',
                description: 'Restored project from archive',
                color: 'from-blue-600 to-indigo-600',
                avatar: '📁',
                memberCount: 2,
                lastUpdated: 'Just now',
                ownerId: currentUser.id,
                assets: [restoredAsset]
              };
              setProjects((prev) => [restoredProject, ...prev]);
            }}
          />
        )}

        {viewMode === 'studio' && (
          <>
            <AnnotationStudio
              siteVersion={siteVersion}
              previewCss={previewCss}
              currentProject={currentProject}
              currentAsset={currentAsset}
              onNavigatePage={handleNavigatePage}
              projectPageIds={projectPageIds}
              pins={livePins}
              selectedPin={selectedPin}
              onSelectPin={setSelectedPin}
              onAddPin={addPinAsUser}
              teammates={teammates}
              currentUser={currentUser}
              filterState={filterState}
              onUpdateFilter={handleUpdateFilter}
              onRunAiAudit={handleRunAiAudit}
              isAuditing={isAuditing}
              isSimulatingPartner={isSimulatingPartner}
              isSidebarOpen={isSidebarOpen}
              isGuest={effectiveGuestMode}
              viewport={device}
              onViewportChange={(d) => {
                setDevice(d);
                if (selectedPin && pinDevice(selectedPin) !== d) setSelectedPin(null);
              }}
              onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
              // Pinned: beside the canvas (the page scales to fit). Unpinned: floats over the canvas.
              sidebar={
                isSidebarOpen && (
                  <div
                    className={
                      isSidebarPinned
                        ? 'relative h-full flex shrink-0'
                        : 'absolute top-0 right-0 bottom-0 z-30 flex shadow-2xl'
                    }
                  >
                    <SidebarDiscussion
                      pins={pins.filter(
                        (p) => (currentProject.assets.some((a) => a.id === p.assetId) || p.assetId === currentAsset.id) && pinDevice(p) === device
                      )}
                      pages={[
                        ...currentProject.assets,
                        ...(currentProject.assets.some((a) => a.id === currentAsset.id) ? [] : [currentAsset]),
                      ]}
                      currentPageId={currentAsset.id}
                      filterState={filterState}
                      onUpdateFilter={handleUpdateFilter}
                      selectedPin={selectedPin}
                      onSelectPin={setSelectedPin}
                      onUpdatePinStatus={handleUpdatePinStatus}
                      onUpdatePinAssignee={handleUpdatePinAssignee}
                      onAddComment={addCommentAsUser}
                      teammates={teammates}
                      currentUser={currentUser}
                      rubricRules={rubricRules}
                      onUpdatePinQAError={handleUpdatePinQAError}
                      onDeletePin={handleDeletePin}
                      onRestorePin={handleRestorePin}
                      onPurgePin={handlePurgePin}
                      onDeleteComment={handleDeleteComment}
                      wpFix={
                        accessKey === 'member' && selectedPin && currentAsset.type === 'url'
                          ? {
                              projectId: currentProject.id,
                              connected: wpSite?.status === 'connected',
                              onConnect: () => setShowWordPressModal(true),
                              isAdmin: isWorkspaceAdmin,
                              canAsk: canAskAi,
                              canApply: canApplyAi,
                              // A new value each time (also across app reloads), so no cached copy of the page is reused
                              onSiteChanged: () => setSiteVersion(Date.now()),
                              onPreviewCss: setPreviewCss,
                            }
                          : undefined
                      }
                      onClose={() => {
                        setIsSidebarOpen(false);
                        setSelectedPin(null);
                        // Filters live in the sidebar; clear them when it closes so no pins stay hidden
                        handleUpdateFilter({ category: 'all', search: '', showResolved: false });
                      }}
                      isPinned={isSidebarPinned}
                      onTogglePinned={toggleSidebarPinned}
                    />
                  </div>
                )
              }
            />
          </>
        )}

        {viewMode === 'qascore' && (
          <QAScoreManager
            projects={projects}
            pins={livePins}
            teammates={teammates}
            rubricRules={rubricRules}
            onUpdateRubricRules={handleUpdateRubricRules}
            onUpdatePinQAError={handleUpdatePinQAError}
            currentUser={currentUser}
            onSelectProject={(proj) => {
              setCurrentProject(proj);
              if (proj.assets?.[0]) setCurrentAsset(proj.assets[0]);
              setViewMode('studio');
            }}
            onViewModeChange={(mode) => setViewMode(mode)}
            onNavigateTab={handleNavigateDashboardTab}
          />
        )}

        {viewMode === 'kanban' && (
          <KanbanBoard
            pins={livePins}
            currentProject={currentProject}
            currentAsset={currentAsset}
            onUpdatePinStatus={handleUpdatePinStatus}
            onSelectPin={(pin) => {
              const asset = currentProject.assets.find((a) => a.id === pin.assetId) || currentAsset;
              setCurrentAsset(asset);
              setSelectedPin(pin);
              setViewMode('studio');
            }}
            teammates={teammates}
            onSwitchToStudio={(asset) => {
              setCurrentAsset(asset);
              setViewMode('studio');
            }}
          />
        )}

        {viewMode === 'matrix' && (
          <FeedbackMatrix
            pins={livePins}
            currentProject={currentProject}
            onUpdatePinStatus={handleUpdatePinStatus}
            onSelectPin={(pin) => {
              const asset = currentProject.assets.find((a) => a.id === pin.assetId) || currentAsset;
              setCurrentAsset(asset);
              setSelectedPin(pin);
              setViewMode('studio');
            }}
            teammates={teammates}
            onSwitchToStudio={(asset) => {
              setCurrentAsset(asset);
              setViewMode('studio');
            }}
          />
        )}

        {viewMode === 'activity' && (
          <TeamActivityFeed
            activityLogs={activityLogs}
            teammates={teammates}
            currentProject={currentProject}
            onInviteTeammate={handleInviteTeammate}
          />
        )}
      </main>

      {/* Modals */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProject}
        folders={folders}
        defaultFolderId={currentFolderId}
      />
      <NewAssetModal
        isOpen={showNewAssetModal}
        onClose={() => setShowNewAssetModal(false)}
        onCreateAsset={handleCreateAsset}
      />
      <GuestNameModal
        isOpen={showGuestNameModal}
        onCancel={() => {
          pendingGuestAction.current = null;
          setShowGuestNameModal(false);
        }}
        onSave={({ name, email }) => {
          const profile = { id: `guest_${Date.now().toString(36)}`, name, email };
          try {
            localStorage.setItem('mf_guest_profile', JSON.stringify(profile));
          } catch (e) {}
          setShowGuestNameModal(false);
          setGuestProfile(profile);
        }}
      />
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        currentProject={shareProject || (projects.some((p) => p.id === currentProject.id) ? currentProject : null)}
        onInviteTeammate={handleInviteTeammate}
        canChooseRole={isWorkspaceAdmin}
        allowOwner={normalizeRole(authUser?.role) === 'Owner'}
      />
      <WordPressModal
        isOpen={showWordPressModal}
        onClose={() => setShowWordPressModal(false)}
        project={currentProject}
        pageUrl={currentAsset?.type === 'url' ? currentAsset.url : undefined}
        site={wpSite}
        isAdmin={isWorkspaceAdmin}
      />
      <DomainSecurityModal
        isOpen={showDomainModal}
        onClose={() => setShowDomainModal(false)}
        currentOrganization={currentOrganization || {
          id: 'org-yda-enterprise',
          name: 'YourDigitalAgents Enterprise',
          domain: 'yourdigitalagents.com',
          allowedDomains: getAllowedDomains(),
          plan: 'Enterprise',
          ssoEnabled: true,
          maxSeats: 'Unlimited',
          activeSeats: 12
        }}
        teammates={teammates}
        onDomainsUpdated={(newDoms) => {
          if (currentOrganization) {
            const updated = { ...currentOrganization, allowedDomains: newDoms };
            setCurrentOrganization(updated);
            try { localStorage.setItem('mf_auth_org', JSON.stringify(updated)); } catch (e) {}
          }
        }}
      />
      <ProfileSettingsModal
        isOpen={showProfileSettingsModal}
        onClose={() => setShowProfileSettingsModal(false)}
        currentUser={currentUser}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
}
