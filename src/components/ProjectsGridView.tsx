import React, { useState } from 'react';
import { Project, Asset, Teammate, ViewMode, Pin, Folder, RolePermissions } from '../types';
import { projectUrl } from '../lib/routes';
import { useRolePermissions, saveRolePermission } from '../lib/permissions';
import { AiCreditsView } from './AiCreditsView';
import { AssignProjectDialog, projectAssignees } from './AssignProjectDialog';
import { AppSidebar } from './AppSidebar';
import { toMillis, timeAgo } from '../lib/time';
import { InviteForm } from './InviteForm';
import { inviteLink } from '../lib/firebaseSync';
import { AppLogo } from './AppLogo';
import { useBranding, useGuestPolicy, saveBranding, saveGuestPolicy, brandInitials, Branding, GuestPolicy } from '../lib/workspaceSettings';
import { masterAdminDomains } from '../lib/userProfile';
import { copyText } from '../lib/clipboard';
import { ARCHIVED_PROJECTS } from '../data/mockData';
import { getAllowedDomains, saveAllowedDomains, useAllowedDomains, DEFAULT_ALLOWED_DOMAINS } from '../utils/domains';
import { UserAvatar } from './UserAvatar';
import { 
  LayoutGrid, 
  Search, 
  Plus, 
  Globe, 
  Upload, 
  UserPlus, 
  Filter, 
  ArrowUpDown, 
  CheckCircle2, 
  MessageSquare, 
  Clock, 
  Users, 
  Archive, 
  Settings, 
  ChevronDown, 
  ExternalLink,
  Sparkles,
  Zap,
  Coins,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  MessageCircle,
  Info,
  Check,
  Shield,
  SlidersHorizontal,
  Grid,
  Link as LinkIcon,
  Copy,
  Lock,
  UserCheck,
  Bell,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Share2,
  MoreHorizontal,
  LogIn,
  RotateCcw,
  Award,
  Trash2,
  Building2,
  Edit3,
  RefreshCw,
  AlertCircle,
  KeyRound,
  X,
  FolderPlus,
  Folder as FolderIcon,
  ChevronRight,
  Pencil
} from 'lucide-react';

interface ProjectsGridViewProps {
  appName?: string;
  appIcon?: string;
  onUpdateBranding?: (newName: string, newIcon: string) => void;
  projects: Project[];
  pins?: Pin[];
  folders?: Folder[];
  currentFolderId?: string | null;
  onOpenFolder?: (folderId: string | null) => void;
  onCreateFolder?: (name: string) => Folder;
  onRenameFolder?: (folderId: string, name: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onMoveProject?: (projectId: string, folderId: string | null) => void;
  // Developers notified about new client feedback on a project
  onAssignProject?: (projectId: string, assigneeIds: string[]) => void;
  onSelectProject: (project: Project) => void;
  onSelectAsset: (asset: Asset) => void;
  onOpenNewProjectModal: () => void;
  onOpenShareModal: (project?: Project) => void;
  teammates: Teammate[];
  onUpdateTeammateRole?: (id: string, newRole: Teammate['role']) => void;
  currentUser: Teammate;
  onViewModeChange: (mode: ViewMode) => void;
  onAddNewUrlAsset: (url: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onDeleteTeammate?: (id: string) => void;
  onInviteTeammate?: (name: string, email: string, role: Teammate['role']) => Promise<void>;
  onRestoreProject?: (item: typeof ARCHIVED_PROJECTS[0]) => void;
  initialTab?: 'dashboard' | 'archive' | 'team' | 'credits' | 'settings';
  onTabChange?: (tab: 'dashboard' | 'archive' | 'team' | 'credits' | 'settings') => void;
  onSettingsSubTabChange?: (tab: 'details' | 'domains') => void;
  initialSettingsSubTab?: 'details' | 'domains';
}

const WebsiteThumbnailPreview: React.FC<{
  assetUrl?: string;
  projectName: string;
  customThumbnailUrl?: string;
}> = ({ assetUrl, projectName, customThumbnailUrl }) => {
  const [imgError, setImgError] = useState(false);

  let targetUrl = assetUrl || '';
  if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  let domain = 'example.com';
  try {
    if (targetUrl) {
      domain = new URL(targetUrl).hostname.replace(/^www\./, '');
    } else {
      domain = projectName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    }
  } catch (e) {
    domain = projectName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  
  const isUnsplash = customThumbnailUrl?.includes('unsplash.com');
  const screenshotEndpoint = targetUrl 
    ? `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&embed=screenshot.url`
    : null;

  const displayImageSrc = (!isUnsplash && customThumbnailUrl) 
    ? customThumbnailUrl 
    : screenshotEndpoint;

  if (displayImageSrc && !imgError) {
    return (
      <div className="relative w-full h-full bg-slate-900 group/thumb overflow-hidden">
        <img
          src={displayImageSrc}
          alt={projectName}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-2 left-2 right-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-2 text-[10px] text-slate-300 shadow-sm">
          <img src={faviconUrl} alt="" className="w-3.5 h-3.5 rounded shrink-0" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          <span className="truncate font-mono font-medium text-slate-200">{domain}</span>
          <span className="ml-auto text-emerald-400 font-extrabold shrink-0">● LIVE</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 text-white p-3 flex flex-col justify-between font-sans relative overflow-hidden">
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-indigo-600/20 rounded-full blur-xl pointer-events-none" />
      <div className="absolute -left-8 -top-8 w-32 h-32 bg-blue-600/20 rounded-full blur-xl pointer-events-none" />

      {/* Mini Browser Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 z-10">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-md px-2 py-0.5 flex items-center gap-1.5 text-[10px] text-slate-300 max-w-[160px] truncate">
          <img src={faviconUrl} alt="" className="w-3 h-3 rounded shrink-0" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          <span className="truncate font-mono">{domain}</span>
        </div>
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.5 rounded">
          Preview
        </span>
      </div>

      {/* Mini Site Preview Visual */}
      <div className="my-auto text-center px-2 py-1 z-10">
        <div className="text-[11px] font-bold tracking-wider text-indigo-400 uppercase mb-0.5">
          {domain.split('.')[0].toUpperCase()}
        </div>
        <div className="text-xs font-extrabold text-white truncate max-w-[180px] mx-auto">
          {projectName}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <div className="bg-blue-600 text-[9px] font-bold px-2.5 py-0.5 rounded text-white shadow-xs">
            Visit Site
          </div>
          <div className="bg-slate-800 text-[9px] font-medium px-2 py-0.5 rounded text-slate-300 border border-slate-700">
            Annotate
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/60 pt-1 flex items-center justify-between text-[9px] text-slate-400 z-10">
        <span className="truncate font-mono">{targetUrl || domain}</span>
        <span className="text-emerald-400 font-bold">Web Preview</span>
      </div>
    </div>
  );
};

export const ProjectsGridView: React.FC<ProjectsGridViewProps> = ({
  appName = 'WebReview Pro',
  appIcon = 'W',
  onUpdateBranding,
  projects,
  pins = [],
  folders = [],
  currentFolderId = null,
  onOpenFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveProject,
  onAssignProject,
  onSelectProject,
  onSelectAsset,
  onOpenNewProjectModal,
  onOpenShareModal,
  teammates,
  onUpdateTeammateRole,
  currentUser,
  onViewModeChange,
  onAddNewUrlAsset,
  onDeleteProject,
  onDeleteTeammate,
  onInviteTeammate,
  onRestoreProject,
  initialTab,
  onTabChange,
  onSettingsSubTabChange,
  initialSettingsSubTab
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'archive' | 'team' | 'credits' | 'settings'>(initialTab || 'dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState<'details' | 'domains'>(initialSettingsSubTab || 'details');

  const handleTabClick = (tab: 'dashboard' | 'archive' | 'team' | 'credits' | 'settings') => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  React.useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    if (initialSettingsSubTab) setSettingsSubTab(initialSettingsSubTab);
  }, [initialSettingsSubTab]);

  // Report sub-tab changes so the page URL can follow (/settings vs /settings/access)
  React.useEffect(() => {
    onSettingsSubTabChange?.(settingsSubTab);
  }, [settingsSubTab]);

  // Access control: allowed domains are shared in Firestore; keep the editable copy in sync
  const sharedDomains = useAllowedDomains();
  const [domains, setDomains] = useState<string[]>(() => getAllowedDomains());
  React.useEffect(() => setDomains(sharedDomains), [sharedDomains]);
  const [newDomain, setNewDomain] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [domainErrorMsg, setDomainErrorMsg] = useState<string | null>(null);
  const [domainSuccessMsg, setDomainSuccessMsg] = useState<string | null>(null);

  // Master Admin or Admin Permission Check
  // Owners (the master admin is always an Owner) and Admins manage workspace settings
  const isMasterAdmin = currentUser.role === 'Owner';
  const canEditDomainAccess = currentUser.role === 'Owner' || currentUser.role === 'Admin';

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditDomainAccess) return;
    setDomainErrorMsg(null);
    setDomainSuccessMsg(null);

    const cleaned = newDomain.trim().toLowerCase().replace(/^@/, '');
    if (!cleaned) {
      setDomainErrorMsg('Please enter a valid domain (e.g., broadly.com or @vendasta.com)');
      return;
    }

    if (!cleaned.includes('.')) {
      setDomainErrorMsg('Domain must contain a valid TLD extension (e.g., .com, .io, .org)');
      return;
    }

    if (domains.includes(cleaned)) {
      setDomainErrorMsg(`Domain @${cleaned} is already authorized.`);
      return;
    }

    const updated = [...domains, cleaned];
    setDomains(updated);
    saveAllowedDomains(updated);
    setNewDomain('');
    setDomainSuccessMsg(`Successfully added authorized domain: @${cleaned}`);
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    if (!canEditDomainAccess) return;
    if (domains.length <= 1) {
      setDomainErrorMsg('You must maintain at least one authorized organization domain.');
      return;
    }
    const updated = domains.filter(d => d !== domainToRemove);
    setDomains(updated);
    saveAllowedDomains(updated);
    setDomainSuccessMsg(`Removed domain: @${domainToRemove}`);
  };

  const handleStartEditDomain = (index: number, val: string) => {
    if (!canEditDomainAccess) return;
    setEditingIndex(index);
    setEditingValue(val);
    setDomainErrorMsg(null);
  };

  const handleSaveDomainEdit = (index: number) => {
    if (!canEditDomainAccess) return;
    const cleaned = editingValue.trim().toLowerCase().replace(/^@/, '');
    if (!cleaned || !cleaned.includes('.')) {
      setDomainErrorMsg('Invalid domain format.');
      return;
    }

    const updated = [...domains];
    updated[index] = cleaned;
    setDomains(updated);
    saveAllowedDomains(updated);
    setEditingIndex(null);
    setDomainSuccessMsg(`Updated domain to: @${cleaned}`);
  };

  const handleResetDomainDefaults = () => {
    if (!canEditDomainAccess) return;
    const defaultList = [...DEFAULT_ALLOWED_DOMAINS];
    setDomains(defaultList);
    saveAllowedDomains(defaultList);
    setDomainSuccessMsg('Reset authorized domain list to standard defaults (@yourdigitalagents.com, @broadly.com, @vendasta.com).');
  };

  const [filterOwner, setFilterOwner] = useState<'all' | 'mine' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string | null>(null);
  const assignProject = assignProjectId ? projects.find((p) => p.id === assignProjectId) || null : null;
  // Admins and the project's creator choose who it is assigned to
  const mayAssign = (project: Project) =>
    !!onAssignProject && (currentUser.role === 'Admin' || currentUser.role === 'Owner' || project.ownerId === currentUser.id);
  
  // Team tab state
  const [teamSubTab, setTeamSubTab] = useState<'members' | 'guests' | 'roles'>('members');

  // Role permission matrix: shared by the workspace (Firestore); only Owners and Admins can change it
  const rolePermissions = useRolePermissions();
  const canEditPermissions = currentUser.role === 'Owner' || currentUser.role === 'Admin';
  const handleTogglePermission = (key: keyof RolePermissions) => {
    if (!canEditPermissions) return;
    saveRolePermission(key, !rolePermissions[key]).catch(() => alert('Could not save the permission. Only workspace admins can change it.'));
  };

  // Open pins across all projects in the workspace
  const openPinCount = React.useMemo(() => {
    const assetIds = new Set(projects.flatMap((p) => (p.assets || []).map((a) => a.id)));
    return pins.filter((p) => assetIds.has(p.assetId) && p.status !== 'resolved' && p.status !== 'archived').length;
  }, [projects, pins]);

  // Branding & Settings state
  // Workspace branding and guest policy (saved in Firestore; Settings page)
  const branding = useBranding();
  const guestPolicy = useGuestPolicy();
  const [brandDraft, setBrandDraft] = useState<Branding | null>(null);
  const draft = brandDraft || branding;
  const [brandingNote, setBrandingNote] = useState('');
  const [policyNote, setPolicyNote] = useState('');
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  // Team page: invite dialog and "Copy invite link" feedback
  const [showInvite, setShowInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  // Guests who reviewed through a guest link (from their pins and comments)
  const guestReviewers = React.useMemo(() => {
    const byKey = new Map<string, { key: string; name: string; email: string; projectIds: Set<string>; count: number; lastMs: number }>();
    const note = (author: any, projectId: string | undefined, ms: number) => {
      if (!author || !(author.role === 'Guest' || String(author.id || '').startsWith('guest_'))) return;
      const name = String(author.name || 'Guest').replace(/\s*\(Guest\)$/, '');
      const key = author.email ? String(author.email).toLowerCase() : `${author.id || ''}|${name}`;
      const entry = byKey.get(key) || { key, name, email: author.email || '', projectIds: new Set<string>(), count: 0, lastMs: 0 };
      if (projectId) entry.projectIds.add(projectId);
      entry.count += 1;
      entry.lastMs = Math.max(entry.lastMs, ms);
      byKey.set(key, entry);
    };
    for (const pin of pins) {
      if (pin.deletedAt) continue;
      const projectId = pin.projectId || projects.find((p) => p.assets?.some((a) => a.id === pin.assetId))?.id;
      for (const c of pin.comments || []) note(c.author, projectId, toMillis(c.createdAt, c.id));
    }
    return Array.from(byKey.values())
      .map((g) => ({ ...g, projects: projects.filter((p) => g.projectIds.has(p.id)) }))
      .sort((a, b) => b.lastMs - a.lastMs);
  }, [pins, projects]);

  // Archive State
  const [archivedItems, setArchivedItems] = useState<typeof ARCHIVED_PROJECTS>([]);

  // Filter, Search, and Slider State for Archive & Dashboard
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [showArchiveSearch, setShowArchiveSearch] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [showSliderPopover, setShowSliderPopover] = useState(false);

  // Filters
  const [archiveCategoryFilter, setArchiveCategoryFilter] = useState<'all' | 'website' | 'webapp' | 'client'>('all');
  const [archiveCommentFilter, setArchiveCommentFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Sliders & Sorting
  // Cards per row on wide screens: 5 by default; a different choice is remembered per browser
  const [gridColumns, setGridColumns] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('mf_grid_columns'));
      return [3, 4, 5].includes(saved) ? saved : 5;
    } catch (e) {
      return 5;
    }
  });
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'comments'>('newest');

