import React, { useState } from 'react';
import { Project, Asset, Teammate, ViewMode, Pin } from '../types';
import { projectUrl } from '../lib/routes';
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
  X
} from 'lucide-react';

interface ProjectsGridViewProps {
  appName?: string;
  appIcon?: string;
  onUpdateBranding?: (newName: string, newIcon: string) => void;
  projects: Project[];
  pins?: Pin[];
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
  onRestoreProject?: (item: typeof ARCHIVED_PROJECTS[0]) => void;
  initialTab?: 'dashboard' | 'archive' | 'team' | 'settings';
  onTabChange?: (tab: 'dashboard' | 'archive' | 'team' | 'settings') => void;
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
  onRestoreProject,
  initialTab,
  onTabChange,
  onSettingsSubTabChange,
  initialSettingsSubTab
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'archive' | 'team' | 'settings'>(initialTab || 'dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState<'details' | 'domains'>(initialSettingsSubTab || 'details');

  const handleTabClick = (tab: 'dashboard' | 'archive' | 'team' | 'settings') => {
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
  const isMasterAdmin = currentUser.email === 'nehemiahc@yourdigitalagents.com' || currentUser.id === 'usr_nehemiah' || currentUser.role === 'Owner';
  const canEditDomainAccess = isMasterAdmin || currentUser.role === 'Admin';

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
  const [urlInput, setUrlInput] = useState('');
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);
  
  // Team tab state
  const [teamSubTab, setTeamSubTab] = useState<'members' | 'guests' | 'roles'>('members');

  // Role Permissions Matrix State
  const [rolePermissions, setRolePermissions] = useState<{
    membersCanViewAllQAScores: boolean;
    membersCanManageRubric: boolean;
    membersCanInvite: boolean;
    membersCanManageRoles: boolean;
    membersCanDeleteProjects: boolean;
    membersCanArchiveProjects: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('webreview_role_permissions_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      membersCanViewAllQAScores: false,
      membersCanManageRubric: false,
      membersCanInvite: true,
      membersCanManageRoles: false,
      membersCanDeleteProjects: false,
      membersCanArchiveProjects: true
    };
  });

  const handleTogglePermission = (key: keyof typeof rolePermissions) => {
    const updated = { ...rolePermissions, [key]: !rolePermissions[key] };
    setRolePermissions(updated);
    localStorage.setItem('webreview_role_permissions_v1', JSON.stringify(updated));
  };

  // Open pins across all projects in the workspace
  const openPinCount = React.useMemo(() => {
    const assetIds = new Set(projects.flatMap((p) => (p.assets || []).map((a) => a.id)));
    return pins.filter((p) => assetIds.has(p.assetId) && p.status !== 'resolved' && p.status !== 'archived').length;
  }, [projects, pins]);

