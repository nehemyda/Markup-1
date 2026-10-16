import React, { useEffect, useState } from 'react';
import { X, Globe, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Unplug, FileText, KeyRound } from 'lucide-react';
import { Project, WpSite } from '../types';
import { apiFetch } from '../lib/api';

interface WordPressModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  // Page being reviewed right now (used to show which builder made it)
  pageUrl?: string;
  site: WpSite | null;
  isAdmin: boolean;
}

const BUILDER_NAMES: Record<string, string> = {
  elementor: 'Elementor',
  divi: 'Divi',
  gutenberg: 'Gutenberg',
  classic: 'Classic editor',
};

interface PageInfo {
  post_id: number;
  title: string;
  builder: string;
  can_edit: boolean;
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const WordPressModal: React.FC<WordPressModalProps> = ({ isOpen, onClose, project, pageUrl, site, isAdmin }) => {
  const projectSiteUrl = project.assets.find((a) => a.type === 'url')?.url || '';
  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [busy, setBusy] = useState<'' | 'connect' | 'check' | 'disconnect'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState<PageInfo | null>(null);
  const [pageError, setPageError] = useState('');

  // Fresh form each time the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    let origin = '';
    try { origin = projectSiteUrl ? new URL(projectSiteUrl).origin : ''; } catch {}
    setSiteUrl(origin);
    setUsername('');
    setAppPassword('');
    setError('');
    setNotice('');
  }, [isOpen, project.id]);

  // Which WordPress page is being reviewed, and which builder made it
  const connected = site?.status === 'connected';
  useEffect(() => {
    setPage(null);
    setPageError('');
    if (!isOpen || !connected || !pageUrl) return;
    let cancelled = false;
    apiFetch(`/api/wp/${project.id}/resolve?url=${encodeURIComponent(pageUrl)}`)
      .then(readJson)
      .then((info) => { if (!cancelled) setPage(info); })
      .catch((err) => { if (!cancelled) setPageError(err.message); });
    return () => { cancelled = true; };
  }, [isOpen, connected, pageUrl, project.id]);

  if (!isOpen) return null;

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('connect');
    setError('');
    try {
      await readJson(await apiFetch(`/api/wp/${project.id}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, username, appPassword }),
      }));
      setAppPassword('');
      setNotice('Connected.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const check = async () => {
    setBusy('check');
    setError('');
    setNotice('');
    try {
      await readJson(await apiFetch(`/api/wp/${project.id}/check`, { method: 'POST' }));
      setNotice('Connection is working.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${site?.siteName || 'this site'} from ${project.name}? The saved password will be deleted.`)) return;
    setBusy('disconnect');
    setError('');
    setNotice('');
    try {
      const result = await readJson(await apiFetch(`/api/wp/${project.id}`, { method: 'DELETE' }));
      setNotice(result.revoked
        ? 'Disconnected. The Application Password was also revoked on the site.'
        : 'Disconnected. Revoke the Application Password in WordPress under Users → Profile.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const activeBuilders = site ? Object.entries(site.builders || {}).filter(([, version]) => version) : [];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 font-extrabold text-base text-slate-900">
            <Globe className="w-5 h-5 text-blue-600" />
            <span>WordPress</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4 text-xs">
          {site ? (
            <>
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-slate-900 truncate">{site.siteName}</div>
                    <a href={site.siteUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline truncate block">{site.siteUrl}</a>
                  </div>
                  {connected ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                      <AlertTriangle className="w-3 h-3" /> Problem
                    </span>
                  )}
                </div>
                {!connected && site.lastError && <div className="text-[11px] text-rose-700">{site.lastError}</div>}
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  <span className="text-slate-400">WordPress user</span>
                  <span>{site.wpUser?.name} ({site.username})</span>
                  <span className="text-slate-400">Builders</span>
                  <span className="flex flex-wrap gap-1">
                    {activeBuilders.length ? activeBuilders.map(([name]) => (
                      <span key={name} className="bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded">{BUILDER_NAMES[name] || name}</span>
                    )) : 'None detected'}
                  </span>
                  <span className="text-slate-400">Versions</span>
                  <span>WordPress {site.wordpressVersion} · Connector {site.pluginVersion}</span>
                </div>
              </div>

              {connected && pageUrl && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2 text-[11px] text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  {page ? (
                    <span className="min-w-0">
                      This page: <strong className="text-slate-900">{page.title || `#${page.post_id}`}</strong>
                      {' '}· built with <strong className="text-slate-900">{BUILDER_NAMES[page.builder] || page.builder}</strong>
                      {!page.can_edit && <span className="text-amber-700"> · the WordPress user can't edit it</span>}
                    </span>
                  ) : pageError ? (
                    <span>{pageError}</span>
                  ) : (
                    <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Finding this page in WordPress…</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={check}
                  disabled={!!busy}
                  className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-3 py-1.5 rounded-md disabled:opacity-50"
                >
                  {busy === 'check' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Check connection
                </button>
                {isAdmin && (
                  <button
                    onClick={disconnect}
                    disabled={!!busy}
                    className="flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 font-bold px-3 py-1.5 rounded-md disabled:opacity-50 ml-auto"
                  >
                    {busy === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                    Disconnect
                  </button>
                )}
              </div>
            </>
          ) : isAdmin ? (
            <form onSubmit={connect} className="space-y-3">
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                <li>Install and activate the <strong>WebReview Connector</strong> plugin on the site.</li>
                <li>Create a WordPress user for WebReview (Editor is enough) and allow it under Settings → WebReview Connector.</li>
                <li>Log in as that user, create an <strong>Application Password</strong> under Users → Profile, and paste it below.</li>
              </ol>
              <label className="block space-y-1">
                <span className="font-bold text-slate-700">Site address</span>
                <input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="font-bold text-slate-700">WordPress username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="font-bold text-slate-700">Application Password</span>
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                  required
                />
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <KeyRound className="w-3 h-3" /> Stored encrypted on the server. Never shown again, not even to admins.
                </span>
              </label>
              <button
                type="submit"
                disabled={!!busy}
                className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-md disabled:opacity-50"
              >
                {busy === 'connect' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Connect site
              </button>
            </form>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[11px] text-slate-600">
              This project isn't connected to WordPress yet. Ask a workspace admin to connect it.
            </div>
          )}

          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-[11px]">{error}</div>}
          {notice && !error && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2 text-[11px]">{notice}</div>}
        </div>
      </div>
    </div>
  );
};
