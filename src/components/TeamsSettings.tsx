// Settings → Teams: admins group people into teams (Manager, Team Lead, developers). While a developer is out of
// office their notifications also go to their Team Lead, and to the Manager when the lead is out (server/teams.ts).
// Also lists who is out of office now; admins can switch it for someone who forgot.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plane, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { Team, Teammate } from '../types';
import { deleteTeam, isAwayNow, saveTeam, setOutOfOffice, subscribeTeams } from '../lib/supabaseSync';
import { assignableTeammates } from './AssignProjectDialog';
import { SearchableMemberSelect } from './SearchableMemberSelect';
import { UserAvatar } from './UserAvatar';

const MAX_SHOWN = 50;

const AwayBadge: React.FC<{ person?: Teammate }> = ({ person }) =>
  isAwayNow(person) ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
      <Plane className="w-3 h-3" /> Out of office{person?.outOfOfficeUntil ? ` until ${new Date(person.outOfOfficeUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
    </span>
  ) : null;

const Person: React.FC<{ person?: Teammate; label: string }> = ({ person, label }) => (
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-20 shrink-0">{label}</span>
    {person ? (
      <>
        <UserAvatar name={person.name} email={person.email} avatar={person.avatar} size={22} />
        <span className="font-semibold text-slate-800 truncate">{person.name}</span>
        <AwayBadge person={person} />
      </>
    ) : (
      <span className="text-slate-400 italic">Not set</span>
    )}
  </div>
);

const TeamForm: React.FC<{ team: Team; people: Teammate[]; onSave: (team: Team) => Promise<void>; onClose: () => void }> = ({ team, people, onSave, onClose }) => {
  const [draft, setDraft] = useState<Team>(team);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const byId = (id?: string | null) => people.find((p) => p.id === id);
  const term = search.trim().toLowerCase();
  const matches = term ? people.filter((p) => `${p.name} ${p.email} ${p.department || ''}`.toLowerCase().includes(term)) : people;
  const ordered = [...matches.filter((p) => draft.memberIds.includes(p.id)), ...matches.filter((p) => !draft.memberIds.includes(p.id))];
  const toggle = (id: string) =>
    setDraft((d) => ({ ...d, memberIds: d.memberIds.includes(id) ? d.memberIds.filter((x) => x !== id) : [...d.memberIds, id] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return setError('Give the team a name.');
    if (!draft.leadId) return setError('Choose the Team Lead.');
    setSaving(true);
    try {
      await onSave({ ...draft, name: draft.name.trim(), memberIds: draft.memberIds.filter((id) => id !== draft.leadId && id !== draft.managerId) });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save the team.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-sm">
        <div className="flex items-start justify-between">
          <h2 className="font-extrabold text-base text-slate-900">{team.name ? 'Edit team' : 'New team'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <label className="block">
          <span className="text-xs font-bold text-slate-600">Team name</span>
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Web Team A"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs font-bold text-slate-600">Manager</span>
            <SearchableMemberSelect compact selectedMember={byId(draft.managerId)} teammates={people} onSelect={(m) => setDraft({ ...draft, managerId: m.id })} placeholder="Choose manager" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-600">Team Lead</span>
            <SearchableMemberSelect compact selectedMember={byId(draft.leadId)} teammates={people} onSelect={(m) => setDraft({ ...draft, leadId: m.id })} placeholder="Choose team lead" />
          </div>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-600">Developers ({draft.memberIds.length})</span>
          <div className="mt-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or department"
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {ordered.slice(0, MAX_SHOWN).map((p) => {
              const on = draft.memberIds.includes(p.id);
              const isLeader = p.id === draft.leadId || p.id === draft.managerId;
              return (
                <button
                  type="button"
                  key={p.id}
                  disabled={isLeader}
                  onClick={() => toggle(p.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {on && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <UserAvatar name={p.name} email={p.email} avatar={p.avatar} size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-800 truncate">{p.name}</span>
                    <span className="block text-[10px] text-slate-500 truncate">{p.email}</span>
                  </span>
                  {isLeader && <span className="text-[10px] text-slate-400">{p.id === draft.leadId ? 'Team Lead' : 'Manager'}</span>}
                </button>
              );
            })}
            {ordered.length > MAX_SHOWN && <div className="px-3 py-2 text-[11px] text-slate-400">Showing {MAX_SHOWN} of {ordered.length}. Search to find more.</div>}
            {!ordered.length && <div className="px-3 py-4 text-center text-xs text-slate-400">No one matches "{search}".</div>}
          </div>
        </div>
        {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold">Save team</button>
        </div>
      </form>
    </div>
  );
};

export const TeamsSettings: React.FC<{ teammates: Teammate[]; canEdit: boolean }> = ({ teammates, canEdit }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [editing, setEditing] = useState<Team | null>(null);
  const [awayPick, setAwayPick] = useState<Teammate | null>(null);
  const [awayUntil, setAwayUntil] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => subscribeTeams(setTeams), []);
  const people = useMemo(() => assignableTeammates(teammates).sort((a, b) => a.name.localeCompare(b.name)), [teammates]);
  const byId = (id?: string | null) => people.find((p) => p.id === id);
  const away = people.filter((p) => isAwayNow(p));

  // Who covers while someone is away (same rule as the server)
  const coverFor = (id: string) => {
    const names = new Set<string>();
    for (const t of teams) {
      if (t.memberIds.includes(id) && t.leadId && t.leadId !== id) {
        const lead = byId(t.leadId);
        const pick = isAwayNow(lead) && t.managerId ? byId(t.managerId) : lead;
        if (pick && !isAwayNow(pick)) names.add(pick.name);
      }
      if (t.leadId === id && t.managerId) {
        const manager = byId(t.managerId);
        if (manager && !isAwayNow(manager)) names.add(manager.name);
      }
    }
    return [...names];
  };

  const flash = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(''), 3000);
  };
  const run = async (action: () => Promise<void>, done: string) => {
    try {
      await action();
      flash(done);
    } catch (err: any) {
      flash(err?.message || 'Could not save.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /> Teams</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Each team has a Manager, a Team Lead and developers. When a developer is out of office, their notifications also go to the Team Lead; when the Team Lead is out, to the Manager.
            </p>
          </div>
          {canEdit && (
            <button onClick={() => setEditing({ id: `team_${Date.now()}`, name: '', managerId: null, leadId: null, memberIds: [] })} className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> New team
            </button>
          )}
        </div>
        {note && <div className="text-xs text-emerald-700 font-semibold">{note}</div>}
        {!teams.length && <div className="text-center text-xs text-slate-400 py-6">No teams yet.{canEdit ? ' Create one to set who covers when someone is out of office.' : ''}</div>}
        <div className="grid gap-3 md:grid-cols-2">
          {teams.map((t) => (
            <div key={t.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-slate-900 text-sm truncate">{t.name}</span>
                {canEdit && (
                  <span className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing(t)} className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer" aria-label="Edit team"><Pencil className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => confirm(`Delete the team "${t.name}"? People stay in the workspace.`) && run(() => deleteTeam(t.id), 'Team deleted')}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 cursor-pointer"
                      aria-label="Delete team"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
              <Person label="Manager" person={byId(t.managerId)} />
              <Person label="Team Lead" person={byId(t.leadId)} />
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-20 shrink-0 pt-1">Developers</span>
                <div className="flex flex-wrap gap-1.5">
                  {t.memberIds.map((id) => byId(id)).filter(Boolean).map((p) => (
                    <span key={p!.id} className="inline-flex items-center gap-1 bg-slate-100 rounded-full pl-0.5 pr-2 py-0.5">
                      <UserAvatar name={p!.name} email={p!.email} avatar={p!.avatar} size={18} />
                      <span className="font-semibold text-slate-700">{p!.name}</span>
                      {isAwayNow(p) && <Plane className="w-3 h-3 text-amber-600" />}
                    </span>
                  ))}
                  {!t.memberIds.length && <span className="text-slate-400 italic pt-1">None yet</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div>
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2"><Plane className="w-4 h-4 text-amber-600" /> Out of office</h2>
          <p className="text-xs text-slate-500 mt-0.5">Everyone sets this in their profile. Admins can also switch it for someone here.</p>
        </div>
        {!away.length && <div className="text-xs text-slate-400">Nobody is out of office.</div>}
        {away.map((p) => {
          const covers = coverFor(p.id);
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs border border-amber-200 bg-amber-50/50 rounded-xl px-3 py-2">
              <UserAvatar name={p.name} email={p.email} avatar={p.avatar} size={24} />
              <span className="font-bold text-slate-800">{p.name}</span>
              <AwayBadge person={p} />
              <span className="text-slate-500 truncate">
                {covers.length ? `Covered by ${covers.join(', ')}` : 'Nobody covers: add them to a team with a Team Lead'}
              </span>
              <span className="flex-1" />
              {canEdit && (
                <button onClick={() => run(() => setOutOfOffice(p.id, false), `${p.name} is back`)} className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold cursor-pointer">
                  Mark as back
                </button>
              )}
            </div>
          );
        })}
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-100">
            <div className="w-64">
              <span className="text-xs font-bold text-slate-600">Mark someone out of office</span>
              <SearchableMemberSelect compact selectedMember={awayPick} teammates={people.filter((p) => !isAwayNow(p))} onSelect={setAwayPick} placeholder="Choose a person" />
            </div>
            <label className="text-xs">
              <span className="font-bold text-slate-600 block">Back after (optional)</span>
              <input type="date" value={awayUntil} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setAwayUntil(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <button
              disabled={!awayPick}
              onClick={() =>
                awayPick &&
                run(async () => {
                  await setOutOfOffice(awayPick.id, true, awayUntil || null);
                  setAwayPick(null);
                  setAwayUntil('');
                }, `${awayPick.name} is out of office`)
              }
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
            >
              Mark out of office
            </button>
          </div>
        )}
      </div>

      {editing && (
        <TeamForm
          team={editing}
          people={people}
          onSave={saveTeam}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};