  // Branding & Settings state
  const [customLogoText, setCustomLogoText] = useState(appName);
  const [customLogoIcon, setCustomLogoIcon] = useState(appIcon);
  const [workspaceUrl, setWorkspaceUrl] = useState('EB858DB0D1');
  const [isSavedBranding, setIsSavedBranding] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);

  // Settings Toggles State
  const [allowGuestNoLogin, setAllowGuestNoLogin] = useState(true);
  const [requireGuestName, setRequireGuestName] = useState(true);
  const [notifyOnGuestFeedback, setNotifyOnGuestFeedback] = useState(true);

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
  const [gridColumns, setGridColumns] = useState<number>(4); // 2, 3, 4, 5 columns
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

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    
    let formattedUrl = urlInput.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    onAddNewUrlAsset(formattedUrl);
    setUrlInput('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    let target = searchQuery.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.includes('.')) {
        target = 'https://' + target;
      } else {
        target = `https://${target.toLowerCase().replace(/[^a-z0-9]/g, '-')}.com`;
      }
    }

    onAddNewUrlAsset(target);
    setSearchQuery('');
  };

  const handleSaveBranding = () => {
    if (onUpdateBranding) {
      onUpdateBranding(customLogoText, customLogoIcon);
    }
    setIsSavedBranding(true);
    setTimeout(() => setIsSavedBranding(false), 2500);
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
  const filteredProjects = React.useMemo(() => {
    return projects
      .filter((project) => {
        const matchesSearch = searchQuery === '' || 
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.assets.some(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.url.toLowerCase().includes(searchQuery.toLowerCase()));

        if (filterOwner === 'mine') {
          return matchesSearch && (project.ownerId === currentUser.id || project.name.toLowerCase().includes('agent') || project.name.toLowerCase().includes('my'));
        } else if (filterOwner !== 'all') {
          return matchesSearch && project.ownerId === filterOwner;
        }

        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'comments') {
          const countA = a.assets.reduce((acc, asset) => acc + (asset.pinCount || 0), 0);
          const countB = b.assets.reduce((acc, asset) => acc + (asset.pinCount || 0), 0);
          return countB - countA;
        }
        if (sortBy === 'oldest') return a.id.localeCompare(b.id);
        return b.id.localeCompare(a.id);
      });
  }, [projects, searchQuery, filterOwner, sortBy, currentUser]);

  return (
    <div className="flex-1 min-w-0 flex bg-slate-100/70 text-slate-900 overflow-hidden h-[calc(100vh-3.5rem)]">
      
      {/* LEFT MARKUP.IO STYLE SIDEBAR */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 hidden md:flex">
        
        <div className="p-4 space-y-4">
          
          {/* Navigation Items */}
          <nav className="space-y-1">
            <button
              onClick={() => handleTabClick('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-slate-200/90 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-slate-700" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleTabClick('archive')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-slate-200/90 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Archive className="w-4 h-4 text-slate-700" />
              <span>Archive</span>
            </button>

            <button
              onClick={() => handleTabClick('team')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'team'
                  ? 'bg-slate-200/90 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-slate-700" />
              <span>Team</span>
            </button>

            <button
              onClick={() => onViewModeChange('qascore')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-all cursor-pointer group"
              title="View QA Score Matrix, Error Weightage Rubric & Project Ratings"
            >
              <div className="flex items-center gap-3">
                <Award className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>QA Score Matrix</span>
              </div>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded">
                NEW
              </span>
            </button>

            <button
              onClick={() => handleTabClick('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-slate-200/90 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-700" />
              <span>Settings</span>
            </button>
          </nav>

        </div>

        {/* BOTTOM SIDEBAR STATS CARD (real counts, no limits) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Workspace
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Projects</span>
              <span className="font-bold text-slate-900">{projects.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Open feedback pins</span>
              <span className="font-bold text-slate-900">{openPinCount}</span>
            </div>
          </div>
        </div>

      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        
        {/* TAB 1: DASHBOARD (PROJECTS GRID VIEW) */}
        {activeTab === 'dashboard' && (
          <>
            {/* TOP BAR WITH URL ENTERER & SEARCH */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-10 shadow-2xs">
              
              {/* URL Input Bar */}
              <form onSubmit={handleUrlSubmit} className="w-full md:w-auto flex-1 max-w-2xl flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 text-blue-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Enter any live website URL (e.g. example.com) to create project..."
                    className="w-full bg-slate-50 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-2xs font-medium"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2 rounded-xl transition-all shadow-2xs shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Project</span>
                </button>
              </form>

              {/* Search & Action Controls */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <form onSubmit={handleSearchSubmit} className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search or enter URL + Enter..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all"
                  />
                </form>

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>{appName} Workspace</span>
                    <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      {filteredProjects.length} Projects
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any thumbnail or project card to open live studio annotation.
                  </p>
                </div>

                {/* Owner Filter Pills */}
                <div className="flex items-center gap-2">
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
                      setGridColumns(prev => prev === 4 ? 3 : prev === 3 ? 5 : 4);
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
                {filteredProjects.length === 0 && searchQuery && (
                  <div className="col-span-full bg-blue-50/80 border-2 border-dashed border-blue-300 rounded-3xl p-8 text-center space-y-4 my-2">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto text-2xl shadow-md">
                      🌐
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        No project found matching "{searchQuery}"
                      </h3>
                      <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                        Would you like to automatically create a new project and open studio for <strong className="text-blue-700">{searchQuery}</strong>?
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        let target = searchQuery.trim();
                        if (!target.startsWith('http://') && !target.startsWith('https://')) {
                          if (target.includes('.')) {
                            target = 'https://' + target;
                          } else {
                            target = `https://${target.toLowerCase().replace(/[^a-z0-9]/g, '-')}.com`;
                          }
                        }
                        onAddNewUrlAsset(target);
                        setSearchQuery('');
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Project & Annotate "{searchQuery}"</span>
                    </button>
                  </div>
                )}

                {filteredProjects.map((project) => {
                  const primaryAsset = project.assets[0] || {
                    id: 'asset_placeholder',
                    title: project.name,
                    type: 'url',
                    url: 'https://example.com',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
                    pinCount: 3,
                    resolvedCount: 1
                  };

                  const totalResolved = project.assets.reduce((acc, a) => acc + (a.resolvedCount || 0), 0);
                  const totalUnresolved = project.assets.reduce((acc, a) => acc + (a.pinCount || 0), 0);

                  const owner = teammates.find(t => t.id === project.ownerId) || {
                    id: 'usr_nehemiah',
                    name: 'Nehemiah',
                    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                  };

                  return (
                    <div
                      key={project.id}
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
                      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                        <span className="bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                          New
                        </span>
                      </div>

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
                            {onDeleteProject && (() => {
                              const isOwnerOrAdmin = currentUser.role === 'Admin' || currentUser.role === 'Owner' || currentUser.email === 'nehemiahc@yourdigitalagents.com' || currentUser.id === 'usr_nehemiah';
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
                            <span>Updated {project.lastUpdated || 'recently'}</span>
                          </div>
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

                          <div className="flex items-center gap-1.5" title={`Created by ${owner.name}`}>
                            <img
                              src={owner.avatar}
                              alt={owner.name}
                              className="w-5 h-5 rounded-full object-cover border border-slate-200"
                            />
                            <span className="text-[11px] font-medium text-slate-500 max-w-[80px] truncate">
                              {owner.name.split(' ')[0]}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}

                {/* CREATE NEW MARKUP BUTTON */}
                <div
                  onClick={onOpenNewProjectModal}
                  className="bg-slate-50/80 hover:bg-slate-100/90 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 min-h-[220px] flex flex-col items-center justify-center text-center group cursor-pointer transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all shadow-2xs mb-3">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">
                    Create New Project
                  </h3>
                  <p className="text-xs text-slate-500 max-w-[200px] mt-1">
                    Enter a live website URL or upload an image mockup to start commenting.
                  </p>
                </div>
              </div>
            </div>
          </>
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
                onClick={() => onOpenShareModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Invite Teammate / Client</span>
              </button>
            </div>

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
                Workspace Members ({teammates.length})
              </button>
              <button
                onClick={() => setTeamSubTab('guests')}
                className={`pb-2.5 transition-colors relative cursor-pointer shrink-0 ${
                  teamSubTab === 'guests'
                    ? 'text-slate-900 border-b-2 border-slate-900 font-black'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                External Guests & Clients (0)
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
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
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
                      const isCurrentUserMasterAdmin = currentUser.email === 'nehemiahc@yourdigitalagents.com' || currentUser.id === 'usr_nehemiah';
                      const isCurrentUserAdminOrOwner = isCurrentUserMasterAdmin || currentUser.role === 'Admin' || currentUser.role === 'Owner';
                      const isSelf = tm.id === currentUser.id || tm.email.toLowerCase() === currentUser.email.toLowerCase();
                      const canEditThisMemberRole = isCurrentUserAdminOrOwner && (!isSelf || isCurrentUserMasterAdmin);

                      const isTeammateCreator = tm.createdBy === currentUser.id || tm.createdBy === currentUser.email;
                      const isTargetMasterAdmin = tm.email === 'nehemiahc@yourdigitalagents.com' || tm.id === 'usr_nehemiah';
                      const canRemoveThisTeammate = !isSelf && !isTargetMasterAdmin && (isCurrentUserAdminOrOwner || isTeammateCreator);

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
                              {tm.lastActive === 'Invitation pending' && (
                                <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                                  Invitation pending
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-slate-600 font-mono text-[11px]">
                            {tm.email}
                          </td>
                          <td className="py-3.5 px-5">
                            {/* PROTECTED MASTER ADMIN BADGE VS ROLE DROPDOWN VS LOCKED BADGE FOR MEMBERS */}
                            {tm.email === 'nehemiahc@yourdigitalagents.com' || tm.id === 'usr_nehemiah' ? (
                              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300/80 px-3 py-1.5 rounded-lg text-xs font-black shadow-2xs">
                                <span>👑 Master Admin (Primary Owner)</span>
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
                                <option value="Member">Member (Editor & Annotator)</option>
                                <option value="Admin">Admin (User Management)</option>
                                <option value="Owner">Owner (Full Admin Access)</option>
                                <option value="Guest">Guest (Comment-Only)</option>
                              </select>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-200/80 px-3 py-1.5 rounded-lg text-xs font-bold cursor-not-allowed"
                                title={isSelf ? "Members cannot change their own role." : "Only Admins can change member roles."}
                              >
                                <span>{tm.role === 'Member' ? 'Member (Editor & Annotator)' : tm.role}</span>
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
                            {!isSelf && !isTargetMasterAdmin && (
                              <button
                                onClick={() => {
                                  if (!canRemoveThisTeammate) {
                                    alert("Permission Denied: Members can only remove teammates they invited or created.");
                                    return;
                                  }
                                  if (window.confirm(`Are you sure you want to remove ${tm.name} from the workspace?`)) {
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
                                <span>Remove</span>
                                {!canRemoveThisTeammate && <Lock className="w-3 h-3 text-slate-400" />}
                              </button>
                            )}
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
                        <th className="py-3.5 px-5">Shared Markup Project</th>
                        <th className="py-3.5 px-5">Share Link</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td colSpan={5} className="py-10 px-5 text-center text-xs text-slate-400">
                          No external guests yet. Guests appear here once they review a project through a Guest Share Link.
                        </td>
                      </tr>
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

                    </tbody>
                  </table>
                </div>

              </div>
            )}

          </div>
        )}

        {/* TAB 4: SETTINGS PAGE */}
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
                
                {/* MASTER ADMIN PERMISSION LOCK NOTICE BOX */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-blue-400">
                      <ShieldAlert className="w-4 h-4" />
                      <span>🔒 Master Admin Access Privilege</span>
                    </div>
                    <span className="bg-blue-600/30 text-blue-300 font-mono text-[10px] px-2.5 py-0.5 rounded-full border border-blue-500/30 font-bold">
                      Master Admin: Nehemiah C.
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">
                    Only Master Admin accounts (<strong>nehemiahc@yourdigitalagents.com</strong>) have authorization to update global branding, logo icon text, and workspace access policies.
                  </p>
                </div>

                {/* BRANDING & LOGO CUSTOMIZATION PANEL */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-2xs">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Palette className="w-4 h-4 text-blue-600" />
                      <span>Application Branding & Logo Customization</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Update the application title and emblem shown in the top navigation header and client share links.
                    </p>
                  </div>

                  {/* Logo Text Input */}
                  <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Logo Text / App Title
                    </label>
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        value={customLogoText}
                        onChange={(e) => setCustomLogoText(e.target.value)}
                        placeholder="e.g. WebReview Pro"
                        disabled={!isMasterAdmin}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Logo Icon / Emblem Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Logo Emblem Icon
                    </label>
                    <div className="md:col-span-2 flex items-center gap-2">
                      {['W', '🌐', '⚡', '💎', '🛡️', '🎨', '🚀'].map((emblem) => (
                        <button
                          key={emblem}
                          type="button"
                          onClick={() => setCustomLogoIcon(emblem)}
                          disabled={!isMasterAdmin}
                          className={`w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            customLogoIcon === emblem
                              ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {emblem}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Header Preview & Save */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500">Live Header Preview:</span>
                      <div className="flex items-center gap-2 font-bold text-sm bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                        <div className="w-6 h-6 rounded bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                          {customLogoIcon}
                        </div>
                        <span className="font-extrabold text-slate-900">{customLogoText}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveBranding}
                      disabled={!isMasterAdmin}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavedBranding ? '✅ Branding Saved!' : 'Save Branding Changes'}
                    </button>
                  </div>

                </div>

                {/* GUEST ACCESS & SECURITY SETTINGS PANEL */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-2xs">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      <span>Client Guest Review & Security Policy</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Control how external clients interact with shared markups.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs">
                    <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <div>
                        <span className="font-bold text-slate-900 block">Allow Guest Commenting Without Workspace Login</span>
                        <span className="text-slate-500 text-[11px]">External clients can view and leave feedback pins directly via Guest Share Links.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowGuestNoLogin}
                        onChange={(e) => setAllowGuestNoLogin(e.target.checked)}
                        disabled={!canEditDomainAccess}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <div>
                        <span className="font-bold text-slate-900 block">Prompt Guest for Display Name</span>
                        <span className="text-slate-500 text-[11px]">Ask guest reviewers for their name/organization when posting their first comment.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={requireGuestName}
                        onChange={(e) => setRequireGuestName(e.target.checked)}
                        disabled={!canEditDomainAccess}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <div>
                        <span className="font-bold text-slate-900 block">Instant Email Notifications on Guest Feedback</span>
                        <span className="text-slate-500 text-[11px]">Notify project owners instantly whenever an external guest leaves a comment.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifyOnGuestFeedback}
                        onChange={(e) => setNotifyOnGuestFeedback(e.target.checked)}
                        disabled={!canEditDomainAccess}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </label>
                  </div>
                </div>

                {/* NOTIFICATIONS & INTEGRATIONS PANEL */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-600" />
                      <span>Notification Digests & Integrations</span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Email Digest Frequency</label>
                      <select className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                        <option value="instant">Instant Real-Time Alerts</option>
                        <option value="hourly">Hourly Summary Digest</option>
                        <option value="daily">Daily Morning Digest</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Slack Webhook Channel URL</label>
                      <input
                        type="text"
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono"
                      />
                    </div>
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
                      <strong className="font-bold">Read-Only View Mode:</strong> You are currently logged in as <strong>{currentUser.role || 'Member'}</strong>. Only Master Admin (Nehemiah C.) and Workspace Admins can edit authorized domain policies.
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
                                {dom === 'yourdigitalagents.com' && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                    Primary Master Admin Domain
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
                      Users attempting to log in with email addresses outside authorized domains will default to <strong>Guest (Comment-Only)</strong> access mode unless individually promoted by a Workspace Admin in the <strong>Team Management</strong> tab.
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
