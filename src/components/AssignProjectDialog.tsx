import React, { useMemo, useState } from 'react';
import { Bell, Check, Search, X } from 'lucide-react';
import { Project, Teammate } from '../types';
import { UserAvatar } from './UserAvatar';

interface AssignProjectDialogProps {
  project: Project;
  teammates: Teammate[];
  onSave: (assigneeIds: string[]) => void;
  onClose: () => void;
}

// Rows shown at once (the search finds the rest)
const MAX_SHOWN = 50;

// Team members who can be assigned (signed up; not guests or pending invites)
export function assignableTeammates(teammates: Teammate[]) {
  return teammates.filter((t) => !t.pendingInvite && t.role !== 'Guest' && t.role !== 'Client');
}

// The people told about new client feedback on a project: its assigned developers, or its creator when none
export function projectAssignees(project: Project, teammates: Teammate[]) {
  const ids = project.assigneeIds?.length ? project.assigneeIds : project.ownerId ? [project.ownerId] : [];
  return ids.map((id) => teammates.find((t) => t.id === id)).filter(Boolean) as Teammate[];
}

// Choose which developers a project is assigned to. They get a notification when a client adds a pin or replies.
export const AssignProjectDialog: React.FC<AssignProjectDialogProps> = ({ project, teammates, onSave, onClose }) => {
  const people = useMemo(() => assignableTeammates(teammates).sort((a, b) => a.name.localeCompare(b.name)), [teammates]);
  const [selected, setSelected] = useState<string[]>(() => projectAssignees(project, teammates).map((t) => t.id));
  const [search, setSearch] = useState('');
  // Large teams (hundreds of people): assigned people first, then matches for the search, a limited number at a time
  const term = search.trim().toLowerCase();
  const matches = term
    ? people.filter((t) => `${t.name} ${t.email} ${t.department || ''} ${t.role}`.toLowerCase().includes(term))
    : people;
  const ordered = [...matches.filter((t) => selected.includes(t.id)), ...matches.filter((t) => !selected.includes(t.id))];
  const shown = ordered.slice(0, MAX_SHOWN);
  const creator = teammates.find((t) => t.id === project.ownerId);
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(selected);
          onClose();
        }}
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-extrabold text-base text-slate-900">Assign developers</h2>
            <p className="text-xs text-slate-500 truncate" title={project.name}>{project.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
          <Bell className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            Assigned people are notified when a client adds a pin or replies on this project.
            {' '}With nobody assigned, {creator ? creator.name : 'the project creator'} is notified.
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              // Enter picks the only match instead of saving
              if (e.key === 'Enter') {
                e.preventDefault();
                if (term && matches.length === 1) {
                  toggle(matches[0].id);
                  setSearch('');
                }
              }
            }}
            placeholder={`Search ${people.length} team members by name or email...`}
            aria-label="Search team members"
            className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="max-h-72 overflow-y-auto -mx-2 px-2 space-y-1">
          {shown.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                aria-pressed={on}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  on ? 'border-indigo-300 bg-indigo-50/60' : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <UserAvatar name={t.name} email={t.email} avatar={t.avatar} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 truncate">
                    {t.name}
                    {t.id === project.ownerId && <span className="ml-1.5 text-[10px] font-semibold text-slate-400">Creator</span>}
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">{t.email}</span>
                </span>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                  {on && <Check className="w-3 h-3 text-white" />}
                </span>
              </button>
            );
          })}
          {shown.length === 0 && <div className="py-6 text-center text-xs text-slate-500">No team members match "{search.trim()}".</div>}
          {ordered.length > shown.length && (
            <div className="py-2 text-center text-[11px] text-slate-500">
              Showing {shown.length} of {ordered.length}. Type a name or email to find others.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-500">{selected.length ? `${selected.length} assigned` : 'Nobody assigned'}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
