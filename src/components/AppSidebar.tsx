import React, { useState } from 'react';
import { LayoutGrid, Archive, Users, Award, Coins, Settings, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export type SidebarItem = 'dashboard' | 'archive' | 'team' | 'qascore' | 'credits' | 'settings';

// Name of a menu item, shown next to its icon when the menu is collapsed (on hover or keyboard focus)
const SidebarTooltip: React.FC<{ text: string }> = ({ text }) => (
  <span
    role="tooltip"
    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lg opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition-all duration-150 z-50"
  >
    {text}
    <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
  </span>
);

interface AppSidebarProps {
  active: SidebarItem;
  onNavigate: (item: SidebarItem) => void;
  // AI Credits shows usage and cost: Owners and Admins only
  showCredits: boolean;
  projectCount: number;
  openPinCount: number;
}

// The left menu on every workspace page (dashboard, archive, team, QA scores, AI credits, settings).
// Collapsed to icons by default; expanding is remembered per browser.
export const AppSidebar: React.FC<AppSidebarProps> = ({ active, onNavigate, showCredits, projectCount, openPinCount }) => {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('mf_sidebar_collapsed') !== '0';
    } catch (e) {
      return true;
    }
  });
  const toggle = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem('mf_sidebar_collapsed', prev ? '0' : '1');
      } catch (e) {}
      return !prev;
    });
  };

  const items: Array<{ id: SidebarItem; label: string; icon: React.ReactNode; badge?: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="w-4 h-4 text-slate-700 shrink-0" /> },
    { id: 'archive', label: 'Archive', icon: <Archive className="w-4 h-4 text-slate-700 shrink-0" /> },
    { id: 'team', label: 'Team', icon: <Users className="w-4 h-4 text-slate-700 shrink-0" /> },
    {
      id: 'qascore',
      label: 'QA Score Matrix',
      icon: <Award className="w-4 h-4 text-indigo-600 shrink-0" />,
      badge: <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded">NEW</span>,
    },
    ...(showCredits ? [{ id: 'credits' as const, label: 'AI Credits', icon: <Coins className="w-4 h-4 text-amber-500 shrink-0" /> }] : []),
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4 text-slate-700 shrink-0" /> },
  ];

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-white border-r border-slate-200 flex-col justify-between shrink-0 hidden md:flex transition-[width] duration-200`}>
      <div className={`${collapsed ? 'px-2' : 'px-4'} py-4`}>
        <nav className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={active === item.id ? 'page' : undefined}
              className={`relative group w-full flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                active === item.id ? 'bg-slate-200/90 text-slate-900 shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                {item.icon}
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>
              {!collapsed && item.badge}
              {collapsed && <SidebarTooltip text={item.label} />}
            </button>
          ))}
        </nav>
      </div>

      <div className={`${collapsed ? 'px-2' : 'px-4'} pb-4 space-y-3`}>
        {/* Workspace counts (real numbers) */}
        {collapsed ? (
          <div className="space-y-1">
            <div className="relative group flex flex-col items-center py-1.5 rounded-lg text-slate-500">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold text-slate-900">{projectCount}</span>
              <SidebarTooltip text={`${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`} />
            </div>
            <div className="relative group flex flex-col items-center py-1.5 rounded-lg text-slate-500">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold text-slate-900">{openPinCount}</span>
              <SidebarTooltip text={`${openPinCount} open feedback ${openPinCount === 1 ? 'pin' : 'pins'}`} />
            </div>
          </div>
        ) : (
          <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workspace</div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Projects</span>
              <span className="font-bold text-slate-900">{projectCount}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Open feedback pins</span>
              <span className="font-bold text-slate-900">{openPinCount}</span>
            </div>
          </div>
        )}

        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          className={`relative group w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2 px-3.5'} py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer`}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span>Collapse menu</span>}
          {collapsed && <SidebarTooltip text="Expand menu" />}
        </button>
      </div>
    </aside>
  );
};

// Open feedback pins across the workspace's projects (the count shown in the menu)
export function countOpenPins(projects: { assets?: { id: string }[] }[], pins: { assetId: string; status: string }[]) {
  const assetIds = new Set(projects.flatMap((p) => (p.assets || []).map((a) => a.id)));
  return pins.filter((p) => assetIds.has(p.assetId) && p.status !== 'resolved' && p.status !== 'archived').length;
}
