import React, { useEffect, useState } from 'react';
import { Loader2, MessageSquare, X } from 'lucide-react';
import { Project } from '../types';
import { apiFetch } from '../lib/api';

type Mode = 'team' | 'own' | 'off';

interface Status {
  team: { connected: boolean; space: string };
  project: { mode: Mode; space: string };
  canEdit: boolean;
}

// Where a project's client feedback alerts are posted in Google Chat: the team space, its own space, or nowhere
export const ProjectChatDialog: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<Mode>('team');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch(`/api/projects/${encodeURIComponent(project.id)}/chat`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Could not load.');
        setStatus(data);
        setMode(data.project.mode);
      })
      .catch((err) => setError(err.message));
  }, [project.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(project.id)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, url: mode === 'own' ? url.trim() : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      setStatus(data);
      setUrl('');
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const options: Array<{ value: Mode; label: string; help: string }> = [
    {
      value: 'team',
      label: 'Team space',
      help: status?.team.connected ? `Posts to the team space (${status.team.space}).` : 'The team space is not connected yet (Settings → Notifications).',
    },
    {
      value: 'own',
      label: 'This project’s own space',
      help: status?.project.mode === 'own' ? `Connected: ${status.project.space}. Paste a new link to change it.` : 'For example a space with this client’s developers.',
    },
    { value: 'off', label: 'Off', help: 'No Google Chat messages for this project (the bell still works).' },
  ];
  const needsUrl = mode === 'own' && status?.project.mode !== 'own';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" /> Google Chat alerts
            </h2>
            <p className="text-xs text-slate-500 truncate" title={project.name}>{project.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!status && !error && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}

        {status && (
          <>
            <p className="text-xs text-slate-600">New client pins and replies on this project are posted to:</p>
            <div className="space-y-2" role="radiogroup">
              {options.map((o) => (
                <label
                  key={o.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${mode === o.value ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 hover:bg-slate-50'} ${!status.canEdit ? 'cursor-default' : ''}`}
                >
                  <input type="radio" name="chat-mode" value={o.value} checked={mode === o.value} disabled={!status.canEdit} onChange={() => setMode(o.value)} className="mt-0.5" />
                  <span>
                    <span className="block text-xs font-bold text-slate-900">{o.label}</span>
                    <span className="block text-[11px] text-slate-500">{o.help}</span>
                  </span>
                </label>
              ))}
            </div>
            {mode === 'own' && status.canEdit && (
              <label className="block text-xs font-bold text-slate-700">
                Webhook link of the space
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://chat.googleapis.com/v1/spaces/…"
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-normal focus:outline-none focus:border-indigo-500"
                />
                <span className="block mt-1 text-[11px] font-normal text-slate-500">Space name → Apps &amp; integrations → Webhooks → Add webhook. A test message is posted when you save.</span>
              </label>
            )}
            {!status.canEdit && <p className="text-[11px] text-slate-500">Only admins and the project's creator can change this.</p>}
          </>
        )}

        {error && <div className="text-xs text-rose-600">{error}</div>}
        {saved && <div className="text-xs font-semibold text-emerald-700">Saved.</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold">
            {status?.canEdit ? 'Cancel' : 'Close'}
          </button>
          {status?.canEdit && (
            <button
              type="submit"
              disabled={busy || (needsUrl && !url.trim())}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
