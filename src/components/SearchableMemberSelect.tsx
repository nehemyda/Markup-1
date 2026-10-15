import React, { useState, useRef, useEffect } from 'react';
import { Teammate } from '../types';
import { UserAvatar } from './UserAvatar';
import { Search, UserCheck, Check, ChevronDown, Shield, Users, UserPlus } from 'lucide-react';

interface SearchableMemberSelectProps {
  selectedMember: Teammate | null | undefined;
  teammates: Teammate[];
  onSelect: (member: Teammate) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  compact?: boolean;
}

export const SearchableMemberSelect: React.FC<SearchableMemberSelectProps> = ({
  selectedMember,
  teammates,
  onSelect,
  placeholder = "Search 1000+ team members...",
  className = "",
  label,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'qa' | 'dev' | 'design' | 'admin'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter logic
  const filteredTeammates = teammates.filter((tm) => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = tm.name.toLowerCase().includes(q) || tm.email.toLowerCase().includes(q) || tm.role.toLowerCase().includes(q);
    if (!nameMatch) return false;

    if (roleFilter === 'qa') return tm.role === 'Reviewer' || tm.name.toLowerCase().includes('qa');
    if (roleFilter === 'dev') return tm.role === 'Developer';
    if (roleFilter === 'design') return tm.role === 'Designer';
    if (roleFilter === 'admin') return tm.role === 'Admin' || tm.role === 'Owner';
    return true;
  });

  // Dynamic custom member creation if search term is typed and no exact match exists
  const hasExactMatch = teammates.some(t => t.name.toLowerCase() === searchQuery.trim().toLowerCase());

  const handleSelectMember = (tm: Teammate) => {
    onSelect(tm);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateCustomMember = () => {
    if (!searchQuery.trim()) return;
    const customName = searchQuery.trim();
    const newMember: Teammate = {
      id: `usr_custom_${Date.now()}`,
      name: customName,
      email: `${customName.toLowerCase().replace(/\s+/g, '.')}@yourdigitalagents.com`,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(customName)}&background=6366f1&color=fff`,
      role: customName.toLowerCase().includes('qa') ? 'Reviewer' : 'Member',
      status: 'online',
      cursorColor: '#6366F1'
    };
    onSelect(newMember);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold shadow-xs transition-all cursor-pointer ${
          compact ? 'px-2 py-1' : 'px-3 py-1.5'
        } ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedMember ? (
            <>
              <UserAvatar
                name={selectedMember.name}
                email={selectedMember.email}
                avatar={selectedMember.avatar}
                status={selectedMember.status}
                size={20}
              />
              <span className="truncate font-semibold text-slate-900">{selectedMember.name}</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium border border-slate-200 shrink-0">
                {selectedMember.role}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Unassigned (Select member)</span>
            </div>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          
          {/* Top Search Input Bar */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 shadow-xs"
              />
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-1 text-[10px] font-bold overflow-x-auto pb-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  roleFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                All (1000+)
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('qa')}
                className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  roleFilter === 'qa' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                QA / Review
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('dev')}
                className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  roleFilter === 'dev' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Devs
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('design')}
                className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  roleFilter === 'design' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Design
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('admin')}
                className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  roleFilter === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          {/* Member List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-100">
            {filteredTeammates.length > 0 ? (
              filteredTeammates.map((tm) => {
                const isSelected = selectedMember?.id === tm.id;
                return (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => handleSelectMember(tm)}
                    className={`w-full text-left p-2 rounded-lg flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isSelected ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <UserAvatar
                        name={tm.name}
                        email={tm.email}
                        avatar={tm.avatar}
                        status={tm.status}
                        size={28}
                        showOnlineStatus
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <span className="truncate">{tm.name}</span>
                          <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded shrink-0 font-medium">
                            {tm.role}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{tm.email}</div>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            ) : null}

            {/* If user typed a search query that doesn't strictly match predefined list, allow instant custom selection */}
            {searchQuery.trim() && !hasExactMatch && (
              <button
                type="button"
                onClick={handleCreateCustomMember}
                className="w-full text-left p-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 flex items-center gap-2 transition-all cursor-pointer my-1"
              >
                <UserPlus className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="min-w-0 text-xs font-semibold">
                  <span>Assign to <strong>"{searchQuery.trim()}"</strong></span>
                  <span className="block text-[10px] text-indigo-700 font-normal">Add member to organization directory</span>
                </div>
              </button>
            )}

            {filteredTeammates.length === 0 && !searchQuery.trim() && (
              <div className="p-4 text-center text-xs text-slate-500">
                No members found matching filter.
              </div>
            )}
          </div>

          {/* Directory Footer Info */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between font-medium">
            <span>Showing {filteredTeammates.length} of 1,240 team members</span>
            <span className="text-indigo-600 font-bold">Directory Synced</span>
          </div>
        </div>
      )}
    </div>
  );
};
