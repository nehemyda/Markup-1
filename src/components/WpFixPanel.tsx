import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, Check, Undo2, X, Eye, EyeOff, AlertTriangle, Code } from 'lucide-react';
import { Pin, WpFix } from '../types';
import { apiFetch } from '../lib/api';
import { subscribeWpFixes } from '../lib/firebaseSync';

interface WpFixPanelProps {
  projectId: string;
  pin: Pin;
  isAdmin: boolean;
  currentUserId: string;
  // The live site changed (fix applied or undone): reload the page
  onSiteChanged: () => void;
  // Show CSS on the page without saving it (null = stop previewing)
  onPreviewCss: (css: string | null) => void;
}

const STATUS: Record<WpFix['status'], { label: string; className: string }> = {
  proposed: { label: 'Waiting for approval', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  applying: { label: 'Applying…', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  applied: { label: 'Live on site', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  undoing: { label: 'Undoing…', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  reverted: { label: 'Undone', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  rejected: { label: 'Dismissed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  stale: { label: 'Page changed', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  not_possible: { label: 'Needs a person', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Readable Elementor setting value: colors with a swatch, sizes like "48px"
function SettingValue({ value }: { value: any }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400 italic">not set</span>;
  if (typeof value === 'string' && HEX.test(value)) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm border border-slate-300" style={{ background: value }} />
        <span className="font-mono">{value}</span>
      </span>
    );
  }
  if (value && typeof value === 'object' && 'size' in value) return <span className="font-mono">{value.size}{value.unit || ''}</span>;
  const text = typeof value === 'string' ? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : JSON.stringify(value);
  return <span className="font-mono break-words">{text.length > 120 ? `${text.slice(0, 120)}…` : text}</span>;
}

const settingLabel = (key: string) => key.replace(/^typography_/, '').replace(/_/g, ' ');
const plainText = (html = '') => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\[\/?et_pb_[^\]]*\]/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// Divi shortcode attributes (name="value") in a piece of page content
const diviAttrs = (text = '') => Object.fromEntries(Array.from(text.matchAll(/\b([a-z0-9_]+)="([^"]*)"/gi)).map((m) => [m[1], m[2]]));

function SettingsTable({ before, after, keys }: { before: Record<string, any>; after: Record<string, any>; keys: string[] }) {
  return (
    <table className="w-full text-[10px]">
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="align-top">
            <td className="pr-2 py-0.5 text-slate-500 capitalize whitespace-nowrap">{settingLabel(k)}</td>
            <td className="py-0.5 text-slate-500"><SettingValue value={before[k]} /></td>
            <td className="px-1 py-0.5 text-slate-400">→</td>
            <td className="py-0.5 text-slate-900 font-semibold"><SettingValue value={after[k]} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChangeDetails({ fix }: { fix: WpFix }) {
  const [showCode, setShowCode] = useState(false);
  if (fix.kind === 'elementor_settings') {
    const after = JSON.parse(fix.settingsJson || '{}');
    const before = JSON.parse(fix.beforeJson || '{}');
    const keys = Object.keys(after).filter((k) => k !== 'typography_typography');
    return (
      <div className="space-y-1">
        <div className="text-[10px] text-slate-500">Elementor {fix.elementType} element</div>
        <SettingsTable before={before} after={after} keys={keys} />
      </div>
    );
  }
  if (fix.kind === 'content_replace') {
    const before = plainText(fix.find);
    const after = plainText(fix.replace);
    // Divi module settings changed (shortcode attributes): show them like Elementor settings
    const attrsBefore = fix.builder === 'divi' ? diviAttrs(fix.find) : {};
    const attrsAfter = fix.builder === 'divi' ? diviAttrs(fix.replace) : {};
    const changedAttrs = Array.from(new Set([...Object.keys(attrsBefore), ...Object.keys(attrsAfter)]))
      .filter((k) => attrsBefore[k] !== attrsAfter[k] && !k.startsWith('_'));
    return (
      <div className="space-y-1.5 text-[11px]">
        {changedAttrs.length > 0 && (
          <>
            <div className="text-[10px] text-slate-500">Divi module settings</div>
            <SettingsTable before={attrsBefore} after={attrsAfter} keys={changedAttrs} />
          </>
        )}
        {before !== after ? (
          <>
            <div className="bg-rose-50 border border-rose-100 rounded px-2 py-1 text-rose-900 line-through decoration-rose-300">{before || '(no text)'}</div>
            <div className="bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-emerald-900">{after || '(no text)'}</div>
          </>
        ) : changedAttrs.length === 0 ? (
          <div className="text-[10px] text-slate-500">Changes the page markup only (text stays the same).</div>
        ) : null}
        <button onClick={() => setShowCode((v) => !v)} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800">
          <Code className="w-3 h-3" /> {showCode ? 'Hide code' : 'Show code'}
        </button>
        {showCode && (
          <div className="space-y-1">
            <pre className="bg-slate-900 text-rose-300 text-[10px] p-2 rounded whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{fix.find}</pre>
            <pre className="bg-slate-900 text-emerald-300 text-[10px] p-2 rounded whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{fix.replace}</pre>
          </div>
        )}
      </div>
    );
  }
  if (fix.kind === 'css') {
    return <pre className="bg-slate-900 text-emerald-300 text-[10px] p-2 rounded whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{fix.css}</pre>;
  }
  return fix.reason ? <div className="text-[11px] text-slate-600">{fix.reason}</div> : null;
}

export const WpFixPanel: React.FC<WpFixPanelProps> = ({ projectId, pin, isAdmin, currentUserId, onSiteChanged, onPreviewCss }) => {
  const [fixes, setFixes] = useState<WpFix[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [busyFix, setBusyFix] = useState('');
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [showOld, setShowOld] = useState(false);

  useEffect(() => {
    setError('');
    setShowOld(false);
    return subscribeWpFixes(pin.id, setFixes);
  }, [pin.id]);

  // Stop any preview when switching pins or closing the panel
  useEffect(() => {
    setPreviewId('');
    onPreviewCss(null);
    return () => onPreviewCss(null);
  }, [pin.id]);

  const post = async (path: string, body?: unknown) => {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
    return data;
  };

  const prepare = async () => {
    setPreparing(true);
    setError('');
    try {
      await post(`/api/wp/${projectId}/fixes`, { pinId: pin.id });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreparing(false);
    }
  };

  const act = async (fix: WpFix, action: 'apply' | 'undo' | 'reject') => {
    setBusyFix(fix.id);
    setError('');
    if (previewId === fix.id) {
      setPreviewId('');
      onPreviewCss(null);
    }
    try {
      await post(`/api/wp/${projectId}/fixes/${fix.id}/${action}`);
      if (action !== 'reject') onSiteChanged();
    } catch (err: any) {
      // Undo refused because the page was edited afterwards: let an admin decide
      if (action === 'undo' && err.status === 409 && /edited after/.test(err.message)) {
        if (window.confirm(`${err.message}\n\nUndo anyway? Later edits to this page will be lost.`)) {
          try {
            await post(`/api/wp/${projectId}/fixes/${fix.id}/undo`, { force: true });
            onSiteChanged();
          } catch (forced: any) {
            setError(forced.message);
          }
        }
      } else {
        setError(err.message);
      }
    } finally {
      setBusyFix('');
    }
  };

  const togglePreview = (fix: WpFix) => {
    const next = previewId === fix.id ? '' : fix.id;
    setPreviewId(next);
    onPreviewCss(next ? fix.css || null : null);
  };

  const active = fixes.filter((f) => !['rejected', 'reverted'].includes(f.status));
  const old = fixes.filter((f) => ['rejected', 'reverted'].includes(f.status));
  const hasOpenProposal = fixes.some((f) => f.status === 'proposed' || f.status === 'applying');

  const card = (fix: WpFix) => {
    const status = STATUS[fix.status];
    const busy = busyFix === fix.id;
    const mine = fix.proposedBy?.uid === currentUserId;
    return (
      <div key={fix.id} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2 text-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="font-bold text-slate-900">{fix.summary}</div>
          <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full whitespace-nowrap ${status.className}`}>{status.label}</span>
        </div>
        {fix.explanation && fix.kind !== 'none' && <p className="text-[11px] text-slate-600">{fix.explanation}</p>}
        <ChangeDetails fix={fix} />
        {fix.lastError && <div className="text-[10px] text-rose-700 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-px" />{fix.lastError}</div>}

        <div className="flex items-center gap-1.5 flex-wrap">
          {fix.status === 'proposed' && isAdmin && (
            <button
              onClick={() => act(fix, 'apply')}
              disabled={!!busyFix}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[11px] disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve & apply
            </button>
          )}
          {fix.status === 'proposed' && fix.kind === 'css' && (
            <button
              onClick={() => togglePreview(fix)}
              className="flex items-center gap-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-2.5 py-1 rounded text-[11px]"
            >
              {previewId === fix.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {previewId === fix.id ? 'Stop preview' : 'Preview'}
            </button>
          )}
          {fix.status === 'applied' && isAdmin && (
            <button
              onClick={() => act(fix, 'undo')}
              disabled={!!busyFix}
              className="flex items-center gap-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-2.5 py-1 rounded text-[11px] disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Undo
            </button>
          )}
          {['proposed', 'stale', 'not_possible'].includes(fix.status) && (isAdmin || mine) && (
            <button
              onClick={() => act(fix, 'reject')}
              disabled={!!busyFix}
              className="flex items-center gap-1 text-slate-500 hover:text-rose-600 font-bold px-1.5 py-1 rounded text-[11px] disabled:opacity-50 ml-auto"
            >
              <X className="w-3 h-3" /> Dismiss
            </button>
          )}
        </div>
        {fix.status === 'proposed' && !isAdmin && <div className="text-[10px] text-slate-400">A workspace admin needs to approve this before it goes live.</div>}
        {fix.status === 'applied' && fix.appliedBy && <div className="text-[10px] text-slate-400">Applied by {fix.appliedBy.name}</div>}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
          <Sparkles className="w-4 h-4 text-indigo-500" /> Fix on WordPress
        </span>
        {!hasOpenProposal && (
          <button
            onClick={prepare}
            disabled={preparing}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded text-[11px] disabled:opacity-60"
          >
            {preparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {preparing ? 'Reading the page…' : active.length ? 'Try another fix' : 'Fix with AI'}
          </button>
        )}
      </div>
      {!fixes.length && !preparing && (
        <p className="text-[10px] text-slate-500">Gemini reads this page in WordPress and proposes a change. Nothing goes live until an admin approves it, and every change can be undone.</p>
      )}
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded px-2 py-1.5 text-[11px]">{error}</div>}
      {active.map(card)}
      {old.length > 0 && (
        <button onClick={() => setShowOld((v) => !v)} className="text-[10px] text-slate-500 hover:text-slate-800">
          {showOld ? 'Hide' : 'Show'} {old.length} earlier {old.length === 1 ? 'fix' : 'fixes'}
        </button>
      )}
      {showOld && old.map(card)}
    </div>
  );
};