  const activeArchiveFilterCount = (archiveCategoryFilter !== 'all' ? 1 : 0) + (archiveCommentFilter !== 'all' ? 1 : 0);

  const filteredArchivedItems = React.useMemo(() => {
    return archivedItems
      .filter((item) => {
        // Search query match
        const matchesSearch =
          !archiveSearchQuery.trim() ||
          item.name.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
          (item.lastUpdated && item.lastUpdated.toLowerCase().includes(archiveSearchQuery.toLowerCase()));

        // Category filter match
        const lowerName = item.name.toLowerCase();
        let matchesCategory = true;
        if (archiveCategoryFilter === 'website') {
          matchesCategory = lowerName.includes('site') || lowerName.includes('com') || lowerName.includes('web') || lowerName.includes('pro');
        } else if (archiveCategoryFilter === 'webapp') {
          matchesCategory = lowerName.includes('app') || lowerName.includes('portal') || lowerName.includes('dash');
        } else if (archiveCategoryFilter === 'client') {
          matchesCategory = lowerName.includes('client') || lowerName.includes('markup') || lowerName.includes('review');
        }

        // Comment filter match
        let matchesComment = true;
        if (archiveCommentFilter === 'open') {
          matchesComment = item.pinCount > 0;
        } else if (archiveCommentFilter === 'resolved') {
          matchesComment = item.resolvedCount > 0 && item.pinCount === 0;
        }

        return matchesSearch && matchesCategory && matchesComment;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'comments') return b.pinCount - a.pinCount;
        if (sortBy === 'oldest') return a.id.localeCompare(b.id);
        return b.id.localeCompare(a.id);
      });
  }, [archivedItems, archiveSearchQuery, archiveCategoryFilter, archiveCommentFilter, sortBy]);

  const gridColumnClass =
    gridColumns === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : gridColumns === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : gridColumns === 5
      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';


  // Enter in the search box opens the folder when exactly one folder matches (search never creates projects)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (visibleFolders.length === 1 && isSearching) {
      onOpenFolder?.(visibleFolders[0].id);
      setSearchQuery('');
    }
  };

  const handleSaveBranding = () => {
    setBrandingNote('');
    saveBranding(draft)
      .then(() => {
        setBrandDraft(null);
        setBrandingNote('Saved. The new name and logo show for everyone.');
      })
      .catch(() => setBrandingNote('Could not save. Only workspace Owners and Admins can change branding.'));
  };
  const changeGuestPolicy = (change: Partial<GuestPolicy>) => {
    setPolicyNote('');
    saveGuestPolicy(change)
      .then(() => setPolicyNote('Saved.'))
      .catch(() => setPolicyNote('Could not save. Only workspace Owners and Admins can change this.'));
  };

  const copyGuestLinkForProject = (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const guestUrl = projectUrl(projId, true);
    copyText(guestUrl).then((ok) => {
      if (ok) setCopiedCardId(projId);
    });
    setTimeout(() => setCopiedCardId(null), 2000);
  };

  // Filter and sort projects based on owner filter, search, and sortBy state
  // ---------- Folders ----------
  const query = searchQuery.trim().toLowerCase();
  const isSearching = query !== '';
  const folderIds = new Set(folders.map((f) => f.id));
  const currentFolder = folders.find((f) => f.id === currentFolderId) || null;
  const folderOf = (project: Project) => folders.find((f) => f.id === project.folderId) || null;
  const projectCountIn = (folderId: string) => projects.filter((p) => p.folderId === folderId).length;

  // Dates and counts come from the real data: a project's creation time is in its id (proj_<ms>), its last activity is
  // its newest pin or comment, and a folder sorts by its most recently active project
  const createdMs = (project: Project) => Number(project.id.match(/(\d{10,})/)?.[1]) || 0;
  const pinsOf = (project: Project) =>
    pins.filter((pin) => pin.projectId === project.id || project.assets.some((a) => a.id === pin.assetId));
  const activityMs = (project: Project) =>
    pinsOf(project).reduce(
      (max, pin) => Math.max(max, toMillis(pin.createdAt, pin.id), ...(pin.comments || []).map((c) => toMillis(c.createdAt, c.id))),
      createdMs(project)
    );
  const isDone = (pin: Pin) => pin.status === 'resolved' || pin.status === 'archived';
  const folderProjects = (folderId: string) => projects.filter((p) => p.folderId === folderId);
  const folderActivityMs = (folder: Folder) =>
    folderProjects(folder.id).reduce((max, p) => Math.max(max, activityMs(p)), Date.parse(folder.createdAt) || 0);
  const hostOf = (url = '') => url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  // Searching looks everywhere: folder names (e.g. a partner ID like "PRBS") and projects in any folder
  const visibleFolders = isSearching
    ? folders.filter((f) => f.name.toLowerCase().includes(query))
    : currentFolder
    ? []
    : [...folders].sort((a, b) => a.name.localeCompare(b.name));
  const [folderDialog, setFolderDialog] = useState<{ mode: 'create' | 'rename'; folderId?: string; value: string } | null>(null);
  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);
  const [moveMenuProjectId, setMoveMenuProjectId] = useState<string | null>(null);

  const filteredProjects = React.useMemo(() => {
    return projects
      .filter((project) => {
        // Without a search, show the open folder's projects, or (at the top level) projects not in a folder
        if (!isSearching) {
          const inFolder = project.folderId && folderIds.has(project.folderId) ? project.folderId : null;
          if (inFolder !== (currentFolderId || null)) return false;
        }
        const matchesSearch = !isSearching ||
          project.name.toLowerCase().includes(query) ||
          project.client?.toLowerCase().includes(query) ||
          (folderOf(project)?.name.toLowerCase().includes(query) ?? false) ||
          project.assets.some(a => a.title.toLowerCase().includes(query) || a.url.toLowerCase().includes(query));

        if (filterOwner === 'mine') {
          return matchesSearch && (project.ownerId === currentUser.id || project.createdBy === currentUser.id);
        } else if (filterOwner !== 'all') {
          return matchesSearch && project.ownerId === filterOwner;
        }

        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'comments') return pinsOf(b).filter((p) => !isDone(p)).length - pinsOf(a).filter((p) => !isDone(p)).length;
        if (sortBy === 'oldest') return activityMs(a) - activityMs(b);
        return activityMs(b) - activityMs(a);
      });
  }, [projects, pins, searchQuery, filterOwner, sortBy, currentUser, folders, currentFolderId]);

  // Folders and projects in one list, in the chosen order (newest activity first by default)
  const gridOrder = React.useMemo(() => {
    const items = [
      ...visibleFolders.map((f) => ({
        key: `f:${f.id}`,
        ms: folderActivityMs(f),
        name: f.name,
        open: folderProjects(f.id).reduce((n, p) => n + pinsOf(p).filter((pin) => !isDone(pin)).length, 0),
      })),
      ...filteredProjects.map((p) => ({ key: `p:${p.id}`, ms: activityMs(p), name: p.name, open: pinsOf(p).filter((pin) => !isDone(pin)).length })),
    ];
    items.sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name)
        : sortBy === 'comments' ? b.open - a.open
        : sortBy === 'oldest' ? a.ms - b.ms
        : b.ms - a.ms
    );
    return new Map(items.map((item, i) => [item.key, i + 1]));
  }, [visibleFolders, filteredProjects, pins, sortBy]);

  return (
    <div className="flex-1 min-w-0 flex bg-slate-100/70 text-slate-900 overflow-hidden h-[calc(100vh-3.5rem)]">
      
      {/* LEFT MENU (shared by every workspace page) */}
      <AppSidebar
        active={activeTab}
        onNavigate={(item) => (item === 'qascore' ? onViewModeChange('qascore') : handleTabClick(item))}
        showCredits={canEditPermissions}
        projectCount={projects.length}
        openPinCount={openPinCount}
      />

      {/* RIGHT MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        
        {/* TAB 1: DASHBOARD (PROJECTS GRID VIEW) */}
        {activeTab === 'dashboard' && (
          <>
            {/* TOP BAR WITH URL ENTERER & SEARCH */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-10 shadow-2xs">
              
              {/* Search & Action Controls */}
              <div className="flex items-center gap-3 w-full">
                <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search folders and projects..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all"
                  />
                </form>

                {onCreateFolder && !currentFolderId && (
                  <button
                    onClick={() => setFolderDialog({ mode: 'create', value: '' })}
                    className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>New Folder</span>
                  </button>
                )}

                <button
                  onClick={onOpenNewProjectModal}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
              </div>

            </div>

            {/* DASHBOARD CONTENT BODY */}
            <div className="px-8 py-6 space-y-6">
              
              {/* Workspace Title & Owner Filter Sub-header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 min-w-0">
                    {isSearching ? (
                      // Long searches (e.g. a pasted URL) are shortened; the full text shows on hover
                      <span className="truncate min-w-0" title={searchQuery.trim()}>Results for "{searchQuery.trim()}"</span>
                    ) : currentFolder ? (
                      <>
                        <button
                          onClick={() => onOpenFolder?.(null)}
                          className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                        >
                          All projects
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate min-w-0" title={currentFolder.name}>{currentFolder.name}</span>
                        {onRenameFolder && (
                          <button
                            onClick={() => setFolderDialog({ mode: 'rename', folderId: currentFolder.id, value: currentFolder.name })}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
                            title="Rename folder"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span>All projects</span>
                    )}
                    <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      {isSearching
                        ? `${visibleFolders.length} ${visibleFolders.length === 1 ? 'folder' : 'folders'}, ${filteredProjects.length} ${filteredProjects.length === 1 ? 'project' : 'projects'}`
                        : `${filteredProjects.length} ${filteredProjects.length === 1 ? 'project' : 'projects'}`}
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSearching
                      ? 'Searching folder names and projects in every folder.'
                      : currentFolder
                      ? 'New projects you create here go into this folder.'
                      : 'Group projects into folders, e.g. one folder per partner.'}
                  </p>
                </div>

                {/* Owner Filter Pills (never shrink or wrap) */}
                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                  <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 text-xs font-bold">
                    <button
                      onClick={() => setFilterOwner('all')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        filterOwner === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Team Projects
                    </button>
                    <button
                      onClick={() => setFilterOwner('mine')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        filterOwner === 'mine'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      My Projects
                    </button>
                  </div>

                  <div className="border-l border-slate-300 h-6 mx-1" />

                  {/* Sort By Toggle */}
                  <button
                    onClick={() => {
                      setSortBy(prev => prev === 'newest' ? 'name' : prev === 'name' ? 'comments' : 'newest');
                    }}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title={`Sorted by: ${sortBy === 'name' ? 'Name (A-Z)' : sortBy === 'comments' ? 'Most Comments' : 'Newest First'}. Click to cycle sort.`}
                  >
                    <ArrowUpDown className="w-4 h-4 text-indigo-600" />
                    <span className="hidden sm:inline text-[11px] font-semibold text-slate-700 capitalize">
                      {sortBy === 'name' ? 'A-Z' : sortBy === 'comments' ? 'Comments' : 'Newest'}
                    </span>
                  </button>

                  {/* Grid Scale / Column Density Toggle */}
                  <button
                    onClick={() => {
                      setGridColumns(prev => {
                        const next = prev === 5 ? 4 : prev === 4 ? 3 : 5;
                        try {
                          localStorage.setItem('mf_grid_columns', String(next));
                        } catch (e) {}
                        return next;
                      });
                    }}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title={`Current layout: ${gridColumns} columns. Click to cycle density.`}
                  >
                    <Grid className="w-4 h-4 text-indigo-600" />
                    <span className="hidden sm:inline text-[11px] font-semibold text-slate-700">
                      {gridColumns} cols
                    </span>
                  </button>
                </div>
              </div>

              {/* PROJECTS GRID DISPLAY */}
              <div className={`grid ${gridColumnClass} gap-6`}>
                {isSearching && filteredProjects.length === 0 && visibleFolders.length === 0 && (
                  <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">
                    <span className="break-all" title={searchQuery.trim()}>
                      No folders or projects match "{searchQuery.trim().length > 80 ? `${searchQuery.trim().slice(0, 77)}…` : searchQuery.trim()}".
                    </span>
                  </div>
                )}

                {!isSearching && currentFolder && filteredProjects.length === 0 && (
                  <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">
                    This folder is empty. Create a project here, or use <strong>Move to folder</strong> in a project's menu.
                  </div>
                )}

                {/* FOLDER CARDS (same size as project cards; placed among them by date) */}
                {visibleFolders.map((folder) => {
                  const count = projectCountIn(folder.id);
                  const inside = folderProjects(folder.id).sort((a, b) => activityMs(b) - activityMs(a));
                  const openPins = inside.reduce((n, p) => n + pinsOf(p).filter((pin) => !isDone(pin)).length, 0);
                  const donePins = inside.reduce((n, p) => n + pinsOf(p).filter(isDone).length, 0);
                  return (
                    <div
                      key={folder.id}
                      style={{ order: gridOrder.get(`f:${folder.id}`) }}
                      onClick={() => {
                        setSearchQuery('');
                        onOpenFolder?.(folder.id);
                      }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xl transition-all duration-200 overflow-hidden group cursor-pointer flex flex-col justify-between hover:-translate-y-0.5 relative"
                    >
                      <div className="absolute top-3 right-3 z-30" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveFolderMenuId(activeFolderMenuId === folder.id ? null : folder.id)}
                          className="bg-slate-900/60 hover:bg-slate-900/90 text-white p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer shadow-md"
                          title="Folder options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {activeFolderMenuId === folder.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 text-xs">
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                setFolderDialog({ mode: 'rename', folderId: folder.id, value: folder.name });
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                if (window.confirm(`Delete the folder "${folder.name}"? Its ${count} ${count === 1 ? 'project' : 'projects'} will move back to All projects (nothing is deleted).`)) {
                                  onDeleteFolder?.(folder.id);
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 font-medium cursor-pointer"
                            >
                              Delete folder
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Folder preview: the folder and the sites inside it */}
                      <div className="relative aspect-[16/10] bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 border-b border-slate-100 flex flex-col items-center justify-center gap-3 p-4 overflow-hidden">
                        <FolderIcon className="w-14 h-14 text-blue-500 group-hover:scale-105 transition-transform" strokeWidth={1.5} />
                        {inside.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1.5 max-w-full">
                            {inside.slice(0, 3).map((p) => (
                              <span key={p.id} className="flex items-center gap-1 bg-white/90 border border-slate-200 rounded-full pl-1 pr-2 py-0.5 text-[10px] font-medium text-slate-600 max-w-[140px]">
                                <img src={`https://www.google.com/s2/favicons?domain=${hostOf(p.assets[0]?.url)}&sz=32`} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" />
                                <span className="truncate">{hostOf(p.assets[0]?.url) || p.name}</span>
                              </span>
                            ))}
                            {inside.length > 3 && (
                              <span className="bg-white/90 border border-slate-200 rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-500">+{inside.length - 3} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Empty folder</span>
                        )}
                      </div>
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate" title={folder.name}>
                            {folder.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Updated {timeAgo(folderActivityMs(folder))}</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center gap-3 font-semibold text-slate-600">
                            <span className="flex items-center gap-1 text-slate-500" title="Resolved comments">
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>{donePins}</span>
                            </span>
                            <span className="flex items-center gap-1 text-slate-700 font-bold" title="Open comments">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                              <span>{openPins}</span>
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-blue-600">
                            {count} {count === 1 ? 'project' : 'projects'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredProjects.map((project) => {
                  const primaryAsset = project.assets[0] || { id: '', title: project.name, type: 'url', url: '', thumbnailUrl: undefined };

                  const projectPins = pinsOf(project);
                  const totalResolved = projectPins.filter(isDone).length;
                  const totalUnresolved = projectPins.length - totalResolved;
                  const isNew = Date.now() - createdMs(project) < 24 * 60 * 60 * 1000;

                  const assignees = projectAssignees(project, teammates);
                  const assignedLabel = project.assigneeIds?.length
                    ? `Assigned to ${assignees.map((t) => t.name).join(', ')}`
                    : assignees[0] ? `Not assigned: ${assignees[0].name} (creator) gets client feedback` : 'Not assigned';

                  return (
                    <div
                      key={project.id}
                      style={{ order: gridOrder.get(`p:${project.id}`) }}
                      onClick={() => {
                        onSelectProject(project);
                        if (project.assets && project.assets.length > 0) {
                          onSelectAsset(project.assets[0]);
                        }
                        onViewModeChange('studio');
                      }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xl transition-all duration-200 overflow-hidden group cursor-pointer flex flex-col justify-between hover:-translate-y-0.5 relative"
                    >
                      
                      {/* TOP OVERLAY CONTROLS */}
                      {isNew && (
                        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                          <span className="bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                            New
                          </span>
                        </div>
                      )}

                      <div className="absolute top-3 right-3 z-30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCardMenuId(activeCardMenuId === project.id ? null : project.id);
                          }}
                          className="bg-slate-900/60 hover:bg-slate-900/90 text-white p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer shadow-md"
                          title="Project options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {activeCardMenuId === project.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              onClick={(e) => {
                                copyGuestLinkForProject(project.id, e);
                                setActiveCardMenuId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-center gap-2 font-medium cursor-pointer"
                            >
                              <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                              <span>{copiedCardId === project.id ? '✓ Link Copied!' : 'Copy Guest Review Link'}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectProject(project);
                                if (project.assets && project.assets.length > 0) {
                                  onSelectAsset(project.assets[0]);
                                }
                                onViewModeChange('studio');
                                setActiveCardMenuId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-center gap-2 font-medium cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Open Studio & Annotate</span>
                            </button>
                            {mayAssign(project) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignProjectId(project.id);
                                  setActiveCardMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-center gap-2 font-medium cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Assign developers</span>
                              </button>
                            )}
                            {onMoveProject && folders.length > 0 && (
                              <div className="border-t border-slate-100 mt-1 pt-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMoveMenuProjectId(moveMenuProjectId === project.id ? null : project.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-center justify-between gap-2 font-medium cursor-pointer"
                                >
                                  <span className="flex items-center gap-2">
                                    <FolderIcon className="w-3.5 h-3.5 text-blue-600" />
                                    Move to folder
                                  </span>
                                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${moveMenuProjectId === project.id ? 'rotate-90' : ''}`} />
                                </button>
                                {moveMenuProjectId === project.id && (
                                  <div className="max-h-48 overflow-y-auto pb-1">
                                    {[{ id: null as string | null, name: 'No folder' }, ...[...folders].sort((a, b) => a.name.localeCompare(b.name))].map((f) => {
                                      const isCurrent = (project.folderId || null) === f.id;
                                      return (
                                        <button
                                          key={f.id || 'none'}
                                          disabled={isCurrent}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onMoveProject(project.id, f.id);
                                            setMoveMenuProjectId(null);
                                            setActiveCardMenuId(null);
                                          }}
                                          className={`w-full text-left pl-8 pr-3 py-1.5 truncate ${isCurrent ? 'text-slate-400' : 'text-slate-700 hover:bg-slate-100 cursor-pointer'}`}
                                          title={f.name}
                                        >
                                          {f.name}{isCurrent ? ' (current)' : ''}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {onDeleteProject && (() => {
                              const isOwnerOrAdmin = currentUser.role === 'Admin' || currentUser.role === 'Owner';
                              const isProjectCreator = project.ownerId === currentUser.id || project.ownerId === currentUser.email || project.createdBy === currentUser.email || project.createdBy === currentUser.id;
                              const canDeleteThisProject = isOwnerOrAdmin || isProjectCreator;

                              return (
                                <div className="border-t border-slate-100 mt-1 pt-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!canDeleteThisProject) {
                                        alert(`Permission Denied: Members can only delete projects they created.`);
                                        setActiveCardMenuId(null);
                                        return;
                                      }
                                      if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
                                        onDeleteProject(project.id);
                                      }
                                      setActiveCardMenuId(null);
                                    }}
                                    className={`w-full text-left px-3 py-2 flex items-center justify-between font-medium cursor-pointer ${
                                      canDeleteThisProject
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-slate-400 hover:bg-slate-50 cursor-not-allowed'
                                    }`}
                                    title={
                                      canDeleteThisProject
                                        ? 'Delete this project'
                                        : 'Members can only delete projects they created'
                                    }
                                  >
                                    <span>🗑️ Delete Project</span>
                                    {!canDeleteThisProject && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* THUMBNAIL PREVIEW BOX WITH CENTER OPEN & SHARE BUTTONS */}
                      <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden border-b border-slate-100 group-hover:opacity-95 transition-opacity">
                        <WebsiteThumbnailPreview
                          assetUrl={primaryAsset.url}
                          projectName={project.name}
                          customThumbnailUrl={primaryAsset.thumbnailUrl}
                        />

                        {/* HOVER OVERLAY MATCHING SCREENSHOT (OPEN & SHARE) */}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 p-4 backdrop-blur-[2px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProject(project);
                              if (project.assets && project.assets.length > 0) {
                                onSelectAsset(project.assets[0]);
                              }
                              onViewModeChange('studio');
                            }}
                            className="bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
                          >
                            <LogIn className="w-4 h-4 text-slate-800" />
                            <span>Open</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyGuestLinkForProject(project.id, e);
                              onOpenShareModal(project);
                            }}
                            className="bg-slate-900/80 hover:bg-slate-950 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-2 border border-white/30 transition-all transform hover:scale-105 cursor-pointer"
                          >
                            {copiedCardId === project.id ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-4 h-4 text-white" />
                                <span>Share</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* CARD DETAILS */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {primaryAsset.url ? primaryAsset.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : project.name}
                          </h3>

                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Updated {timeAgo(activityMs(project))}</span>
                          </div>
                          {isSearching && folderOf(project) && (
                            <div className="flex items-center gap-1 text-[11px] text-blue-600 mt-1 truncate">
                              <FolderIcon className="w-3 h-3 shrink-0" />
                              <span className="truncate">{folderOf(project)!.name}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center gap-3 font-semibold text-slate-600">
                            <span className="flex items-center gap-1 text-slate-500" title="Resolved comments">
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>{totalResolved}</span>
                            </span>
                            
                            <span className="flex items-center gap-1 text-slate-700 font-bold" title="Open comments">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                              <span>{totalUnresolved}</span>
                            </span>
                          </div>

                          {assignees.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (mayAssign(project)) setAssignProjectId(project.id);
                              }}
                              className={`flex items-center gap-1.5 rounded-full pr-1.5 ${mayAssign(project) ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'}`}
                              title={`${assignedLabel}${mayAssign(project) ? '. Click to change.' : ''}`}
                              aria-label={assignedLabel}
                            >
                              <span className="flex -space-x-1.5">
                                {assignees.slice(0, 3).map((t) => (
                                  <span key={t.id} className="rounded-full ring-2 ring-white">
                                    <UserAvatar name={t.name} email={t.email} avatar={t.avatar} size={20} title={t.name} />
                                  </span>
                                ))}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 max-w-[80px] truncate">
                                {assignees.length > 3 ? `+${assignees.length - 3}` : assignees.length === 1 ? assignees[0].name.split(' ')[0] : ''}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}

              </div>
            </div>
          </>
        )}

        {assignProject && (
          <AssignProjectDialog
            project={assignProject}
            teammates={teammates}
            onSave={(ids) => onAssignProject?.(assignProject.id, ids)}
            onClose={() => setAssignProjectId(null)}
          />
        )}

        {folderDialog && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = folderDialog.value.trim();
                if (!name) return;
                if (folderDialog.mode === 'create') {
                  onCreateFolder?.(name);
                } else if (folderDialog.folderId) {
                  onRenameFolder?.(folderDialog.folderId, name);
                }
                setFolderDialog(null);
              }}
              className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-sm"
            >
              <h2 className="font-extrabold text-base text-slate-900">{folderDialog.mode === 'create' ? 'New folder' : 'Rename folder'}</h2>
              <label className="block">
                <span className="text-xs font-bold text-slate-600">Folder name</span>
                <input
                  autoFocus
                  value={folderDialog.value}
                  onChange={(e) => setFolderDialog({ ...folderDialog, value: e.target.value })}
                  placeholder="e.g. PRBS - Prestige Roofing"
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                />
              </label>
              <p className="text-[11px] text-slate-500">Tip: start with the partner ID (like PRBS) so it is easy to find with search.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFolderDialog(null)} className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  {folderDialog.mode === 'create' ? 'Create folder' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: ARCHIVE PAGE (CLICKABLE & RESTORABLE) */}
        {activeTab === 'archive' && (
          <div className="px-8 py-6 space-y-6">
            
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/80 pb-4 gap-4 relative">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Archived Markups & Projects</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Archived projects are stored for reference. Click any card to view in Studio or click Restore.
                </p>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2.5 relative">
                
                {/* Search Input Toggle */}
                {showArchiveSearch ? (
                  <div className="relative animate-in fade-in zoom-in-95 duration-150">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={archiveSearchQuery}
                      onChange={(e) => setArchiveSearchQuery(e.target.value)}
                      placeholder="Search archived markups..."
                      className="bg-white border-2 border-indigo-600 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none w-56 shadow-2xs font-medium"
                    />
                    <button
                      onClick={() => {
                        setArchiveSearchQuery('');
                        setShowArchiveSearch(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowArchiveSearch(true)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                      archiveSearchQuery
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title="Search archived markups"
                  >
                    <Search className="w-4 h-4" />
                    {archiveSearchQuery && <span className="max-w-[80px] truncate">{archiveSearchQuery}</span>}
                  </button>
                )}

                {/* Filter Button & Popover */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowFilterPopover(!showFilterPopover);
                      setShowSliderPopover(false);
                    }}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                      showFilterPopover || activeArchiveFilterCount > 0
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title="Filter archived markups"
                  >
                    <Filter className="w-4 h-4" />
                    {activeArchiveFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-white text-indigo-700 text-[10px] font-black flex items-center justify-center">
                        {activeArchiveFilterCount}
                      </span>
                    )}
                  </button>

                  {/* FILTER POPOVER CARD */}
                  {showFilterPopover && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Filter className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Filter Markups</span>
                        </span>
                        {activeArchiveFilterCount > 0 && (
                          <button
                            onClick={() => {
                              setArchiveCategoryFilter('all');
                              setArchiveCommentFilter('all');
                            }}
                            className="text-[10px] text-indigo-600 hover:underline font-bold"
                          >
                            Reset All
                          </button>
                        )}
                      </div>

                      {/* Category Filter */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Project Type
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'all', label: 'All Types' },
                            { id: 'website', label: 'Websites' },
                            { id: 'webapp', label: 'Web Apps' },
                            { id: 'client', label: 'Client Reviews' }
                          ].map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => setArchiveCategoryFilter(cat.id as any)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border text-left transition-all cursor-pointer ${
                                archiveCategoryFilter === cat.id
                                  ? 'bg-indigo-50 border-indigo-600 text-indigo-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Comments Filter */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Comment Status
                        </label>
                        <div className="space-y-1">
                          {[
                            { id: 'all', label: 'All Statuses' },
                            { id: 'open', label: 'Has Open Comments' },
                            { id: 'resolved', label: 'Fully Resolved' }
                          ].map((st) => (
                            <button
                              key={st.id}
                              onClick={() => setArchiveCommentFilter(st.id as any)}
                              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border text-left transition-all cursor-pointer flex items-center justify-between ${
                                archiveCommentFilter === st.id
                                  ? 'bg-indigo-50 border-indigo-600 text-indigo-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <span>{st.label}</span>
                              {archiveCommentFilter === st.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => setShowFilterPopover(false)}
                        className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Apply Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* Sliders Control Button & Range Slider Popover */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowSliderPopover(!showSliderPopover);
                      setShowFilterPopover(false);
                    }}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                      showSliderPopover || gridColumns !== 4 || sortBy !== 'newest'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title="Grid scale slider & sort settings"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>

                  {/* SLIDERS & SORT POPOVER CARD */}
                  {showSliderPopover && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Display & Layout Controls</span>
                        </span>
                        <button
                          onClick={() => {
                            setGridColumns(4);
                            setSortBy('newest');
                          }}
                          className="text-[10px] text-indigo-600 hover:underline font-bold"
                        >
                          Reset
                        </button>
                      </div>

                      {/* GRID COLUMNS RANGE SLIDER */}
                      <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                            Card Scale / Grid Columns
                          </label>
                          <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                            {gridColumns === 2 ? '2 Columns (Large)' : gridColumns === 3 ? '3 Columns' : gridColumns === 5 ? '5 Columns (Compact)' : '4 Columns (Standard)'}
                          </span>
                        </div>

                        {/* Interactive Range Slider */}
                        <div className="space-y-1 pt-1">
                          <input
                            type="range"
                            min="2"
                            max="5"
                            step="1"
                            value={gridColumns}
                            onChange={(e) => setGridColumns(Number(e.target.value))}
                            className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                            <span>Large (2)</span>
                            <span>Standard (4)</span>
                            <span>Compact (5)</span>
                          </div>
                        </div>
                      </div>

                      {/* Sort By Options */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Sort Order
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'newest', label: 'Newest First' },
                            { id: 'oldest', label: 'Oldest First' },
                            { id: 'name', label: 'Name (A-Z)' },
                            { id: 'comments', label: 'Most Comments' }
                          ].map((st) => (
                            <button
                              key={st.id}
                              onClick={() => setSortBy(st.id as any)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border text-left transition-all cursor-pointer ${
                                sortBy === st.id
                                  ? 'bg-indigo-50 border-indigo-600 text-indigo-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => setShowSliderPopover(false)}
                        className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Grid of Archived Markups - CLICKABLE & RESTORABLE */}
            <div className={`grid ${gridColumnClass} gap-6`}>
              {filteredArchivedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    const tempAsset: Asset = {
                      id: `asset_arch_${item.id}`,
                      projectId: `proj_arch_${item.id}`,
                      title: item.name,
                      type: 'url',
                      url: `https://${item.name.toLowerCase().replace(/\s+/g, '')}.com`,
                      thumbnailUrl: item.thumbnailUrl,
                      status: 'in_review',
                      pinCount: item.pinCount,
                      resolvedCount: item.resolvedCount
                    };
                    const tempProject: Project = {
                      id: `proj_arch_${item.id}`,
                      name: item.name,
                      client: 'Archived Client',
                      description: 'Archived project record',
                      color: 'from-slate-600 to-gray-700',
                      avatar: '📦',
                      memberCount: 2,
                      lastUpdated: item.lastUpdated,
                      assets: [tempAsset]
                    };
                    onSelectProject(tempProject);
                    onSelectAsset(tempAsset);
                    onViewModeChange('studio');
                  }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col justify-between relative group cursor-pointer"
                >
                  {/* Archived Tag Badge */}
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <span className="bg-slate-700 text-white font-bold text-[10px] px-2.5 py-0.5 rounded shadow-2xs backdrop-blur-xs flex items-center gap-1">
                      <Archive className="w-3 h-3" />
                      <span>Archived</span>
                    </span>
                  </div>

                  {/* Thumbnail Image with Action Buttons */}
                  <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                    <WebsiteThumbnailPreview
                      assetUrl={`https://${item.name.toLowerCase().replace(/\s+/g, '')}.com`}
                      projectName={item.name}
                      customThumbnailUrl={item.thumbnailUrl}
                    />

                    {/* Hover Overlay with Open Studio and Restore */}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const tempAsset: Asset = {
                            id: `asset_arch_${item.id}`,
                            projectId: `proj_arch_${item.id}`,
                            title: item.name,
                            type: 'url',
                            url: `https://${item.name.toLowerCase().replace(/\s+/g, '')}.com`,
                            thumbnailUrl: item.thumbnailUrl,
                            status: 'in_review',
                            pinCount: item.pinCount,
                            resolvedCount: item.resolvedCount
                          };
                          const tempProject: Project = {
                            id: `proj_arch_${item.id}`,
                            name: item.name,
                            client: 'Archived Client',
                            description: 'Archived project record',
                            color: 'from-slate-600 to-gray-700',
                            avatar: '📦',
                            memberCount: 2,
                            lastUpdated: item.lastUpdated,
                            assets: [tempAsset]
                          };
                          onSelectProject(tempProject);
                          onSelectAsset(tempAsset);
                          onViewModeChange('studio');
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Studio</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRestoreProject) {
                            onRestoreProject(item);
                          }
                          setArchivedItems(prev => prev.filter(a => a.id !== item.id));
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1 transition-all"
                        title="Restore back to active projects grid"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Archived {item.lastUpdated}
                      </p>
                    </div>

                    {/* Checkmark & Comment icons */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{item.resolvedCount} Resolved</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        <span>{item.pinCount} Comments</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {filteredArchivedItems.length === 0 && (
                <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                    🔍
                  </div>
                  <div className="text-sm font-bold text-slate-800">No archived markups found</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try adjusting your search query or reset category/comment filters.
                  </p>
                  <button
                    onClick={() => {
                      setArchiveSearchQuery('');
                      setArchiveCategoryFilter('all');
                      setArchiveCommentFilter('all');
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    Clear Filters & Search
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: TEAM PAGE (MEMBERS & GUESTS MANAGEMENT) */}
        {activeTab === 'team' && (
          <div className="px-8 py-6 space-y-6 w-full">
            
            {/* Team Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team & Guest Management</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage workspace roles, permissions, and client guest access.
                </p>
              </div>
              
              <button
                onClick={() => setShowInvite(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Invite Teammate</span>
              </button>
            </div>

            {showInvite && (
              <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setShowInvite(false)}>
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-base text-slate-900">Invite a teammate</h2>
                    <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg" aria-label="Close">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {onInviteTeammate ? (
                    <InviteForm
                      canChooseRole={currentUser.role === 'Owner' || currentUser.role === 'Admin'}
                      allowOwner={currentUser.role === 'Owner'}
                      onInvite={onInviteTeammate}
                    />
                  ) : null}
                  <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                    Clients don't need an account: share a project's guest review link from the <strong>Share</strong> button instead.
                  </p>
                </div>
              </div>
            )}

            {/* Members / Guests / Roles Sub-tabs */}
            <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setTeamSubTab('members')}
                className={`pb-2.5 transition-colors relative cursor-pointer shrink-0 ${
                  teamSubTab === 'members'
                    ? 'text-slate-900 border-b-2 border-slate-900 font-black'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Workspace Members ({teammates.filter((t) => !t.pendingInvite).length})
                {teammates.some((t) => t.pendingInvite) && (
                  <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full">
                    {teammates.filter((t) => t.pendingInvite).length} invited
                  </span>
                )}
              </button>
              <button
                onClick={() => setTeamSubTab('guests')}
                className={`pb-2.5 transition-colors relative cursor-pointer shrink-0 ${
                  teamSubTab === 'guests'
                    ? 'text-slate-900 border-b-2 border-slate-900 font-black'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                External Guests & Clients ({guestReviewers.length})
              </button>
              <button
                onClick={() => setTeamSubTab('roles')}
                className={`pb-2.5 transition-colors relative cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  teamSubTab === 'roles'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 font-black'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>Roles & Permission Matrix</span>
              </button>
            </div>

            {/* MEMBERS SUB-TAB TABLE WITH ROLE DROPDOWN MANAGEMENT */}
            {teamSubTab === 'members' && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/70">
                      <th className="py-3.5 px-5">Member Name</th>
                      <th className="py-3.5 px-5">Email Address</th>
                      <th className="py-3.5 px-5">Manage Workspace Role</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teammates.map((tm) => {
                      // Owners and Admins manage the team; nobody changes their own role; the master admin is fixed
                      const isCurrentUserAdminOrOwner = currentUser.role === 'Admin' || currentUser.role === 'Owner';
                      const isSelf = tm.id === currentUser.id || tm.email.toLowerCase() === currentUser.email.toLowerCase();
                      const isTargetMasterAdmin = tm.isMasterAdmin === true;
                      const canEditThisMemberRole = isCurrentUserAdminOrOwner && !isSelf && !isTargetMasterAdmin;
                      const isTeammateCreator = tm.createdBy === currentUser.email;
                      // Active members: admins only. Pending invites: admins or whoever sent the invite
                      const canRemoveThisTeammate = !isSelf && !isTargetMasterAdmin && (isCurrentUserAdminOrOwner || (tm.pendingInvite === true && isTeammateCreator));

                      return (
                        <tr key={tm.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-slate-900 flex items-center gap-3">
                            <UserAvatar
                              name={tm.name}
                              email={tm.email}
                              avatar={tm.avatar}
                              status={tm.status}
                              size="sm"
                              showOnlineStatus
                              showGoogleBadge
                            />
                            <div>
                              <span className="font-bold">{tm.name}</span>
                              {tm.id === currentUser.id && (
                                <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                                  You
                                </span>
                              )}

                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-slate-600 font-mono text-[11px]">
                            {tm.email}
                          </td>
                          <td className="py-3.5 px-5">
                            {/* PROTECTED MASTER ADMIN BADGE VS ROLE DROPDOWN VS LOCKED BADGE FOR MEMBERS */}
                            {isTargetMasterAdmin ? (
                              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300/80 px-3 py-1.5 rounded-lg text-xs font-black shadow-2xs">
                                <span>👑 Master Admin</span>
                              </span>
                            ) : canEditThisMemberRole ? (
                              <select
                                value={tm.role}
                                onChange={(e) => {
                                  if (onUpdateTeammateRole) {
                                    onUpdateTeammateRole(tm.id, e.target.value as any);
                                  }
                                }}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                              >
                                <option value="Member">Member</option>
                                <option value="Admin">Admin</option>
                                {(currentUser.role === 'Owner' || tm.role === 'Owner') && <option value="Owner">Owner</option>}
                                {!['Member', 'Admin', 'Owner'].includes(tm.role) && <option value={tm.role}>{tm.role}</option>}
                              </select>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-200/80 px-3 py-1.5 rounded-lg text-xs font-bold cursor-not-allowed"
                                title={isSelf ? "Members cannot change their own role." : "Only Admins can change member roles."}
                              >
                                <span>{tm.role}</span>
                                <Lock className="w-3 h-3 text-slate-400" />
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 font-medium">
                            {tm.lastActive === 'Invitation pending' ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Pending</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Active</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right font-medium">
                            <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            {tm.pendingInvite && (
                              <button
                                onClick={() => {
                                  copyText(inviteLink(tm.email)).then((ok) => {
                                    if (ok) {
                                      setCopiedInvite(tm.id);
                                      setTimeout(() => setCopiedInvite(null), 2000);
                                    }
                                  });
                                }}
                                className="p-1.5 rounded-lg border bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                title="Copy a sign-up link with their email filled in"
                              >
                                {copiedInvite === tm.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <LinkIcon className="w-3.5 h-3.5" />}
                                <span>{copiedInvite === tm.id ? 'Copied' : 'Copy link'}</span>
                              </button>
                            )}
                            {!isSelf && !isTargetMasterAdmin && canRemoveThisTeammate && (
                              <button
                                onClick={() => {
                                  const question = tm.pendingInvite
                                    ? `Cancel the invitation for ${tm.email}?`
                                    : `Remove ${tm.name} from the workspace? They can no longer sign in.`;
                                  if (window.confirm(question)) {
                                    if (onDeleteTeammate) {
                                      onDeleteTeammate(tm.id);
                                    }
                                  }
                                }}
                                className={`p-1.5 rounded-lg border transition-colors inline-flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                                  canRemoveThisTeammate
                                    ? 'bg-white border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                                title={
                                  canRemoveThisTeammate
                                    ? `Remove ${tm.name}`
                                    : 'Members can only remove teammates they created'
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{tm.pendingInvite ? 'Cancel' : 'Remove'}</span>
                              </button>
                            )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* GUESTS SUB-TAB (EXPLAINER & CLIENT GUEST LIST) */}
            {teamSubTab === 'guests' && (
              <div className="space-y-5">
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-amber-950 text-sm">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    <span>What are External Guests?</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Guests are clients, reviewers, or stakeholders who have been given a <strong>Guest Share Link</strong> (`?guest_mode=true`). They do not require a workspace email or login password — they can directly drop comment pins, reply to chat threads, and view pages in Guest Review mode.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/70">
                        <th className="py-3.5 px-5">Guest Name / Email</th>
                        <th className="py-3.5 px-5">Projects Reviewed</th>
                        <th className="py-3.5 px-5">Activity</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {guestReviewers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 px-5 text-center text-xs text-slate-400">
                            No external guests yet. Guests appear here once they leave a pin or comment through a guest review link.
                          </td>
                        </tr>
                      ) : (
                        guestReviewers.map((g) => (
                          <tr key={g.key} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-5">
                              <div className="font-bold text-slate-900">{g.name}</div>
                              {g.email && <div className="text-[11px] text-slate-500 font-mono">{g.email}</div>}
                            </td>
                            <td className="py-3.5 px-5 text-slate-700">
                              {g.projects.map((p) => (
                                <div key={p.id} className="truncate max-w-[260px]">{(p.assets?.[0]?.url || p.name).replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>
                              ))}
                            </td>
                            <td className="py-3.5 px-5 text-slate-500">
                              {g.count} {g.count === 1 ? 'comment' : 'comments'} · last {timeAgo(g.lastMs)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {g.projects[0] && (
                                <button
                                  onClick={(e) => copyGuestLinkForProject(g.projects[0].id, e)}
                                  className="p-1.5 rounded-lg border bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                >
                                  {copiedCardId === g.projects[0].id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <LinkIcon className="w-3.5 h-3.5" />}
                                  <span>{copiedCardId === g.projects[0].id ? 'Copied' : 'Copy guest link'}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ROLES & PERMISSION MATRIX SUB-TAB */}
            {teamSubTab === 'roles' && (
              <div className="space-y-6">
                
                {/* Informational Banner */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-extrabold text-indigo-950 text-sm">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Role Governance & Granular Feature Permission Matrix</span>
                    </div>
                    <span className="text-[11px] bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                      Live Enforced
                    </span>
                  </div>
                  <p className="text-xs text-indigo-900 leading-relaxed">
                    Toggle individual permissions for each role. Checkboxes under <strong>Member (Editor & Annotator)</strong> can be customized by Master Admin or Owners to grant or restrict specific feature capabilities (e.g. viewing all team QA scores).
                  </p>
                </div>

                {/* Permissions Matrix Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-700 font-bold bg-slate-50/80">
                        <th className="py-4 px-6 w-2/5">Permission Capability / Action</th>
                        <th className="py-4 px-4 text-center">👑 Master Admin</th>
                        <th className="py-4 px-4 text-center">⚡ Admin & Owner</th>
                        <th className="py-4 px-4 text-center bg-indigo-50/40 border-x border-indigo-100">
                          👤 Member (Editor)
                        </th>
                        <th className="py-4 px-4 text-center">👁️ Guest & Client</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      
                      {/* Row 1: View All Team Members' QA Scores */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>View All Team Members' QA Scores</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Allows viewing the full team QA scorecard table in QA Score Matrix. If unchecked for Members, members can only see their own score.
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center text-emerald-600 font-bold">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center text-emerald-600 font-bold">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center bg-indigo-50/20 border-x border-indigo-100">
                          <label className="inline-flex items-center gap-2 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={rolePermissions.membersCanViewAllQAScores}
                              onChange={() => handleTogglePermission('membersCanViewAllQAScores')}
                              disabled={!canEditPermissions}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {rolePermissions.membersCanViewAllQAScores ? 'Enabled (All Scores)' : 'Disabled (Self Only)'}
                            </span>
                          </label>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                          —
                        </td>
                      </tr>

                      {/* Row 2: Manage QA Rubric Rules & Weightages */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Manage & Edit QA Rubric Rules</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Add, modify, or delete deduction error rules and category weightages.
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center bg-indigo-50/20 border-x border-indigo-100">
                          <label className="inline-flex items-center gap-2 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={rolePermissions.membersCanManageRubric}
                              onChange={() => handleTogglePermission('membersCanManageRubric')}
                              disabled={!canEditPermissions}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {rolePermissions.membersCanManageRubric ? 'Allowed' : 'Restricted'}
                            </span>
                          </label>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                          —
                        </td>
                      </tr>

                      {/* Row 3: Invite New Team Members & Clients */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Invite Teammates & External Reviewers</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Generate share invite links or add guests to specific project markups.
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center bg-indigo-50/20 border-x border-indigo-100">
                          <label className="inline-flex items-center gap-2 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={rolePermissions.membersCanInvite}
                              onChange={() => handleTogglePermission('membersCanInvite')}
                              disabled={!canEditPermissions}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {rolePermissions.membersCanInvite ? 'Allowed' : 'Restricted'}
                            </span>
                          </label>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                          —
                        </td>
                      </tr>

                      {/* Row 4: Change Member Roles & Workspace Access */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Change Workspace Roles & Access Levels</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Promote or demote member access levels in the Team management table.
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center bg-indigo-50/20 border-x border-indigo-100">
                          <span className="text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Protected (Admin Only)</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                          —
                        </td>
                      </tr>

                      {/* Row 5: Delete Projects & Markups */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Delete Active Projects & Markups</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Permanently delete project cards, assets, and comment threads.
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center bg-indigo-50/20 border-x border-indigo-100">
                          <label className="inline-flex items-center gap-2 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={rolePermissions.membersCanDeleteProjects}
                              onChange={() => handleTogglePermission('membersCanDeleteProjects')}
                              disabled={!canEditPermissions}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {rolePermissions.membersCanDeleteProjects ? 'Allowed' : 'Restricted'}
                            </span>
                          </label>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                          —
                        </td>
                      </tr>

                      {/* Row 6: Archive & Restore Projects */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Archive className="w-4 h-4 text-purple-600 shrink-0" />
                            <span>Archive & Restore Projects</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Move projects between active workspace view and archive vault.
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center bg-indigo-50/20 border-x border-indigo-100">
                          <label className="inline-flex items-center gap-2 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={rolePermissions.membersCanArchiveProjects}
                              onChange={() => handleTogglePermission('membersCanArchiveProjects')}
                              disabled={!canEditPermissions}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {rolePermissions.membersCanArchiveProjects ? 'Allowed' : 'Restricted'}
                            </span>
                          </label>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                          —
                        </td>
                      </tr>

                      {/* Ask AI for WordPress Fixes */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>Ask AI for WordPress Fixes</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Use Fix with AI on pins of projects connected to WordPress. Gemini prepares a change; nothing goes live until someone allowed to apply it approves.
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center bg-indigo-50/20 border-x border-indigo-100">
                          <label className="inline-flex items-center gap-2 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={rolePermissions.membersCanUseAiFix}
                              onChange={() => handleTogglePermission('membersCanUseAiFix')}
                              disabled={!canEditPermissions}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {rolePermissions.membersCanUseAiFix ? 'Enabled' : 'Disabled'}
                            </span>
                          </label>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                          —
                        </td>
                      </tr>

                      {/* Approve, Apply & Undo AI Fixes */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Approve, Apply & Undo AI Fixes</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Make AI fixes live on the WordPress site and undo them. Every change is backed up first and recorded in the audit log.
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Check className="w-5 h-5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-4 px-4 text-center bg-indigo-50/20 border-x border-indigo-100">
                          <label className="inline-flex items-center gap-2 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={rolePermissions.membersCanApplyAiFix}
                              onChange={() => handleTogglePermission('membersCanApplyAiFix')}
                              disabled={!canEditPermissions}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {rolePermissions.membersCanApplyAiFix ? 'Allowed' : 'Restricted'}
                            </span>
                          </label>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                          —
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

              </div>
            )}

          </div>
        )}

        {/* TAB 4: SETTINGS PAGE */}
        {activeTab === 'credits' && (
          <div className="flex-1 overflow-y-auto">
            {canEditPermissions ? (
              <AiCreditsView projects={projects} canEdit={canEditPermissions} />
            ) : (
              <div className="p-8 text-sm text-slate-500">AI Credits is visible to workspace Owners and Admins.</div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="px-8 py-6 space-y-6 max-w-4xl">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workspace Settings & Governance</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage workspace branding, guest review rules, and domain-restricted seat access.
                </p>
              </div>
            </div>

            {/* SETTINGS SUB-TABS NAVIGATION */}
            <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-bold">
              <button
                onClick={() => setSettingsSubTab('details')}
                className={`pb-2.5 transition-colors relative cursor-pointer flex items-center gap-2 ${
                  settingsSubTab === 'details'
                    ? 'text-slate-900 border-b-2 border-slate-900 font-black'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4 text-slate-600" />
                <span>Workspace Details & Custom Branding</span>
              </button>

              <button
                onClick={() => setSettingsSubTab('domains')}
                className={`pb-2.5 transition-colors relative cursor-pointer flex items-center gap-2 ${
                  settingsSubTab === 'domains'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 font-black'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Access Control</span>
              </button>
            </div>

            {/* SUB-TAB 1: WORKSPACE DETAILS & BRANDING */}
            {settingsSubTab === 'details' && (
              <div className="space-y-6">
                
                {!canEditDomainAccess && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs font-medium">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>You're signed in as <strong>{currentUser.role || 'Member'}</strong>. Only workspace Owners and Admins can change these settings.</span>
                  </div>
                )}

                {/* BRANDING (saved for the whole workspace) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-2xs">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Palette className="w-4 h-4 text-blue-600" />
                      <span>Application Branding & Logo</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      The name and logo shown in the header, on the sign-in page, on guest review links and in the browser tab.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                    <label htmlFor="brand-name" className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Logo Text / App Title
                    </label>
                    <div className="md:col-span-2">
                      <input
                        id="brand-name"
                        type="text"
                        maxLength={40}
                        value={draft.appName}
                        onChange={(e) => setBrandDraft({ ...draft, appName: e.target.value })}
                        placeholder="e.g. WebReview Pro"
                        disabled={!canEditDomainAccess}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Logo Emblem</span>
                    <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
                      {['auto', '🌐', '⚡', '💎', '🛡️', '🎨', '🚀'].map((emblem) => (
                        <button
                          key={emblem}
                          type="button"
                          onClick={() => setBrandDraft({ ...draft, appIcon: emblem })}
                          disabled={!canEditDomainAccess}
                          title={emblem === 'auto' ? 'Initials of the app title' : undefined}
                          className={`h-10 min-w-10 px-2 rounded-xl font-black text-sm flex items-center justify-center transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            draft.appIcon === emblem
                              ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {emblem === 'auto' ? brandInitials(draft.appName || 'W') : emblem}
                        </button>
                      ))}
                      <span className="text-[11px] text-slate-400">The first option uses the initials of the title.</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500">Preview:</span>
                      <div className="flex items-center gap-2 font-bold text-sm bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                        <AppLogo branding={{ appName: draft.appName || 'W', appIcon: draft.appIcon }} className="w-7 h-7 text-xs" />
                        <span className="font-extrabold text-slate-900">{draft.appName || 'Untitled'}</span>
                      </div>
                    </div>
                    {canEditDomainAccess && (
                      <div className="flex items-center gap-3">
                        {brandingNote && <span className="text-[11px] text-slate-500">{brandingNote}</span>}
                        <button
                          onClick={handleSaveBranding}
                          disabled={!brandDraft || !draft.appName.trim()}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Save Branding
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* GUEST REVIEW POLICY (saved and enforced) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-2xs">
                  <div className="border-b border-slate-100 pb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-600" />
                        <span>Client Guest Review</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">How external clients use shared review links. Changes save right away.</p>
                    </div>
                    {policyNote && <span className="text-[11px] text-slate-500 shrink-0">{policyNote}</span>}
                  </div>
                  <div className="space-y-3 text-xs">
                    <label className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <div>
                        <span className="font-bold text-slate-900 block">Allow guest review links without an account</span>
                        <span className="text-slate-500 text-[11px]">Clients can open a project's share link, drop pins and comment without signing in. When off, share links stop working for guests.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={guestPolicy.guestLinksEnabled}
                        onChange={(e) => changeGuestPolicy({ guestLinksEnabled: e.target.checked })}
                        disabled={!canEditDomainAccess}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <div>
                        <span className="font-bold text-slate-900 block">Ask guests for their name</span>
                        <span className="text-slate-500 text-[11px]">Guests enter their name (and optionally email) before their first pin or comment. When off, they appear as "Guest Reviewer".</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={guestPolicy.askGuestName}
                        onChange={(e) => changeGuestPolicy({ askGuestName: e.target.checked })}
                        disabled={!canEditDomainAccess}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: DOMAIN & SEAT ACCESS CONTROL */}
            {settingsSubTab === 'domains' && (
              <div className="space-y-6">
                
                {/* ROLE EDIT PERMISSION BANNER */}
                {!canEditDomainAccess ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs font-medium">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <strong className="font-bold">Read-Only View Mode:</strong> You are signed in as <strong>{currentUser.role || 'Member'}</strong>. Only workspace Owners and Admins can change authorized domains.
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-900 text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong className="font-bold">Admin Privileges Active:</strong> You have full editing rights to add, update, or remove authorized email domains.
                      </span>
                    </div>
                    <button
                      onClick={handleResetDomainDefaults}
                      className="text-[11px] font-bold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-100 px-3 py-1 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset Standard Defaults</span>
                    </button>
                  </div>
                )}

                {/* Notifications */}
                {domainErrorMsg && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{domainErrorMsg}</span>
                  </div>
                )}

                {domainSuccessMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{domainSuccessMsg}</span>
                  </div>
                )}

                {/* Domain Control Panel Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-2xs">
                  
                  {/* Top Intro */}
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>Authorized Organization Email Domains</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Anyone with an email on these domains can create an account and joins as a <strong>Member</strong>. People outside these domains can only sign in after you invite them from the <strong>Team</strong> page. Remove every domain to make the workspace invite-only.
                    </p>
                  </div>

                  {/* Add Domain Form (Disabled if not admin) */}
                  <form onSubmit={handleAddDomain} className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                      Add Authorized Domain
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-xs">@</span>
                        <input
                          type="text"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                          placeholder="e.g. broadly.com or yourcompany.com"
                          disabled={!canEditDomainAccess}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-4 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!canEditDomainAccess || !newDomain.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Authorize Domain</span>
                      </button>
                    </div>
                  </form>

                  {/* Active Authorized Domains List */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">
                      <span>Currently Authorized Domains ({domains.length})</span>

                    </div>

                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {domains.map((dom, idx) => (
                        <div key={dom} className="p-3.5 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between transition-colors text-xs">
                          {editingIndex === idx ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <span className="font-mono text-slate-400 font-bold">@</span>
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveDomainEdit(idx)}
                                className="bg-indigo-600 text-white font-bold px-3 py-1 rounded-lg text-xs hover:bg-indigo-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingIndex(null)}
                                className="text-slate-500 hover:text-slate-700 px-2"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-mono font-bold text-slate-900">@{dom}</span>
                                {masterAdminDomains().includes(dom) && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                    Master admin domain
                                  </span>
                                )}
                              </div>

                              {canEditDomainAccess && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleStartEditDomain(idx, dom)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Edit Domain"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveDomain(dom)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Remove Domain"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Additional Domain Policy Explainer */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2 text-slate-600">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-indigo-600" />
                      <span>Security & Guest Policy Behavior</span>
                    </div>
                    <p className="leading-relaxed text-[11px]">
                      People with an email outside these domains can't create an account or sign in unless a workspace admin invites them from the <strong>Team</strong> page. Clients don't need an account: they use guest review links (see Workspace Details).
                    </p>
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>

    </div>
  );
};
