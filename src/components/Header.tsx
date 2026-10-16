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
  // WordPress connection of the open project (undefined = button hidden)
  wpStatus?: 'connected' | 'error' | 'none';
  onOpenWordPress?: () => void;
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
  wpStatus,
  onOpenWordPress,
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

  const notificationRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Click outside listener for Popovers (Notifications, User profile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotificationDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getAssetIcon = (type: Asset['type']) => {
    switch (type) {
      case 'url': return <Globe className="w-4 h-4 text-blue-500" />;
      case 'image': return <ImageIcon className="w-4 h-4 text-purple-500" />;
      case 'mockup': return <Smartphone className="w-4 h-4 text-emerald-500" />;
      default: return <Globe className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white text-slate-900 sticky top-0 z-50 shrink-0">
      <div className="w-full px-4 md:px-6 h-14 flex items-center justify-between gap-2 md:gap-4">
        
        {/* Left: Brand & All Projects Grid Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button 
            onClick={() => !isGuestMode && onViewModeChange('dashboard')}
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

          {/* Clean Navigation: All Projects Grid Button + Project Title (hidden for guests: they only see the shared project) */}
          {viewMode !== 'dashboard' && !isGuestMode && (
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

        {/* Center: View Switcher Tabs (Only shown inside studio views, not for guests) */}
        {viewMode !== 'dashboard' && !isGuestMode && (
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
          {/* Share (only inside a project, not for guests) */}
          {viewMode !== 'dashboard' && !isGuestMode && (
            <>
              {onOpenWordPress && wpStatus && (
                <button
                  onClick={onOpenWordPress}
                  className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-md transition-colors shrink-0 cursor-pointer"
                  title={wpStatus === 'connected' ? 'WordPress connected' : wpStatus === 'error' ? 'WordPress connection has a problem' : 'Connect a WordPress site'}
                >
                  <span className={`w-2 h-2 rounded-full ${wpStatus === 'connected' ? 'bg-emerald-500' : wpStatus === 'error' ? 'bg-rose-500' : 'bg-slate-300'}`} />
                  WordPress
                </button>
              )}
              <button
                onClick={onOpenShareModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-md shadow-sm transition-colors shrink-0 cursor-pointer"
              >
                Share
              </button>
            </>
          )}

          {/* Notification Bell Button & Notification Center Popover (not for guests) */}
          {!isGuestMode && (
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
          )}

          {/* User Account & Profile Dropdown (not for guests) */}
          {currentUser && !isGuestMode && (
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

      {/* Mobile / Tablet View Switcher Sub-bar (not for guests) */}
      {!isGuestMode && (
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
      )}
    </header>
  );
};
