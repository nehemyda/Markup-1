import React, { useState, useRef, useEffect } from 'react';
import { Project, ViewMode, Teammate, Asset, AuthUser, Organization, NotificationItem } from '../types';
import { UserAvatar } from './UserAvatar';
import { 
  Layers, 
  Kanban, 
  TableProperties, 
  Activity, 
  Share2, 
  Plus, 
  ChevronDown, 
  Sparkles, 
  Users, 
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Smartphone,
  Building2,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  HelpCircle,
  FileText,
  LayoutGrid,
  ArrowLeft,
  Bell,
  CheckCheck,
  AtSign,
  Search,
  UserPlus,
  X,
  Copy,
  Check,
  Award
} from 'lucide-react';

interface HeaderProps {
  appName?: string;
  appIcon?: string;
  isGuestMode?: boolean;
  onToggleGuestMode?: () => void;
  projects: Project[];
  currentProject: Project;
  onSelectProject: (project: Project) => void;
  currentAsset: Asset;
  onSelectAsset: (asset: Asset) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  teammates: Teammate[];
  isSimulatingPartner?: boolean;
  onToggleSimulatePartner?: () => void;
  onOpenNewProjectModal: () => void;
  onOpenShareModal: () => void;
  onOpenNewAssetModal: () => void;
  currentUser?: AuthUser;
  currentOrganization?: Organization;
  onSignOut?: () => void;
  onOpenDomainModal?: () => void;
  onOpenProfileSettings?: () => void;
  notifications?: NotificationItem[];
  unreadNotificationCount?: number;
  onNotificationClick?: (notification: NotificationItem) => void;
  onMarkAllNotificationsRead?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  appName = 'WebReview Pro',
  appIcon = 'W',
  isGuestMode = false,
  onToggleGuestMode,
  projects,
  currentProject,
  onSelectProject,
  currentAsset,
  onSelectAsset,
  viewMode,
  onViewModeChange,
  teammates,
  isSimulatingPartner,
  onToggleSimulatePartner,
  onOpenNewProjectModal,
  onOpenShareModal,
  onOpenNewAssetModal,
  currentUser,
  currentOrganization,
  onSignOut,
  onOpenDomainModal,
  onOpenProfileSettings,
  notifications = [],
  unreadNotificationCount = 0,
  onNotificationClick,
  onMarkAllNotificationsRead
}) => {
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  const notificationRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);

  // Click outside listener for Popovers (Notifications, User profile, Team directory)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotificationDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(target)) {
        setShowUserDropdown(false);
      }
      if (teamRef.current && !teamRef.current.contains(target)) {
        setShowTeamDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCopyEmail = (email: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  const filteredTeammates = teammates.filter((tm) => {
    const q = teamSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      tm.name.toLowerCase().includes(q) ||
      tm.email.toLowerCase().includes(q) ||
      tm.role.toLowerCase().includes(q)
    );
  });

  const getAssetIcon = (type: Asset['type']) => {
    switch (type) {
      case 'url': return <Globe className="w-4 h-4 text-blue-500" />;
      case 'image': return <ImageIcon className="w-4 h-4 text-purple-500" />;
      case 'mockup': return <Smartphone className="w-4 h-4 text-emerald-500" />;
      default: return <Globe className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white text-slate-900 sticky top-0 z-50 select-none shrink-0">
      <div className="w-full px-4 md:px-6 h-14 flex items-center justify-between gap-2 md:gap-4">
        
        {/* Left: Brand & All Projects Grid Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button 
            onClick={() => onViewModeChange('dashboard')}
            className="flex items-center gap-2 font-bold text-lg tracking-tight text-slate-900 shrink-0 hover:opacity-85 transition-opacity text-left cursor-pointer"
            title="Return to Projects Grid Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-sm shrink-0">
              {appIcon}
            </div>
            <span className="hidden md:inline whitespace-nowrap font-extrabold text-slate-900">{appName}</span>
            <span className="md:hidden whitespace-nowrap font-extrabold text-slate-900">{appName.split(' ')[0]}</span>
          </button>

          {/* Guest Mode Indicator Badge */}
          {isGuestMode && (
            <div className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-xs">
              <span>👋 Guest Client Mode</span>
              {onToggleGuestMode && (
                <button
                  onClick={onToggleGuestMode}
                  className="ml-1 text-amber-700 hover:text-amber-950 underline font-semibold cursor-pointer"
                >
                  Exit
                </button>
              )}
            </div>
          )}

          {/* Clean Navigation: All Projects Grid Button + Project Title (No bulky dropdowns) */}
          {viewMode !== 'dashboard' && (
            <>
              <div className="h-6 w-px bg-slate-200 hidden md:block" />

              {/* Quick Back to All Projects Grid Dashboard */}
              <button
                onClick={() => onViewModeChange('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer bg-slate-100 hover:bg-slate-200/80 text-slate-800 border-slate-200 shadow-2xs"
                title="Return to All Projects Grid Dashboard"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">All Projects Grid</span>
              </button>
            </>
          )}
        </div>

        {/* Center: View Switcher Tabs (Only shown inside studio views) */}
        {viewMode !== 'dashboard' && (
          <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-md border border-slate-200 shrink-0">
            <button
              onClick={() => onViewModeChange('studio')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'studio'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Canvas</span>
            </button>
            
            <button
              onClick={() => onViewModeChange('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>

            <button
              onClick={() => onViewModeChange('matrix')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>

            <button
              onClick={() => onViewModeChange('activity')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'activity'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Activity</span>
            </button>

            <button
              onClick={() => onViewModeChange('qascore')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'qascore'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:text-indigo-600 font-semibold'
              }`}
              title="View & Edit QA Rubric Rules, Error Weightages, and Project Ratings"
            >
              <Award className="w-3.5 h-3.5 text-indigo-500" />
              <span>QA Score</span>
            </button>
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Firebase Connection Status Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-lg text-xs font-bold" title="Connected to Firebase Cloud Firestore (webreview-pro)">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-[11px]">Firebase: <span className="font-extrabold text-amber-900">webreview-pro</span></span>
          </div>

          {/* Active Collaborators & Share (Only shown inside studio views) */}
          {viewMode !== 'dashboard' && (
            <>
              {/* Interactive Teammate Avatars Stack */}
              <div ref={teamRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowTeamDropdown(!showTeamDropdown);
                    setShowNotificationDropdown(false);
                    setShowUserDropdown(false);
                  }}
                  className="hidden sm:flex items-center -space-x-2 overflow-hidden mr-1 p-1 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer group"
                  title="Click to view Active Team Members & Directory"
                >
                  {teammates.slice(0, 4).map((tm) => (
                    <div
                      key={tm.id}
                      className="relative inline-block w-8 h-8 rounded-full border-2 border-white overflow-hidden shadow-xs group-hover:scale-105 transition-transform shrink-0"
                    >
                      <img src={tm.avatar} alt={tm.name} className="w-full h-full object-cover" />
                      <span 
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                          tm.status === 'online' ? 'bg-emerald-500' : tm.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'
                        }`}
                      />
                    </div>
                  ))}
                  {teammates.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 border-2 border-white flex items-center justify-center text-[10px] font-extrabold shadow-xs">
                      +{teammates.length - 4}
                    </div>
                  )}
                </button>

                {/* Team Collaborators Directory Popover */}
                {showTeamDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 text-slate-900">
                    
                    {/* Popover Header */}
                    <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <div>
                          <div className="text-xs font-extrabold text-white">Team Directory & Online Presence</div>
                          <div className="text-[10px] text-slate-400">1,240 Total Members • 4 Active Now</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowTeamDropdown(false)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="p-2.5 bg-slate-50 border-b border-slate-200">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={teamSearchQuery}
                          onChange={(e) => setTeamSearchQuery(e.target.value)}
                          placeholder="Search 1000+ members by name, email, role..."
                          className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Member List */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
                      {filteredTeammates.length > 0 ? (
                        filteredTeammates.map((tm) => (
                          <div
                            key={tm.id}
                            className="p-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors group/item"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="relative shrink-0">
                                <img
                                  src={tm.avatar}
                                  alt={tm.name}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                />
                                <span
                                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                                    tm.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                                  <span className="truncate">{tm.name}</span>
                                  <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                                    {tm.role}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">{tm.email}</div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleCopyEmail(tm.email, tm.id, e)}
                              className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Copy Email Address"
                            >
                              {copiedEmailId === tm.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover/item:text-slate-700" />
                              )}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No team members found matching "{teamSearchQuery}".
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Showing {filteredTeammates.length} members
                      </span>
                      <button
                        onClick={() => {
                          setShowTeamDropdown(false);
                          onOpenShareModal();
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Invite Teammates</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>

              <button
                onClick={onOpenShareModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-md shadow-sm transition-colors shrink-0 cursor-pointer"
              >
                Share
              </button>
            </>
          )}

          {/* Notification Bell Button & Notification Center Popover */}
          <div ref={notificationRef} className="relative shrink-0">
            <button
              onClick={() => {
                setShowNotificationDropdown(!showNotificationDropdown);
                setShowUserDropdown(false);
                setShowProjectDropdown(false);
                setShowAssetDropdown(false);
              }}
              className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Notification Center & Tagged Teammates"
            >
              <Bell className="w-4 h-4 text-slate-700" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center animate-pulse border-2 border-white">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {showNotificationDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-900">
                <div className="px-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    <span>Notifications & @Mention Alerts</span>
                  </div>
                  {unreadNotificationCount > 0 && (
                    <button
                      onClick={onMarkAllNotificationsRead}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                <div className="mx-3 my-2 p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-900 leading-relaxed">
                  <strong className="block text-indigo-700 font-bold mb-0.5">📧 How team members are notified:</strong>
                  When you tag members with <strong>@Name</strong> or assign pins, tagged people instantly receive in-app popups, push alerts & email notifications.
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications && notifications.length > 0 ? (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (onNotificationClick) onNotificationClick(n);
                          setShowNotificationDropdown(false);
                        }}
                        className={`w-full text-left p-2.5 flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                          !n.isRead ? 'bg-indigo-50/50' : ''
                        }`}
                      >
                        <img src={n.sender.avatar} alt={n.sender.name} className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 flex items-center justify-between gap-1">
                            <span className="truncate">{n.title}</span>
                            <span className="text-[9px] text-slate-400 shrink-0 font-medium">{n.timestamp}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                            {n.message}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No unread notifications. Tag team members with @mentions in comments to alert them!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account & Profile Dropdown */}
          {currentUser && (
            <div ref={userRef} className="relative shrink-0">
              <button
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowProjectDropdown(false);
                  setShowAssetDropdown(false);
                }}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
              >
                <UserAvatar
                  name={currentUser.name}
                  email={currentUser.email}
                  avatar={currentUser.avatar}
                  status={currentUser.status}
                  size="xs"
                  showOnlineStatus
                  showGoogleBadge
                />
                <span className="hidden md:inline text-xs font-bold text-slate-900">
                  {currentUser.name.split(' ')[0]} {currentUser.name.split(' ')[1]?.[0]}...
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserDropdown && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-900">
                  
                  {/* User Profile Header */}
                  <div className="px-4 pb-3 border-b border-slate-100 flex items-center gap-3">
                    <UserAvatar
                      name={currentUser.name}
                      email={currentUser.email}
                      avatar={currentUser.avatar}
                      status={currentUser.status}
                      size="md"
                      showOnlineStatus
                      showGoogleBadge
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</div>
                      <div className="text-xs text-slate-500 font-mono truncate">{currentUser.email}</div>
                      <div className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-[10px] font-bold text-indigo-700">
                        {currentUser.role}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 px-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        if (onOpenProfileSettings) {
                          onOpenProfileSettings();
                        }
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-indigo-600" />
                      <span>Profile Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        if (onSignOut) onSignOut();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out / Switch Account</span>
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Mobile / Tablet View Switcher Sub-bar */}
      <div className="lg:hidden flex items-center overflow-x-auto whitespace-nowrap px-3 py-1.5 gap-1.5 border-t border-slate-200 bg-white text-xs font-medium text-slate-700 scrollbar-none justify-start sm:justify-center">
        <button
          onClick={() => onViewModeChange('studio')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md shrink-0 cursor-pointer ${
            viewMode === 'studio' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Canvas
        </button>
        <button
          onClick={() => onViewModeChange('kanban')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md shrink-0 cursor-pointer ${
            viewMode === 'kanban' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Kanban className="w-3.5 h-3.5" /> Kanban
        </button>
        <button
          onClick={() => onViewModeChange('matrix')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md shrink-0 cursor-pointer ${
            viewMode === 'matrix' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TableProperties className="w-3.5 h-3.5" /> Table
        </button>
        <button
          onClick={() => onViewModeChange('activity')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md shrink-0 cursor-pointer ${
            viewMode === 'activity' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Activity
        </button>
        <button
          onClick={() => onViewModeChange('qascore')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md shrink-0 cursor-pointer ${
            viewMode === 'qascore' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" /> QA Score
        </button>
      </div>
    </header>
  );
};
