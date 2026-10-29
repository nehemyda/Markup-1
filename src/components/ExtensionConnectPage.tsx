import React, { useState } from 'react';
import { Bell, CheckCircle2, Chrome, Loader2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { AuthUser } from '../types';
import { UserAvatar } from './UserAvatar';

// The extension opens /extension/connect?state=… ; it was captured on load because the app rewrites the address
const params = new URLSearchParams(window.location.search);
export const extensionConnectState =
  window.location.pathname === '/extension/connect' && /^[A-Za-z0-9_-]{24,100}$/.test(params.get('state') || '') ? params.get('state') : null;

// Approve the Vpin Chrome extension for the signed-in member
export const ExtensionConnectPage: React.FC<{ user: AuthUser; appName: string; onClose: () => void }> = ({ user, appName, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/api/extension/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: extensionConnectState }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not connect.');
      setDone(true);
      // The extension watches for this address, picks up its key and closes this tab
      window.history.replaceState(null, '', `/extension/connected?state=${encodeURIComponent(extensionConnectState || '')}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-7 space-y-5 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <Chrome className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-slate-900">Connect the Chrome extension</h1>
            <p className="text-xs text-slate-500">{appName} for Chrome</p>
          </div>
        </div>

        {done ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Connected. The extension now shows your notifications and open pins. This tab closes by itself; if not, you can close it.</span>
            </div>
            <button type="button" onClick={onClose} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold text-slate-700">
              Go to {appName}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <UserAvatar name={user.name} email={user.email} avatar={user.avatar} size={32} />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-xs truncate">{user.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
              </div>
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex gap-2"><Bell className="w-4 h-4 text-indigo-600 shrink-0" /> The extension will show your notifications and open pins, and alert you about new client feedback.</li>
              <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /> It can only read your notifications and pins and mark them read. It never sees your password, and you can disconnect it any time.</li>
            </ul>
            {error && <div className="text-xs text-rose-600">{error}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold">
                Cancel
              </button>
              <button
                type="button"
                onClick={connect}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Connect extension
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
