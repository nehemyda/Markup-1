import React, { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import { DeletedProject, loadDeletedProjects, purgeDeletedProject, restoreDeletedProject } from '../lib/supabaseSync';
import { Teammate } from '../types';

const KEEP_DAYS = 30;
const DAY = 86_400_000;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Teammate;
}

// Deleted projects stay here for 30 days; restoring brings back the project with its pins, then it is gone for good
export const RecentlyDeletedModal: React.FC<Props> = ({ isOpen, onClose, currentUser }) => {
  const [items, setItems] = useState<DeletedProject[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Owner';

  useEffect(() => {
    if (!isOpen) return;
    setItems(null);
    setError('');
    loadDeletedProjects()
      .then(setItems)
      .catch((err) => setError(err?.message || 'Could not load Recently deleted.'));
  }, [isOpen]);

  if (!isOpen) return null;

  const mayRestore = (item: DeletedProject) => isAdmin || item.createdBy === currentUser.id || item.deletedBy?.id === currentUser.id;

  const run = async (item: DeletedProject, action: 'restore' | 'purge') => {
    if (action === 'purge' && !window.confirm(`Delete "${item.name}" and its pins for good? This cannot be undone.`)) return;
    setBusyId(item.id);
    setError('');
    try {
      await (action === 'restore' ? restoreDeletedProject(item.id) : purgeDeletedProject(item.id));
      setItems((prev) => (prev || []).filter((i) => i.id !== item.id));
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const daysLeft = (deletedAt: string) => Math.max(0, Math.ceil((Date.parse(deletedAt) + KEEP_DAYS * DAY - Date.now()) / DAY));
  const deletedOn = (deletedAt: string) =>
    new Date(deletedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-sm max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-base text-slate-900">Recently deleted</h2>
            <p className="text-xs text-slate-500 mt-0.5">Deleted projects are kept for {KEEP_DAYS} days with their pins, then removed for good.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="overflow-auto -mx-1 px-1 space-y-2">
          {items === null && !error && (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {items?.length === 0 && <div className="text-center text-slate-500 text-xs py-8">No deleted projects.</div>}
          {items?.map((item) => (
            <div key={item.id} className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate" title={item.url || item.name}>{item.name || item.url}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {item.pinCount} {item.pinCount === 1 ? 'pin' : 'pins'} · deleted {deletedOn(item.deletedAt)}
                  {item.deletedBy?.name ? ` by ${item.deletedBy.name}` : ''} ·{' '}
                  <span className="font-semibold text-amber-700">{daysLeft(item.deletedAt)} days left</span>
                </div>
              </div>
              {mayRestore(item) && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => run(item, 'restore')}
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Restore
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => run(item, 'purge')}
                  title="Delete for good"
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
